const config = require('../config');
const fs = require('fs-extra');
const { delay } = require('baileys');
const store = require('../lib/store');

const OWNER_MENU = `
╔══════════════════════╗
║   👑 *OWNER MENU*   ║
╚══════════════════════╝

│ ${config.PREFIX}setpp [image]
│ ${config.PREFIX}ban [numéro]
│ ${config.PREFIX}unban [numéro]
│ ${config.PREFIX}self
│ ${config.PREFIX}public
│ ${config.PREFIX}autoread on/off
│ ${config.PREFIX}autobio [texte]
│ ${config.PREFIX}autorecording on/off
│ ${config.PREFIX}autotyping on/off
│ ${config.PREFIX}autoviewstatus on/off
│ ${config.PREFIX}autoreact on/off
│ ${config.PREFIX}block @user
│ ${config.PREFIX}unblock @user
│ ${config.PREFIX}delete
│ ${config.PREFIX}setaccount [bio]
│ ${config.PREFIX}addsudo @user
│ ${config.PREFIX}delsudo @user
│ ${config.PREFIX}listsudo
│ ${config.PREFIX}fixowner
│ ${config.PREFIX}getbot
│ ${config.PREFIX}broadcast [msg]
│ ${config.PREFIX}mode public/self
│ ${config.PREFIX}ping
│ ${config.PREFIX}alive
│ ${config.PREFIX}runtime
│ ${config.PREFIX}del
│ ${config.PREFIX}delete
│ ${config.PREFIX}leaveall
│ ${config.PREFIX}listgc
│ ${config.PREFIX}mode [public/self]

${config.BOT_FOOTER}`;

const sudoList = new Set();
const blocklist = new Set();

