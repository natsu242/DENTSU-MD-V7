const config = require('../config');
const { delay } = require('baileys');

const GROUP_MENU = `
╔══════════════════════╗
║   👥 *GROUP MENU*   ║
╚══════════════════════╝

│ ${config.PREFIX}tagall [msg]
│ ${config.PREFIX}hidetag [msg]
│ ${config.PREFIX}promote @user
│ ${config.PREFIX}demote @user
│ ${config.PREFIX}kick @user
│ ${config.PREFIX}add numéro
│ ${config.PREFIX}mute
│ ${config.PREFIX}unmute
│ ${config.PREFIX}left
│ ${config.PREFIX}grouplink
│ ${config.PREFIX}resetlink
│ ${config.PREFIX}kickadmins
│ ${config.PREFIX}kickall
│ ${config.PREFIX}listadmins
│ ${config.PREFIX}listonline
│ ${config.PREFIX}opengc
│ ${config.PREFIX}closegc
│ ${config.PREFIX}opentime [heure]
│ ${config.PREFIX}closetime [heure]
│ ${config.PREFIX}antilink on/off
│ ${config.PREFIX}creategroup [nom]
│ ${config.PREFIX}join [lien]
│ ${config.PREFIX}announce
│ ${config.PREFIX}antibot on/off
│ ${config.PREFIX}antighost on/off
│ ${config.PREFIX}antisticker on/off
│ ${config.PREFIX}antiword [mot]
│ ${config.PREFIX}welcome on/off
│ ${config.PREFIX}goodbye on/off
│ ${config.PREFIX}desc [description]
│ ${config.PREFIX}disappear on/off
│ ${config.PREFIX}everyone [msg]
│ ${config.PREFIX}groupinfo
│ ${config.PREFIX}groupstats
│ ${config.PREFIX}poll [question]
│ ${config.PREFIX}warn @user
│ ${config.PREFIX}warncount @user
│ ${config.PREFIX}warnreset @user
│ ${config.PREFIX}subject [nom]
│ ${config.PREFIX}setgpp [image]
│ ${config.PREFIX}revoke
│ ${config.PREFIX}lock
│ ${config.PREFIX}unlock
│ ${config.PREFIX}invite
│ ${config.PREFIX}inviteuser @user
│ ${config.PREFIX}approve
│ ${config.PREFIX}reject
│ ${config.PREFIX}requests
│ ${config.PREFIX}protection on/off
│ ${config.PREFIX}rtag [msg]
│ ${config.PREFIX}totag [msg]

${config.BOT_FOOTER}`;

async function isAdmin(sock, from, jid) {
  try {
    const meta = await sock.groupMetadata(from);
    return meta.participants.find(p => p.id === jid)?.admin != null;
  } catch(e) { return false; }
}

async function isBotAdmin(sock, from) {
  try {
    const meta = await sock.groupMetadata(from);
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    return meta.participants.find(p => p.id === botId)?.admin != null;
  } catch(e) { return false; }
}

