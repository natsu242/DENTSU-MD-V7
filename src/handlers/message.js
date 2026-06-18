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
      await reply(`❌ Commande *${command}* introuvable.\nTape *.menu* pour voir toutes les commandes.`);
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
`╔╦══════════════════════╦╗
║║   ${config.BOT_NAME || 'DENTSU MD V7'}   ║║
╚╩══════════════════════╩╝

╔════[ 🤖 ʙᴏᴛ ɪɴғᴏ ]════╗
║ 👑 ᴏᴡɴᴇʀ : ${config.OWNER_NUMBER || 'DENTSU-MD'}
║ ⏱️ ʀᴜɴᴛɪᴍᴇ : ${getUptime()}
║ 📦 ᴘʀᴇғɪx : ${config.PREFIX}
║ ⚙️ ᴍᴏᴅᴇ : ${config.MODE}
║ 🏷️ ᴠᴇʀsɪᴏɴ : 7.0.0 Bᴇᴛᴀ
╚══════════════════════╝

╔══[ 🧠 ᴀɪ ]══╗
║ ▶ ai
║ ▶ gpt
║ ▶ gemini
║ ▶ deepseek
║ ▶ grok-ai
║ ▶ codeai
║ ▶ storyai
║ ▶ triviaai
║ ▶ photoai
╚══════════════════════╝
╔══[ 👥 ɢʀᴏᴜᴘᴇ ]══╗
║ ▶ tagall
║ ▶ hidetag
║ ▶ promote
║ ▶ demote
║ ▶ kick
║ ▶ add
║ ▶ mute
║ ▶ unmute
║ ▶ grouplink
║ ▶ resetlink
║ ▶ kickall
║ ▶ listadmins
║ ▶ groupinfo
║ ▶ subject
║ ▶ desc
║ ▶ left
║ ▶ join
║ ▶ poll
║ ▶ warn
║ ▶ lock
║ ▶ unlock
║ ▶ creategroup
╚══════════════════════╝
╔══[ 👑 ᴏᴡɴᴇʀ ]══╗
║ ▶ ping
║ ▶ alive
║ ▶ mode
║ ▶ block
║ ▶ unblock
║ ▶ broadcast
║ ▶ addsudo
║ ▶ delsudo
║ ▶ listsudo
║ ▶ listgc
║ ▶ leaveall
║ ▶ del
║ ▶ setbio
║ ▶ setname
║ ▶ vv
║ ▶ pair
║ ▶ admin
║ ▶ leave
║ ▶ newgc
║ ▶ ban1
║ ▶ unban1
║ ▶ sudo
║ ▶ listban
║ ▶ autoviewstatus
║ ▶ autotyping
╚══════════════════════╝
╔══[ 📥 ᴅᴏᴡɴʟᴏᴀᴅ ]══╗
║ ▶ ytmp3
║ ▶ ytb
║ ▶ song
║ ▶ play
║ ▶ mp4
║ ▶ fb
║ ▶ insta
║ ▶ tiktok
║ ▶ tiktok2
║ ▶ pint
║ ▶ apk
║ ▶ modapk
║ ▶ git
║ ▶ wastatus
║ ▶ drama
║ ▶ mega
║ ▶ autodownload
╚══════════════════════╝
╔══[ 📸 ᴍᴇᴅɪᴀ ]══╗
║ ▶ sticker
║ ▶ s
║ ▶ sticker2img
║ ▶ toimage
║ ▶ remini
║ ▶ couplepp
║ ▶ dewatermark
║ ▶ pies
║ ▶ removebg
║ ▶ circle
║ ▶ imageinfo
║ ▶ gcpp
║ ▶ qrcode
╚══════════════════════╝
╔══[ 🔍 sᴇᴀʀᴄʜ ]══╗
║ ▶ img
║ ▶ yts
║ ▶ iplookup
║ ▶ pinterestimg
║ ▶ lyrics
║ ▶ searchsticker
║ ▶ npm
║ ▶ github
║ ▶ npmstalk
║ ▶ ffstalk
║ ▶ simdata
║ ▶ screenshot
╚══════════════════════╝
╔══[ 🎉 ғᴜɴ ]══╗
║ ▶ truth
║ ▶ dare
║ ▶ joke
║ ▶ ship
║ ▶ rate
║ ▶ flirt
║ ▶ roast
║ ▶ compliment
║ ▶ 8ball
║ ▶ advice
║ ▶ quote
║ ▶ emoji
║ ▶ marige
║ ▶ bacha
║ ▶ bachi
║ ▶ breakup
║ ▶ husband
║ ▶ wife
║ ▶ propose
║ ▶ crush
║ ▶ kiss
║ ▶ hug
║ ▶ slap
║ ▶ dance
║ ▶ cry
║ ▶ cuddle
║ ▶ bully
║ ▶ pat
║ ▶ wink
║ ▶ smile
║ ▶ happy
║ ▶ angry
║ ▶ coinflip
║ ▶ flip
║ ▶ pick
║ ▶ repeat
║ ▶ send
║ ▶ character
║ ▶ compatibility
║ ▶ aura
║ ▶ lovetest
║ ▶ ringtone
╚══════════════════════╝
╔══[ 🎮 ɢᴀᴍᴇ ]══╗
║ ▶ rps
║ ▶ dice
║ ▶ coin
║ ▶ hangman
║ ▶ guess
║ ▶ math
║ ▶ emojiquiz
║ ▶ numberbattle
║ ▶ coinbattle
║ ▶ trivia
╚══════════════════════╝
╔══[ 🎵 sᴏᴜɴᴅ ]══╗
║ ▶ tts
║ ▶ say
║ ▶ bass
║ ▶ nightcore
║ ▶ reverse
║ ▶ robot
║ ▶ slow
║ ▶ fast
╚══════════════════════╝
╔══[ 🔧 ᴏᴛʜᴇʀ ]══╗
║ ▶ weather
║ ▶ wiki
║ ▶ currency
║ ▶ time
║ ▶ shorturl
║ ▶ myip
║ ▶ jid
║ ▶ imdb
║ ▶ dictionary
║ ▶ recipe
║ ▶ calculate
║ ▶ mathfact
║ ▶ sciencefact
║ ▶ horoscope
║ ▶ password
║ ▶ remind
║ ▶ news
║ ▶ cid
║ ▶ getpp
║ ▶ boost
╚══════════════════════╝
╔══[ 🖼️ ʀᴀɴᴅᴏᴍ ]══╗
║ ▶ chinagirl
║ ▶ boypic
║ ▶ random-girl
║ ▶ hijab-girl
║ ▶ indonesia-girl
║ ▶ japan-girl
║ ▶ korean-girl
║ ▶ bluearchive
║ ▶ indo
║ ▶ china
║ ▶ korea
║ ▶ thailand
║ ▶ vietnam
║ ▶ loli
║ ▶ japan
║ ▶ couple
║ ▶ romance
╚══════════════════════╝
╔══[ 🎌 ᴀɴɪᴍᴇ ]══╗
║ ▶ waifu
║ ▶ neko
║ ▶ kitsune
║ ▶ maid
║ ▶ animegirl
║ ▶ animeboy
║ ▶ catgirl
║ ▶ foxgirl
║ ▶ kawaii
║ ▶ chibi
║ ▶ idol
║ ▶ princess
║ ▶ warrior
║ ▶ samurai
║ ▶ demon
║ ▶ angel
║ ▶ vampire
║ ▶ dragon
║ ▶ magical
║ ▶ cyberpunk
║ ▶ ba
║ ▶ husbando
║ ▶ manga
║ ▶ cosplay
║ ▶ anime
╚══════════════════════╝
╔══[ 🕹️ ʙᴏʏᴅᴘ ]══╗
║ ▶ boydp1
║ ▶ boydp2
║ ▶ boydp3
║ ▶ boydp4
║ ▶ boydp5
║ ▶ boydp6
║ ▶ boydp7
║ ▶ boydp8
║ ▶ boydp9
║ ▶ boydp10
║ ▶ boydp11
║ ▶ boydp12
║ ▶ boydp13
║ ▶ boydp14
║ ▶ boydp15
║ ▶ boydp16
║ ▶ boydp17
║ ▶ boydp18
║ ▶ boydp19
║ ▶ boydp20
║ ▶ boydp21
║ ▶ boydp22
╚══════════════════════╝
╔══[ 👗 ɢɪʀʟᴅᴘ ]══╗
║ ▶ girldp1
║ ▶ girldp2
║ ▶ girldp3
║ ▶ girldp4
║ ▶ girldp5
║ ▶ girldp6
║ ▶ girldp7
║ ▶ girldp8
║ ▶ girldp9
║ ▶ girldp10
║ ▶ girldp11
║ ▶ girldp12
║ ▶ girldp13
║ ▶ girldp14
║ ▶ girldp15
║ ▶ girldp16
║ ▶ girldp17
║ ▶ girldp18
║ ▶ girldp19
║ ▶ girldp20
║ ▶ girldp21
║ ▶ girldp22
╚══════════════════════╝
╔══[ 💬 ᴍᴀɪɴ ]══╗
║ ▶ menu
║ ▶ alive
║ ▶ ping
║ ▶ uptime
║ ▶ owner
║ ▶ repo
║ ▶ bot
║ ▶ bomb
║ ▶ ping2
╚══════════════════════╝
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
