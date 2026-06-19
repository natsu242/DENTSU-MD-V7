const config = require('../config');
const { getContentType, jidNormalizedUser } = require('baileys');
const { getTime, getDate, getRam, getUptime } = require('../lib/utils');
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

  // — Auto audio response when bot is mentioned —
  const mentionedJids = rawMsg?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentionedJids.includes(botFullJid) || mentionedJids.includes(botNumber + ':0@s.whatsapp.net')) {
    try {
      await sock.sendMessage(from, {
        audio: { url: 'https://files.catbox.moe/z5ece4.ogg' },
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      }, { quoted: msg });
    } catch (_) {}
  }

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
    command, prefix: usedPrefix || config.PREFIX, botNumber,
    isOwner: isOwner(sender),
  };

  try {
    if (['menu','help','aide','start','bot','commandes'].includes(command)) {
      return await sendMainMenu(ctx);
    }
    const handled = await handleCommand(ctx);
    if (handled === false) {
      await reply(`❌ Command *${command}* not found.\nType *.menu* to see all commands.`);
    }
  } catch (err) {
    console.error(`[CMD:${command}]`, err.message);
    try { await reply(`⚠️ Error in *${command}*.\n_${err.message}_`); } catch (_) {}
  } finally {
    if (config.AUTO_TYPING) {
      try { await sock.sendPresenceUpdate('paused', from); } catch (_) {}
    }
  }
}

