const config = require('../config');
const { getContentType, jidNormalizedUser } = require('baileys');
const { getTime, getDate, getRam, getUptime, countCommands, getHost } = require('../lib/utils');
const { isOwner } = require('../lib/utils');
const { handleCommand } = require('../commands');

const NO_PREFIX_CMDS = new Set(['menu', 'help', 'aide', 'start', 'bot', 'commandes']);

async function messageHandler(sock, { messages, type }) {
  if (type !== 'notify') return;
  const msg = messages[0];
  if (!msg?.message) return;
  if (!sock.user) return;

  const from = msg.key.remoteJid;
  if (!from) return;
  if (from === 'status@broadcast') return;

  const isGroup    = from.endsWith('@g.us');
  const botJid     = jidNormalizedUser(sock.user.id);
  const botNumber  = sock.user.id.split(':')[0];
  const botFullJid = botNumber + '@s.whatsapp.net';

  const sender = isGroup
    ? (msg.key.fromMe ? botFullJid : (msg.key.participant || from))
    : (msg.key.fromMe ? botFullJid : from);
  const senderNumber = sender?.split('@')[0];

  const rawMsg = msg.message?.ephemeralMessage?.message
    || msg.message?.viewOnceMessage?.message
    || msg.message?.viewOnceMessageV2?.message?.message
    || msg.message?.documentWithCaptionMessage?.message
    || msg.message;

  const mtype = getContentType(rawMsg);
  const body =
    mtype === 'conversation'                 ? rawMsg.conversation
    : mtype === 'imageMessage'               ? rawMsg.imageMessage?.caption || ''
    : mtype === 'videoMessage'               ? rawMsg.videoMessage?.caption || ''
    : mtype === 'extendedTextMessage'        ? rawMsg.extendedTextMessage?.text || ''
    : mtype === 'buttonsResponseMessage'     ? rawMsg.buttonsResponseMessage?.selectedButtonId || ''
    : mtype === 'listResponseMessage'        ? rawMsg.listResponseMessage?.singleSelectReply?.selectedRowId || ''
    : mtype === 'templateButtonReplyMessage' ? rawMsg.templateButtonReplyMessage?.selectedId || ''
    : mtype === 'interactiveResponseMessage'
        ? (() => { try { return JSON.parse(rawMsg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '{}').id || ''; } catch { return ''; } })()
        : '';

  if (!body) return;

  const PREFIXES = config.PREFIXES || ['.', '!', '/', '#', '$'];
  let usedPrefix = '', command = '', args = [];
  for (const p of PREFIXES) {
    if (body.startsWith(p)) {
      usedPrefix = p;
      const parts = body.slice(p.length).trim().split(/\s+/);
      command = (parts.shift() || '').toLowerCase();
      args = parts;
      break;
    }
  }
  if (!command) {
    const lw = body.trim().toLowerCase();
    if (NO_PREFIX_CMDS.has(lw)) { command = lw; usedPrefix = ''; args = []; }
  }
  if (!command) return;

  const text   = args.join(' ');
  const quoted = rawMsg?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (config.AUTO_TYPING) {
    try { await sock.sendPresenceUpdate('composing', from); } catch (_) {}
  }

  const reply = async (content) => {
    if (typeof content === 'string') return sock.sendMessage(from, { text: content }, { quoted: msg });
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
    if (['menu','help','aide','start','bot','commandes'].includes(command)) {
      return await sendMainMenu(ctx);
    }
    const handled = await handleCommand(ctx);
    if (handled === false) {
      await reply(`❌ Commande *${command}* introuvable.\nTape *menu* ou *.menu* pour voir les commandes.`);
    }
  } catch (err) {
    console.error(`[CMD:${command}] Erreur:`, err.message);
    try { await reply(`⚠️ Erreur lors de *${command}*.\n_${err.message}_`); } catch (_) {}
  } finally {
    if (config.AUTO_TYPING) {
      try { await sock.sendPresenceUpdate('paused', from); } catch (_) {}
    }
  }
}

async function sendMainMenu(ctx) {
  const { sock, from, msg, senderNumber, sender } = ctx;

  const caption =
`┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃      🤖  *DENTSU MD V7*      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
┃ 📌 *Version*  :  V7
┃ 👨‍💻 *Dev*      :  Natsu Tech
┃ 📅 *Date*     :  ${getDate()}
┃ ⏰ *Heure*    :  ${getTime()}
┃ 👤 *User*     :  @${senderNumber}
┃ 🌐 *Mode*     :  ${config.MODE.toUpperCase()}
┃ 🖥️ *RAM*      :  ${getRam()}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━[ 📋 *COMMANDES* ]━━┓

1️⃣  ┃ ▸ 🧠 *AI*           →  *.aimenu*
2️⃣  ┃ ▸ 👥 *GROUPE*       →  *.groupmenu*
3️⃣  ┃ ▸ 👑 *OWNER*        →  *.ownermenu*
4️⃣  ┃ ▸ 🎉 *FUN*          →  *.funmenu*
5️⃣  ┃ ▸ 🎮 *GAME*         →  *.gamemenu*
6️⃣  ┃ ▸ 🎵 *SOUND*        →  *.soundmenu*
7️⃣  ┃ ▸ 🔧 *OTHER*        →  *.othermenu*
8️⃣  ┃ ▸ 📥 *DOWNLOADER*   →  *.dlmenu*
9️⃣  ┃ ▸ 📸 *MEDIA*        →  *.mediamenu*
🔟  ┃ ▸ 🔍 *SEARCH*        →  *.searchmenu*
1️⃣1️⃣ ┃ ▸ 🖼️ *RANDOM IMG*  →  *.randommenu*
1️⃣2️⃣ ┃ ▸ 🎌 *ANIME*       →  *.animemenu*

┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`;

  try {
    return await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption,
      mentions: [sender],
    }, { quoted: msg });
  } catch (_) {
    return await sock.sendMessage(from, { text: caption, mentions: [sender] }, { quoted: msg });
  }
}

module.exports = { messageHandler, sendMainMenu };
