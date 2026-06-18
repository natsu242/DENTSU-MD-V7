const config = require('../config');
const { getContentType, jidNormalizedUser } = require('baileys');
const { getTime, getDate, getRam, getUptime, countCommands, getHost } = require('../lib/utils');
const { isOwner } = require('../lib/utils');
const { handleCommand } = require('../commands');

// Commandes reconnues sans préfixe
const NO_PREFIX_CMDS = new Set(['menu', 'help', 'aide', 'start', 'bot', 'commandes']);

async function messageHandler(sock, { messages, type }) {
  if (type !== 'notify') return;

  const msg = messages[0];
  if (!msg?.message) return;

  // Sécurité : sock.user peut être null pendant la phase de connexion
  if (!sock.user) return;

  const from = msg.key.remoteJid;
  if (!from) return;

  const isGroup    = from.endsWith('@g.us');
  const botJid     = jidNormalizedUser(sock.user.id);
  const botNumber  = sock.user.id.split(':')[0];
  const botFullJid = botNumber + '@s.whatsapp.net';

  // Calcul correct du sender :
  // - groupe + fromMe  → c'est le bot qui écrit → JID du bot
  // - groupe + fromMe  → normalement ignoré (voir filtre bas), mais on calcule quand même
  // - groupe + pas fromMe → msg.key.participant = vrai expéditeur
  // - privé + fromMe   → c'est l'owner qui écrit depuis son téléphone
  // - privé + pas fromMe → from = expéditeur
  const sender = isGroup
    ? (msg.key.fromMe ? botFullJid : (msg.key.participant || from))
    : (msg.key.fromMe ? botFullJid : from);

  const senderNumber = sender?.split('@')[0];

  // ── Bloquer les réponses automatiques du bot (éviter les boucles)
  // On autorise fromMe UNIQUEMENT si c'est l'owner/bot qui tape une commande.
  // Les réponses automatiques du bot ne commencent pas par un préfixe,
  // donc elles seront naturellement ignorées lors de la détection de commande.
  // On bloque seulement les messages STATUS/système hors chat
  if (from === 'status@broadcast') return;

  // ── Dérouler les messages éphémères / view-once / document-with-caption ──
  const rawMsg = msg.message?.ephemeralMessage?.message
    || msg.message?.viewOnceMessage?.message
    || msg.message?.viewOnceMessageV2?.message?.message
    || msg.message?.documentWithCaptionMessage?.message
    || msg.message;

  const mtype = getContentType(rawMsg);
  const body =
    mtype === 'conversation'              ? rawMsg.conversation
    : mtype === 'imageMessage'            ? rawMsg.imageMessage?.caption || ''
    : mtype === 'videoMessage'            ? rawMsg.videoMessage?.caption || ''
    : mtype === 'extendedTextMessage'     ? rawMsg.extendedTextMessage?.text || ''
    : mtype === 'buttonsResponseMessage'  ? rawMsg.buttonsResponseMessage?.selectedButtonId || ''
    : mtype === 'listResponseMessage'     ? rawMsg.listResponseMessage?.singleSelectReply?.selectedRowId || ''
    : mtype === 'templateButtonReplyMessage' ? rawMsg.templateButtonReplyMessage?.selectedId || ''
    : mtype === 'interactiveResponseMessage'
        ? (() => { try { return JSON.parse(rawMsg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '{}').id || ''; } catch { return ''; } })()
        : '';

  if (!body) return;

  // ── Détection de la commande (multi-préfixe + sans préfixe) ──────────────
  const PREFIXES = config.PREFIXES || ['.', '!', '/', '#', '$'];
  let usedPrefix = '';
  let command    = '';
  let args       = [];

  // 1. Tester chaque préfixe dans l'ordre
  for (const p of PREFIXES) {
    if (body.startsWith(p)) {
      usedPrefix = p;
      const parts = body.slice(p.length).trim().split(/\s+/);
      command = (parts.shift() || '').toLowerCase();
      args    = parts;
      break;
    }
  }

  // 2. Fallback : commandes sans préfixe (ex: "menu", "help")
  if (!command) {
    const lw = body.trim().toLowerCase();
    if (NO_PREFIX_CMDS.has(lw)) {
      command    = lw;
      usedPrefix = '';
      args       = [];
    }
  }

  // Pas une commande reconnaissable → ignorer
  if (!command) return;

  const text   = args.join(' ');
  const quoted = rawMsg?.extendedTextMessage?.contextInfo?.quotedMessage;

  // ── Auto-typing ──────────────────────────────────────────────────────────
  if (config.AUTO_TYPING) {
    try { await sock.sendPresenceUpdate('composing', from); } catch (_) {}
  }

  // ── Helper : répondre ────────────────────────────────────────────────────
  const reply = async (content) => {
    if (typeof content === 'string') {
      return sock.sendMessage(from, { text: content }, { quoted: msg });
    }
    return sock.sendMessage(from, content, { quoted: msg });
  };

  const sendImage = async (url, caption = '') =>
    sock.sendMessage(from, { image: { url }, caption }, { quoted: msg });

  const ctx = {
    sock, msg, from, sender, senderNumber, isGroup,
    args, text, quoted, reply, sendImage,
    command, prefix: usedPrefix || config.PREFIX, botNumber, botJid,
    isOwner: isOwner(sender),
  };

  try {
    // ── MENU PRINCIPAL ───────────────────────────────────────────
    if (command === 'menu' || command === 'help' || command === 'aide'
        || command === 'start' || command === 'bot' || command === 'commandes') {
      return await sendMainMenu(ctx);
    }

    // ── TOUTES LES AUTRES COMMANDES ──────────────────────────────
    const handled = await handleCommand(ctx);
    if (handled === false) {
      await reply(
        `❌ Commande *${command}* introuvable.\n` +
        `Tape *menu*, *.menu*, *!menu* ou */menu* pour voir les commandes.`
      );
    }
  } catch (err) {
    console.error(`[CMD:${command}] Erreur:`, err.message);
    try {
      await reply(`⚠️ Erreur lors de *${command}*.\n_${err.message}_`);
    } catch (_) {}
  } finally {
    if (config.AUTO_TYPING) {
      try { await sock.sendPresenceUpdate('paused', from); } catch (_) {}
    }
  }
}

