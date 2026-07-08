const moment = require('moment-timezone');
const config = require('../config');
const os = require('os');
const fs = require('fs-extra');

function getTimestamp() {
  return moment().tz('Africa/Brazzaville').format('YYYY-MM-DD HH:mm:ss');
}

function getDate() {
  return moment().tz('Africa/Brazzaville').format('DD/MM/YYYY');
}

function getTime() {
  return moment().tz('Africa/Brazzaville').format('HH:mm:ss');
}

function getRam() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return `${formatBytes(used)} / ${formatBytes(total)}`;
}

function getUptime() {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);
  return `${h}h ${m}m ${s}s`;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isOwner(jid) {
  // Comparaison normalisée (ignore suffixe d'appareil / variantes @lid) pour éviter
  // les faux négatifs sur les commandes réservées au propriétaire, même bug que
  // pour les vérifications admin de groupe (voir jidsMatch plus bas).
  return jidsMatch(jid, config.OWNER_NUMBER + '@s.whatsapp.net');
}

// ── Robust JID comparison (fixe le bug "Admin only" alors que l'utilisateur EST admin) ──
// Cause: WhatsApp/Baileys peut représenter le même utilisateur avec des JID différents
// selon le contexte (suffixe d'appareil ":12", format @lid vs @s.whatsapp.net, etc).
// On compare uniquement la partie "user" (numéro) après avoir retiré le suffixe d'appareil,
// et on teste tous les champs d'identité possibles (id, jid, lid, phoneNumber).
function normalizeJidUser(jid) {
  if (!jid || typeof jid !== 'string') return null;
  return jid.split('@')[0].split(':')[0];
}

function jidsMatch(a, b) {
  const ua = normalizeJidUser(a);
  const ub = normalizeJidUser(b);
  return !!ua && !!ub && ua === ub;
}

// Construit toutes les variantes possibles du JID de l'expéditeur à partir du message brut
function getSenderCandidates(msgKey, sender) {
  const candidates = new Set();
  if (sender) candidates.add(sender);
  if (msgKey) {
    if (msgKey.participant) candidates.add(msgKey.participant);
    if (msgKey.participantAlt) candidates.add(msgKey.participantAlt);
    if (msgKey.participantPn) candidates.add(msgKey.participantPn);
    if (msgKey.participantLid) candidates.add(msgKey.participantLid);
    if (msgKey.remoteJidAlt) candidates.add(msgKey.remoteJidAlt);
  }
  return Array.from(candidates).filter(Boolean);
}

// Cherche un participant dans la liste du groupe en comparant tous les champs d'identité
// possibles (id, jid, lid, phoneNumber) contre toutes les variantes du sender.
function findParticipant(participants, senderCandidates) {
  if (!Array.isArray(participants)) return null;
  const candidates = Array.isArray(senderCandidates) ? senderCandidates : [senderCandidates];
  return participants.find(p => {
    const fields = [p.id, p.jid, p.lid, p.phoneNumber].filter(Boolean);
    return fields.some(f => candidates.some(c => jidsMatch(f, c)));
  }) || null;
}

// Vérifie si l'expéditeur (sender + toutes ses variantes de JID) est admin du groupe.
// groupOwnerJid (optionnel): JID du créateur du groupe (groupMetadata().owner) — certains
// forks Baileys ne renseignent pas toujours le champ "admin" du créateur pour les groupes
// liés à une communauté, donc on le traite explicitement comme admin par sécurité.
function isParticipantAdmin(participants, senderCandidates, groupOwnerJid) {
  const p = findParticipant(participants, senderCandidates);
  if (p?.admin != null) return true; // 'admin' ou 'superadmin'
  if (groupOwnerJid) {
    const candidates = Array.isArray(senderCandidates) ? senderCandidates : [senderCandidates];
    if (candidates.some(c => jidsMatch(c, groupOwnerJid))) return true;
  }
  return false;
}

async function countCommands() {
  try {
    const pluginsDir = require('path').join(__dirname, '../plugins');
    const files = fs.readdirSync(pluginsDir);
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.js')) {
        const content = fs.readFileSync(`${pluginsDir}/${file}`, 'utf8');
        const matches = content.match(/case\s+['"][^'"]+['"]\s*:/g);
        if (matches) count += matches.length;
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

function formatMenu(sections) {
  let out = '';
  for (const [title, cmds] of Object.entries(sections)) {
    out += `\n┌─── ${title} ───\n`;
    out += cmds.map(c => `│ ${config.PREFIX}${c}`).join('\n');
    out += '\n└──────────────────\n';
  }
  return out;
}

function getHost() {
  return process.env.RENDER_EXTERNAL_URL || os.hostname();
}

module.exports = {
  getTimestamp, getDate, getTime, getRam, getUptime,
  formatBytes, generateOTP, sleep, isOwner,
  countCommands, formatMenu, getHost,
  normalizeJidUser, jidsMatch, getSenderCandidates, findParticipant, isParticipantAdmin,
};