function getMentioned(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

async function handle(ctx) {
  const { command, text, reply, sock, from, msg, sender, isGroup, args } = ctx;

  if (command === 'groupmenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: GROUP_MENU
    }, { quoted: msg });
    return true;
  }

  if (!isGroup && ['tagall','hidetag','promote','demote','kick','mute','unmute','kickadmins','kickall',
    'listadmins','listonline','opengc','closegc','antilink','grouplink','resetlink','left',
    'announce','antibot','antighost','antisticker','antiword','welcome','goodbye','desc',
    'disappear','everyone','groupinfo','groupstats','poll','warn','warncount','warnreset',
    'subject','setgpp','revoke','lock','unlock','invite','inviteuser','approve','reject',
    'requests','protection','rtag','totag','kickall'].includes(command)) {
    return reply('❌ Cette commande est réservée aux groupes!');
  }

  switch(command) {
    case 'groupmenu':
      return true;

    case 'tagall':
    case 'everyone':
    case 'rtag':
    case 'totag': {
      if (!ctx.isOwner) { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin) return reply('❌ Admin uniquement.'); }
      try {
        const meta = await sock.groupMetadata(from);
        const members = meta.participants;
        const mentions = members.map(m => m.id);
        const txt = text || '📢 Attention tout le monde!';
        await sock.sendMessage(from, {
          text: `📢 *${txt}*\n\n${members.map(m => `@${m.id.split('@')[0]}`).join(' ')}`,
          mentions
        });
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'hidetag': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      try {
        const meta = await sock.groupMetadata(from);
        const mentions = meta.participants.map(m => m.id);
        await sock.sendMessage(from, {
          text: text || '📢 Message de groupe',
          mentions
        });
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'promote': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      try {
        await sock.groupParticipantsUpdate(from, mentioned, 'promote');
        reply(`✅ @${mentioned[0].split('@')[0]} promu admin!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'demote': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      try {
        await sock.groupParticipantsUpdate(from, mentioned, 'demote');
        reply(`✅ @${mentioned[0].split('@')[0]} rétrogradé!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'kick': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      try {
        await sock.groupParticipantsUpdate(from, mentioned, 'remove');
        reply(`✅ @${mentioned[0].split('@')[0]} expulsé!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'add': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      if (!args[0]) return reply('❌ Donne un numéro! Ex: .add 242XXXXXXX');
      const num = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
      try {
        await sock.groupParticipantsUpdate(from, [num], 'add');
        reply(`✅ ${args[0]} ajouté au groupe!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'mute':
    case 'closegc': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      try {
        await sock.groupSettingUpdate(from, 'announcement');
        reply('🔇 Groupe mis en mode silence (admins seulement)');
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'unmute':
    case 'opengc': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      try {
        await sock.groupSettingUpdate(from, 'not_announcement');
        reply('🔊 Groupe ouvert à tous!');
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'grouplink':
    case 'invite': {
      try {
        const link = await sock.groupInviteCode(from);
        reply(`🔗 Lien du groupe:\nhttps://chat.whatsapp.com/${link}`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'resetlink':
    case 'revoke': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      try {
        await sock.groupRevokeInvite(from);
        const link = await sock.groupInviteCode(from);
        reply(`✅ Lien réinitialisé!\n🔗 Nouveau: https://chat.whatsapp.com/${link}`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'kickadmins': {
      if (!ctx.isOwner) return reply('❌ Réservé au propriétaire!');
      try {
        const meta = await sock.groupMetadata(from);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const admins = meta.participants.filter(p => p.admin && p.id !== botId).map(p => p.id);
        if (!admins.length) return reply('❌ Aucun admin à expulser');
        await sock.groupParticipantsUpdate(from, admins, 'remove');
        reply(`✅ ${admins.length} admin(s) expulsé(s)!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'kickall': {
      if (!ctx.isOwner) return reply('❌ Réservé au propriétaire!');
      try {
        const meta = await sock.groupMetadata(from);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const ownerJid = config.OWNER_NUMBER + '@s.whatsapp.net';
        const members = meta.participants
          .filter(p => p.id !== botId && p.id !== ownerJid)
          .map(p => p.id);
        for (const m of members) {
          try { await sock.groupParticipantsUpdate(from, [m], 'remove'); await delay(500); } catch(e2) {}
        }
        reply(`✅ ${members.length} membres expulsés!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'listadmins': {
      try {
        const meta = await sock.groupMetadata(from);
        const admins = meta.participants.filter(p => p.admin);
        reply(`👑 *Admins du groupe*\n\n${admins.map(a => `• @${a.id.split('@')[0]}`).join('\n')}`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'groupinfo': {
      try {
        const meta = await sock.groupMetadata(from);
        reply(`📋 *Info Groupe*\n\n📌 Nom: ${meta.subject}\n👥 Membres: ${meta.participants.length}\n👑 Admins: ${meta.participants.filter(p=>p.admin).length}\n📝 Desc: ${meta.desc || 'Aucune'}\n🆔 ID: ${from}`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'subject': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      if (!text) return reply('❌ Donne un nouveau nom!');
      try {
        await sock.groupUpdateSubject(from, text);
        reply(`✅ Nom du groupe changé en: *${text}*`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'desc': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      if (!text) return reply('❌ Donne une description!');
      try {
        await sock.groupUpdateDescription(from, text);
        reply(`✅ Description mise à jour!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'left':
    case 'leave': {
      if (!ctx.isOwner) return reply('❌ Réservé au propriétaire!');
      try {
        await sock.groupLeave(from);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'join': {
      if (!ctx.isOwner) return reply('❌ Réservé au propriétaire!');
      if (!text) return reply('❌ Donne un lien d\'invitation!');
      try {
        const code = text.split('chat.whatsapp.com/')[1]?.split('?')[0];
        if (!code) return reply('❌ Lien invalide!');
        await sock.groupAcceptInvite(code);
        reply('✅ Groupe rejoint!');
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'poll': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      if (!text) return reply('❌ Usage: .poll Question | Option1 | Option2');
      const parts = text.split('|').map(s => s.trim());
      if (parts.length < 3) return reply('❌ Minimum 2 options! Ex: .poll Question | Option1 | Option2');
      try {
        await sock.sendMessage(from, {
          poll: {
            name: parts[0],
            values: parts.slice(1),
            selectableCount: 1
          }
        });
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'warn': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      const { warnStore } = require('../lib/store');
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      const target = mentioned[0];
      const count = (warnStore.get(target) || 0) + 1;
      warnStore.set(target, count);
      reply(`⚠️ @${target.split('@')[0]} a reçu un avertissement (${count}/3)${count >= 3 ? '\n🔨 Expulsion!' : ''}`);
      if (count >= 3) {
        warnStore.delete(target);
        try { await sock.groupParticipantsUpdate(from, [target], 'remove'); } catch(e) {}
      }
      return true;
    }

    case 'warncount': {
      const { warnStore } = require('../lib/store');
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      const count = warnStore.get(mentioned[0]) || 0;
      reply(`⚠️ @${mentioned[0].split('@')[0]} a ${count} avertissement(s)`);
      return true;
    }

    case 'warnreset': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      const { warnStore } = require('../lib/store');
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      warnStore.delete(mentioned[0]);
      reply(`✅ Avertissements de @${mentioned[0].split('@')[0]} réinitialisés!`);
      return true;
    }

    case 'creategroup': {
      if (!text) return reply('❌ Donne un nom au groupe!');
      try {
        const result = await sock.groupCreate(text, [sender]);
        reply(`✅ Groupe "${text}" créé!\n🆔 ${result.id}`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'lock': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      try {
        await sock.groupSettingUpdate(from, 'locked');
        reply('🔒 Groupe verrouillé (seuls les admins peuvent modifier les infos)');
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'unlock': {
      { const userAdmin = await isAdmin(sock, from, sender); if (!userAdmin && !ctx.isOwner) return reply('❌ Admin uniquement.'); }
      try {
        await sock.groupSettingUpdate(from, 'unlocked');
        reply('🔓 Groupe déverrouillé!');
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