async function sendMainMenu(ctx) {
  const { sock, from, msg, senderNumber, sender } = ctx;

  let totalCmds = 0;
  try { totalCmds = await countCommands(); } catch (_) {}

  const prefixStr = (config.PREFIXES || ['.']).join('  ');

  const menuText =
`╔══════════════════════╗
║   🤖 *DENTSU MD V7*  ║
╚══════════════════════╝

┌─────────────────────────
│ 📌 *Version* : V7
│ 👨‍💻 *Dev* : Natsu Tech
│ 📅 *Date* : ${getDate()}
│ ⏰ *Heure* : ${getTime()}
│ 👤 *User* : @${senderNumber}
│ 📊 *Commandes* : ${totalCmds}+
│ 🌐 *Mode* : ${config.MODE.toUpperCase()}
│ ⌨️ *Préfixes* : ${prefixStr}
│ 🖥️ *RAM* : ${getRam()}
│ 🌍 *Host* : ${getHost()}
│ 🔗 *Web* : ${config.WEBSITE}
└─────────────────────────

*📋 CATÉGORIES DE COMMANDES*

🧠 *AI MENU*      → .aimenu
👥 *GROUP MENU*   → .groupmenu
👑 *OWNER MENU*   → .ownermenu
🎉 *FUN MENU*     → .funmenu
🎮 *GAME MENU*    → .gamemenu
🎵 *SOUND MENU*   → .soundmenu
🔧 *OTHER MENU*   → .othermenu
📥 *DOWNLOADER*   → .dlmenu
📸 *MEDIA MENU*   → .mediamenu
🔍 *SEARCH MENU*  → .searchmenu
🖼️ *RANDOM IMAGE* → .randommenu
🎌 *ANIME MENU*   → .animemenu

━━━━━━━━━━━━━━━━━━━━━
📢 *Canal* : ${config.CHANNEL_LINK}
💬 *Groupe* : ${config.GROUP_LINK}
✈️ *Telegram* : ${config.TELEGRAM}
━━━━━━━━━━━━━━━━━━━━━
💡 .menu  !menu  /menu  menu — tous fonctionnent
${config.BOT_FOOTER}`;

  return sock.sendMessage(from, {
    text: menuText,
    mentions: [sender],
  }, { quoted: msg });
}

module.exports = { messageHandler, sendMainMenu };
