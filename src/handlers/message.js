const config = require('../config');
const { getContentType, jidNormalizedUser } = require('baileys');
const { getTimestamp, getTime, getDate, getRam, getUptime, countCommands, getHost } = require('../lib/utils');
const { isOwner } = require('../lib/utils');
const { handleCommand } = require('../commands');

async function messageHandler(sock, { messages, type }) {
  if (type !== 'notify') return;
  const msg = messages[0];
  if (!msg?.message || msg.key.fromMe) return;

  const from      = msg.key.remoteJid;
  const isGroup   = from.endsWith('@g.us');
  const sender    = isGroup ? msg.key.participant : from;
  const senderNumber = sender?.split('@')[0];
  const botNumber = jidNormalizedUser(sock.user.id);
  const prefix    = config.PREFIX;

  // Dérouler les messages éphémères / view-once / document-with-caption
  const rawMsg = msg.message?.ephemeralMessage?.message
    || msg.message?.viewOnceMessage?.message
    || msg.message?.viewOnceMessageV2?.message?.message
    || msg.message?.documentWithCaptionMessage?.message
    || msg.message;

  const mtype = getContentType(rawMsg);
  const body = mtype === 'conversation'           ? rawMsg.conversation
    : mtype === 'imageMessage'                    ? rawMsg.imageMessage?.caption || ''
    : mtype === 'videoMessage'                    ? rawMsg.videoMessage?.caption || ''
    : mtype === 'extendedTextMessage'             ? rawMsg.extendedTextMessage?.text || ''
    : mtype === 'buttonsResponseMessage'          ? rawMsg.buttonsResponseMessage?.selectedButtonId || ''
    : mtype === 'listResponseMessage'             ? rawMsg.listResponseMessage?.singleSelectReply?.selectedRowId || ''
    : mtype === 'interactiveResponseMessage'      ? rawMsg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || ''
    : mtype === 'templateButtonReplyMessage'      ? rawMsg.templateButtonReplyMessage?.selectedId || ''
    : '';

  const isCmd = body.startsWith(prefix);
  if (!isCmd) return;

  const command = body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();
  const args    = body.trim().split(/ +/).slice(1);
  const text    = args.join(' ');
  const quoted  = rawMsg?.extendedTextMessage?.contextInfo?.quotedMessage;

  // Auto-typing
  if (config.AUTO_TYPING) {
    try { await sock.sendPresenceUpdate('composing', from); } catch (e) {}
  }

  // Helper pour répondre
  const reply = async (content) => {
    if (typeof content === 'string') {
      return sock.sendMessage(from, { text: content }, { quoted: msg });
    }
    return sock.sendMessage(from, content, { quoted: msg });
  };

  const sendImage = async (url, caption = '') => {
    return sock.sendMessage(from, { image: { url }, caption }, { quoted: msg });
  };

  const ctx = {
    sock, msg, from, sender, senderNumber, isGroup,
    args, text, quoted, reply, sendImage,
    command, prefix, botNumber,
    isOwner: isOwner(sender),
  };

  try {
    // ── MENU PRINCIPAL ────────────────────────────────────────
    if (command === 'menu' || command === 'help') {
      return await sendMainMenu(ctx);
    }

    // ── TOUTES LES COMMANDES (fichier commands.js) ────────────
    const handled = await handleCommand(ctx);
    if (handled === false) {
      await reply(`❌ Commande *${command}* introuvable.\nTape *${prefix}menu* pour voir les commandes.`);
    }
  } catch (err) {
    console.error(`[CMD:${command}] Erreur:`, err.message);
    await reply(`⚠️ Erreur lors de *${command}*.\n_${err.message}_`);
  } finally {
    if (config.AUTO_TYPING) {
      try { await sock.sendPresenceUpdate('paused', from); } catch (e) {}
    }
  }
}

async function sendMainMenu(ctx) {
  const { sock, from, msg } = ctx;
  const totalCmds = await countCommands();

  const menuText = `
╔══════════════════════╗
║  *DENTSU MD V7*  
╚══════════════════════╝

┌─────────────────────────
│ 🤖 *Nom Bot* : DENTSU MD
│ 📌 *Version* : V7
│ 👨‍💻 *Dev* : Natsu Tech
│ 📅 *Date* : ${getDate()}
│ ⏰ *Heure* : ${getTime()}
│ 👤 *User* : @${ctx.senderNumber}
│ 📊 *Commandes* : ${totalCmds}+
│ 🌐 *Mode* : ${config.MODE.toUpperCase()}
│ ⌨️ *Préfixe* : ${config.PREFIX}
│ 🖥️ *RAM* : ${getRam()}
│ 🌍 *Host* : ${getHost()}
│ 🔗 *Web* : ${config.WEBSITE}
└─────────────────────────

*📋 CATÉGORIES DE COMMANDES*

🧠 *AI MENU* → ${config.PREFIX}aimenu
👥 *GROUP MENU* → ${config.PREFIX}groupmenu
👑 *OWNER MENU* → ${config.PREFIX}ownermenu
🎉 *FUN MENU* → ${config.PREFIX}funmenu
🎮 *GAME MENU* → ${config.PREFIX}gamemenu
🎵 *SOUND MENU* → ${config.PREFIX}soundmenu
🔧 *OTHER MENU* → ${config.PREFIX}othermenu
📥 *DOWNLOADER* → ${config.PREFIX}dlmenu
📸 *MEDIA MENU* → ${config.PREFIX}mediamenu
🔍 *SEARCH MENU* → ${config.PREFIX}searchmenu
🖼️ *RANDOM IMAGE* → ${config.PREFIX}randommenu
🎌 *ANIME MENU* → ${config.PREFIX}animemenu

━━━━━━━━━━━━━━━━━━━━━
📢 *Canal* : ${config.CHANNEL_LINK}
💬 *Groupe* : ${config.GROUP_LINK}
✈️ *Telegram* : ${config.TELEGRAM}
━━━━━━━━━━━━━━━━━━━━━
${config.BOT_FOOTER}`;

  // Essai avec image, repli sur texte si l'image est inaccessible
  try {
    return await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: menuText,
      mentions: [ctx.sender],
    }, { quoted: msg });
  } catch (e) {
    return await sock.sendMessage(from, {
      text: menuText,
      mentions: [ctx.sender],
    }, { quoted: msg });
  }
}

module.exports = { messageHandler };