async function sendMainMenu(ctx) {
  const { sock, from, msg, senderNumber, sender } = ctx;

  // 🤖 Reaction on menu
  try {
    await sock.sendMessage(from, { react: { text: '🤖', key: msg.key } });
  } catch (_) {}

  const now = new Date();
  const caption =
`╔╦══════════════════════╦╗
║║    *DENTSU MD V7*    ║║
╚╩══════════════════════╩╝

────────────────────
*NameBot :* DENTSU MD
*Version :* V7
*Date    :* ${getDate()}
*Heure   :* ${getTime()}
*User    :* @${senderNumber}
*Mode    :* ${config.MODE.toUpperCase()}
*Ram     :* ${getRam()}
*Host    :* www.dentsu-md-v7.onrender.com
────────────────────

🌐 *Visit Website* → https://dentsu-md-v7.onrender.com
📋 *Prefix* → ${config.PREFIX}

╔══[ 👥 ɢʀᴏᴜᴘ ᴍᴇɴᴜ ]══╗
║ ▶ tagall ▶ hidetag ▶ promote
║ ▶ demote ▶ kick ▶ add
║ ▶ mute ▶ unmute ▶ left
║ ▶ grouplink ▶ resetlink
║ ▶ kickadmins ▶ kickall
║ ▶ listadmins ▶ listonline
║ ▶ opengc ▶ closegc
║ ▶ opentime ▶ closetime
║ ▶ antilink ▶ creategroup
║ ▶ join ▶ hijack ▶ admin
║ ▶ announce ▶ antibot
║ ▶ antighost ▶ antisticker
║ ▶ antiword ▶ approve
║ ▶ approveall ▶ desc
║ ▶ disappear ▶ everyone
║ ▶ groupinfo ▶ groupstats
║ ▶ gstatus ▶ invite ▶ lock
║ ▶ open ▶ poll ▶ protection
║ ▶ reject ▶ requests
║ ▶ revoke ▶ rtag ▶ setgpp
║ ▶ subject ▶ tagadmins
║ ▶ totag ▶ unlock ▶ warn
║ ▶ warncount ▶ warnreset
║ ▶ welcome ▶ goodbye
╚══════════════════════╝
╔══[ 👑 ᴏᴡɴᴇʀ ᴍᴇɴᴜ ]══╗
║ ▶ setpp ▶ ban ▶ unban
║ ▶ self ▶ public ▶ autoread
║ ▶ autobio ▶ autorecording
║ ▶ autotyping ▶ autoviewstatus
║ ▶ autoreact ▶ block ▶ unblock
║ ▶ delete ▶ setaccount
║ ▶ addsudo ▶ delsudo ▶ listsudo
║ ▶ fixowner ▶ getbot ▶ vv ▶ vv2
║ ▶ broadcast ▶ mode
║ ▶ ping ▶ alive ▶ runtime
╚══════════════════════╝
╔══[ 🎉 ғᴜɴ ᴍᴇɴᴜ ]══╗
║ ▶ truth ▶ dare ▶ joke
║ ▶ ship ▶ rate ▶ flirt
║ ▶ roast ▶ compliment
║ ▶ 8ball ▶ advice ▶ quote
║ ▶ emoji ▶ marige ▶ bacha
║ ▶ bachi ▶ breakup ▶ husband
║ ▶ wife ▶ propose ▶ crush
║ ▶ kiss ▶ hug ▶ slap ▶ dance
║ ▶ cry ▶ cuddle ▶ bully
║ ▶ pat ▶ wink ▶ smile
║ ▶ happy ▶ angry ▶ coinflip
║ ▶ flip ▶ pick ▶ repeat
║ ▶ send ▶ character
║ ▶ compatibility ▶ aura
║ ▶ lovetest ▶ ringtone
╚══════════════════════╝
╔══[ 🧠 ᴀɪ ᴍᴇɴᴜ ]══╗
║ ▶ ai ▶ gpt ▶ gpt4 ▶ gpt5
║ ▶ metaai ▶ aiimg ▶ codeai
║ ▶ photoai ▶ storyai
║ ▶ triviaai ▶ deepseek
║ ▶ grok-ai ▶ qwen ▶ gemini
╚══════════════════════╝
╔══[ 🔍 sᴇᴀʀᴄʜ ᴍᴇɴᴜ ]══╗
║ ▶ img ▶ yts ▶ iplookup
║ ▶ pinterestimg ▶ lyrics
║ ▶ searchsticker ▶ npm
║ ▶ github ▶ npmstalk
║ ▶ ffstalk ▶ simdata
║ ▶ screenshot
╚══════════════════════╝
╔══[ 🎮 ɢᴀᴍᴇ ᴍᴇɴᴜ ]══╗
║ ▶ rps ▶ dice ▶ coin
║ ▶ coinbattle ▶ numberbattle
║ ▶ numbattle ▶ hangman
║ ▶ tictactoe ▶ guess
║ ▶ math ▶ emojiquiz
╚══════════════════════╝
╔══[ 🎵 sᴏᴜɴᴅ ᴍᴇɴᴜ ]══╗
║ ▶ bass ▶ blown ▶ deep
║ ▶ earrape ▶ fast
║ ▶ nightcore ▶ reverse
║ ▶ robot ▶ slow ▶ smooth
║ ▶ squirrel ▶ tts ▶ say
╚══════════════════════╝
╔══[ 🔧 ᴏᴛʜᴇʀ ᴍᴇɴᴜ ]══╗
║ ▶ weather ▶ wiki ▶ currency
║ ▶ time ▶ qrcode ▶ readqr
║ ▶ shorturl ▶ getbot ▶ jid
║ ▶ getpp ▶ github ▶ npm
║ ▶ createcase ▶ getcase
║ ▶ dictionary ▶ recipe ▶ book
║ ▶ remind ▶ calculate
║ ▶ mathfact ▶ sciencefact
║ ▶ horoscope ▶ password
║ ▶ genpass ▶ readmore
║ ▶ idch ▶ cekidch
╚══════════════════════╝
╔══[ 🖼️ ʀᴀɴᴅᴏᴍ ɪᴍᴀɢᴇ ]══╗
║ ▶ hentai ▶ chinagirl
║ ▶ bluearchive ▶ boypic
║ ▶ carimage ▶ random-girl
║ ▶ hijab-girl ▶ indonesia-girl
║ ▶ japan-girl ▶ korean-girl
╚══════════════════════╝
╔══[ 🎌 ᴀɴɪᴍᴇ ᴍᴇɴᴜ ]══╗
║ ▶ waifu ▶ neko ▶ kitsune
║ ▶ maid ▶ animegirl ▶ animeboy
║ ▶ catgirl ▶ foxgirl ▶ kawaii
║ ▶ chibi ▶ idol ▶ princess
║ ▶ warrior ▶ samurai ▶ demon
║ ▶ angel ▶ vampire ▶ dragon
║ ▶ magical ▶ cyberpunk ▶ ba
║ ▶ husbando ▶ manga ▶ cosplay
║ ▶ anime ▶ hentail
╚══════════════════════╝
╔══[ 📥 ᴅᴏᴡɴʟᴏᴀᴅᴇʀ ]══╗
║ ▶ apk ▶ edit ▶ fb
║ ▶ git ▶ gitclone ▶ insta
║ ▶ mega ▶ mp4 ▶ img
║ ▶ wiki ▶ yts ▶ calc
║ ▶ circle ▶ get ▶ shorturl
║ ▶ tomp3 ▶ pint ▶ play ▶ song
║ ▶ video ▶ yta ▶ ytmp3
║ ▶ ytb/youtube ▶ tt/tiktok
║ ▶ aiimg
╚══════════════════════╝
╔══[ 📸 ᴍᴇᴅɪᴀ ᴍᴇɴᴜ ]══╗
║ ▶ imagehelp ▶ imageinfo
║ ▶ remini ▶ sticker/s
║ ▶ stickertoimg ▶ take
║ ▶ toimage ▶ videotoimg
╚══════════════════════╝
╔══[ ✨ ᴇᴘʜᴏᴛᴏ ᴍᴇɴᴜ ]══╗
║ ▶ glitchtext ▶ writetext
║ ▶ advancedglow ▶ typographytext
║ ▶ pixelglitch ▶ neonglitch
║ ▶ flagtext ▶ flag3dtext
║ ▶ deletingtext ▶ blackpinkstyle
║ ▶ glowingtext ▶ underwatertext
║ ▶ logomaker ▶ cartoonstyle
║ ▶ papercutstyle ▶ watercolortext
║ ▶ effectclouds ▶ blackpinklogo
║ ▶ gradienttext ▶ summerbeach
║ ▶ luxurygold ▶ multicoloredneon
║ ▶ sandsummer ▶ galaxywallpaper
║ ▶ style1917 ▶ makingneon
║ ▶ royaltext ▶ freecreate
║ ▶ galaxystyle ▶ createlogo
║ ▶ lighteffects
╚══════════════════════╝
╔══[ ♉ ʟᴏɢᴏ ᴍᴇɴᴜ ]══╗
║ ▶ gfx ▶ gfx2 ▶ gfx3
║ ▶ gfx4 ▶ gfx5 ▶ gfx6
║ ▶ gfx7 ▶ gfx8 ▶ gfx9
║ ▶ gfx10 ▶ gfx11 ▶ gfx12
╚══════════════════════╝
╔══[ 🛠️ ᴛᴏᴏʟ ᴍᴇɴᴜ ]══╗
║ ▶ anticall ▶ antidelete
║ ▶ antiedit ▶ antistickerk
║ ▶ autodownload ▶ autoread
║ ▶ autorecord ▶ autostatus
║ ▶ autotyping ▶ block
║ ▶ blocklist ▶ shorturl
║ ▶ tourl ▶ url ▶ broadcast
║ ▶ del ▶ delme ▶ forward
║ ▶ getbio ▶ getname ▶ jid
║ ▶ leaveall ▶ listgc ▶ mode
║ ▶ myname ▶ myprivacy
║ ▶ mystatus ▶ quoted
║ ▶ removepp ▶ save ▶ setbio
║ ▶ setname ▶ setpp ▶ unblock
║ ▶ unblockall ▶ whois
╚══════════════════════╝

🌐 *Visit Website* → https://dentsu-md-v7.onrender.com
📋 *Copy Prefix* → ${config.PREFIX}
> NatsuTech's Dev 🇨🇬`;

  try {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption,
      mentions: [sender],
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363423640959729@newsletter',
          newsletterName: 'DENTSU MD',
          serverMessageId: -1,
        },
      },
    }, { quoted: msg });
  } catch (_) {
    await sock.sendMessage(from, { text: caption, mentions: [sender] }, { quoted: msg });
  }
}

module.exports = { messageHandler, sendMainMenu };