async function handle(ctx) {
  const { command, text, reply, sock, from, msg, sender, args, isGroup } = ctx;

  if (command === 'ownermenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: OWNER_MENU
    }, { quoted: msg });
    return true;
  }

  const ownerOnly = ['setpp','ban','unban','self','public','autoread','autobio','autorecording',
    'autotyping','autoviewstatus','autoreact','block','unblock','delete','setaccount',
    'addsudo','delsudo','listsudo','fixowner','getbot','broadcast','mode','leaveall','listgc',
    'del','ping','alive','runtime','autodownload'];

  if (ownerOnly.includes(command) && !ctx.isOwner && !sudoList.has(sender)) {
    return reply('❌ Cette commande est réservée au propriétaire!');
  }

  switch(command) {
    case 'ping': {
      const start = Date.now();
      const m = await reply('🏓 Ping...');
      const end = Date.now();
      await reply(`🏓 *Pong!*\n⚡ Vitesse: ${end - start}ms\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'alive':
    case 'runtime': {
      const uptime = process.uptime();
      const h = Math.floor(uptime / 3600);
      const m2 = Math.floor((uptime % 3600) / 60);
      const s = Math.floor(uptime % 60);
      await sock.sendMessage(from, {
        image: { url: config.MENU_IMAGE },
        caption: `✅ *DENTSU MD V9 est en ligne!*\n\n⏱️ Runtime: ${h}h ${m2}m ${s}s\n👤 Sessions actives: ${store.sessionCount()}\n📱 Mode: ${config.MODE}\n🌍 Host: ${process.env.RENDER_EXTERNAL_URL || 'Local'}\n\n${config.BOT_FOOTER}`
      }, { quoted: msg });
      return true;
    }

    case 'mode': {
      if (!text) return reply(`ℹ️ Mode actuel: ${config.MODE}\nUsage: ${config.PREFIX}mode public/self`);
      if (text === 'public') {
        config.MODE = 'public';
        return reply('✅ Mode PUBLIC activé - tout le monde peut utiliser le bot');
      }
      if (text === 'self') {
        config.MODE = 'self';
        return reply('✅ Mode SELF activé - seulement le propriétaire');
      }
      return reply('❌ Usage: .mode public ou .mode self');
    }

    case 'self':
      config.MODE = 'self';
      return reply('✅ Mode SELF activé!');

    case 'public':
      config.MODE = 'public';
      return reply('✅ Mode PUBLIC activé!');

    case 'block': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned.length && !args[0]) return reply('❌ Mentionne quelqu\'un ou donne un numéro!');
      const target = mentioned[0] || (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
      try {
        await sock.updateBlockStatus(target, 'block');
        blocklist.add(target);
        reply(`🚫 @${target.split('@')[0]} bloqué!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'unblock': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned.length && !args[0]) return reply('❌ Mentionne quelqu\'un!');
      const target = mentioned[0] || (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
      try {
        await sock.updateBlockStatus(target, 'unblock');
        blocklist.delete(target);
        reply(`✅ @${target.split('@')[0]} débloqué!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'blocklist': {
      if (blocklist.size === 0) return reply('📋 Liste de blocage vide');
      reply(`🚫 *Bloqués*:\n${[...blocklist].map(j => `• @${j.split('@')[0]}`).join('\n')}`);
      return true;
    }

    case 'broadcast': {
      if (!text) return reply('❌ Usage: .broadcast [message]');
      const sessions = store.getAllSessions();
      let sent = 0;
      for (const [num, sess] of sessions) {
        try {
          await sess.sock.sendMessage(num + '@s.whatsapp.net', { text: `📢 *Broadcast DENTSU MD V9*\n\n${text}\n\n${config.BOT_FOOTER}` });
          sent++;
          await delay(1000);
        } catch(e) {}
      }
      reply(`✅ Broadcast envoyé à ${sent} contact(s)!`);
      return true;
    }

    case 'addsudo': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      sudoList.add(mentioned[0]);
      reply(`✅ @${mentioned[0].split('@')[0]} ajouté en sudo!`);
      return true;
    }

    case 'delsudo': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      sudoList.delete(mentioned[0]);
      reply(`✅ @${mentioned[0].split('@')[0]} retiré du sudo!`);
      return true;
    }

    case 'listsudo': {
      if (sudoList.size === 0) return reply('📋 Aucun sudo');
      reply(`👑 *Sudo list*:\n${[...sudoList].map(j => `• @${j.split('@')[0]}`).join('\n')}`);
      return true;
    }

    case 'del':
    case 'delete': {
      const quotedKey = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!quotedKey) return reply('❌ Réponds à un message à supprimer!');
      try {
        await sock.sendMessage(from, {
          delete: {
            remoteJid: from,
            fromMe: quotedParticipant === sock.user.id,
            id: quotedKey,
            participant: quotedParticipant
          }
        });
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'autoviewstatus': {
      const val = text?.toLowerCase();
      if (val === 'on') { config.AUTO_VIEW_STATUS = true; return reply('✅ Auto-view status activé!'); }
      if (val === 'off') { config.AUTO_VIEW_STATUS = false; return reply('✅ Auto-view status désactivé!'); }
      return reply(`ℹ️ Auto-view status: ${config.AUTO_VIEW_STATUS ? 'ON' : 'OFF'}\nUsage: .autoviewstatus on/off`);
    }

    case 'autoreact': {
      const val = text?.toLowerCase();
      if (val === 'on') { config.AUTO_LIKE_STATUS = true; return reply('✅ Auto-react activé!'); }
      if (val === 'off') { config.AUTO_LIKE_STATUS = false; return reply('✅ Auto-react désactivé!'); }
      return reply(`ℹ️ Auto-react: ${config.AUTO_LIKE_STATUS ? 'ON' : 'OFF'}`);
    }

    case 'autorecording': {
      const val = text?.toLowerCase();
      if (val === 'on') { config.AUTO_RECORDING = true; return reply('✅ Auto-recording activé!'); }
      if (val === 'off') { config.AUTO_RECORDING = false; return reply('✅ Auto-recording désactivé!'); }
      return reply(`ℹ️ Auto-recording: ${config.AUTO_RECORDING ? 'ON' : 'OFF'}`);
    }

    case 'autotyping': {
      const val = text?.toLowerCase();
      if (val === 'on') { config.AUTO_TYPING = true; return reply('✅ Auto-typing activé!'); }
      if (val === 'off') { config.AUTO_TYPING = false; return reply('✅ Auto-typing désactivé!'); }
      return reply(`ℹ️ Auto-typing: ${config.AUTO_TYPING ? 'ON' : 'OFF'}`);
    }

    case 'listgc': {
      try {
        const groups = await sock.groupFetchAllParticipating();
        const list = Object.values(groups).map(g => `• ${g.subject} (${g.participants.length} membres)`);
        reply(`📋 *Groupes actifs*:\n\n${list.join('\n') || 'Aucun groupe'}`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'leaveall': {
      try {
        const groups = await sock.groupFetchAllParticipating();
        const ids = Object.keys(groups);
        for (const id of ids) {
          try { await sock.groupLeave(id); await delay(1000); } catch(e2) {}
        }
        reply(`✅ Quitté ${ids.length} groupe(s)!`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'getpp':
    case 'getname':
    case 'jid':
    case 'whois': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const target = mentioned[0] || sender;
      try {
        const pp = await sock.profilePictureUrl(target, 'image').catch(() => config.MENU_IMAGE);
        const status = await sock.fetchStatus(target).catch(() => ({ status: 'Aucun' }));
        await sock.sendMessage(from, {
          image: { url: pp },
          caption: `👤 *Profil*\n\n📱 JID: ${target}\n💬 Status: ${status?.status || 'Aucun'}\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'setaccount':
    case 'setbio': {
      if (!text) return reply('❌ Donne une bio!');
      try {
        await sock.updateProfileStatus(text);
        reply(`✅ Bio mise à jour: "${text}"`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    case 'setname':
    case 'myname': {
      if (!text) return reply('❌ Donne un nom!');
      try {
        await sock.updateProfileName(text);
        reply(`✅ Nom mis à jour: "${text}"`);
      } catch(e) { reply('❌ Erreur: ' + e.message); }
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
