const config = require('./config');
const axios = require('axios');
const { delay, getContentType, downloadMediaMessage } = require('baileys');
const store = require('./lib/store');

// ─── ÉTAT DES JEUX ───────────────────────────────────────────────
const activeGames = new Map();
const mathGames   = new Map();
const guessGames  = new Map();
const sudoList    = new Set();
const blocklist   = new Set();
const warnStore   = new Map();

// ─── HELPER : envoyer menu avec image Natsu ─────────────────────
async function sendMenu(sock, from, msg, caption) {
  try {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption,
    }, { quoted: msg });
  } catch (e) {
    // Fallback texte si l'image échoue
    try { await sock.sendMessage(from, { text: caption }, { quoted: msg }); }
    catch (e2) { console.error('[sendMenu] Erreur:', e2.message); }
  }
}

// ─── HELPER : vérifier admin ─────────────────────────────────────
async function isAdmin(sock, from, jid) {
  try {
    const meta = await sock.groupMetadata(from);
    return meta.participants.find(p => p.id === jid)?.admin != null;
  } catch (e) { return false; }
}

async function isBotAdmin(sock, from) {
  try {
    const meta = await sock.groupMetadata(from);
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    return meta.participants.find(p => p.id === botId)?.admin != null;
  } catch (e) { return false; }
}

function getMentioned(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

// ─── HELPER : appel IA ───────────────────────────────────────────
async function callFreeAI(question) {
  try {
    const res = await axios.get(`https://api.simsimi.vip/v1/simtalk?text=${encodeURIComponent(question)}&lc=fr`);
    return res.data?.success || 'Désolé, je ne peux pas répondre pour le moment.';
  } catch (e) {
    try {
      const res2 = await axios.get(`https://api.ryzendesu.vip/api/ai/chatgpt?text=${encodeURIComponent(question)}`);
      return res2.data?.answer || res2.data?.response || 'Je ne peux pas répondre maintenant.';
    } catch (e2) {
      return '🤖 *IA temporairement indisponible*\nEssaie plus tard.';
    }
  }
}

// ─── HELPER : image aléatoire ────────────────────────────────────
async function getRandomImage(category) {
  const apis = {
    'chinagirl':      ['https://api.ryzendesu.vip/api/img/china',  'https://api.waifu.pics/sfw/waifu'],
    'hijab-girl':     ['https://api.ryzendesu.vip/api/img/hijab'],
    'indonesia-girl': ['https://api.ryzendesu.vip/api/img/indo'],
    'japan-girl':     ['https://api.ryzendesu.vip/api/img/japan',  'https://api.waifu.pics/sfw/waifu'],
    'korean-girl':    ['https://api.ryzendesu.vip/api/img/korea'],
    'carimage':       ['https://api.ryzendesu.vip/api/img/car'],
    'boypic':         ['https://api.ryzendesu.vip/api/img/boy'],
    'bluearchive':    ['https://api.waifu.pics/sfw/waifu'],
    'random-girl':    ['https://api.waifu.pics/sfw/neko', 'https://api.waifu.pics/sfw/waifu'],
  };
  const urls = apis[category] || ['https://api.waifu.pics/sfw/waifu'];
  for (const url of urls) {
    try {
      const res = await axios.get(url);
      const imgUrl = res.data?.url || res.data?.image || res.data?.data?.url;
      if (imgUrl) return imgUrl;
    } catch (e) {}
  }
  return null;
}

// ─── TEXTES DES MENUS ────────────────────────────────────────────
const MENUS = {
  aimenu: `┏━━━━━━[ 🧠 *AI MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}ai [question]
┃  ▸ ${config.PREFIX}gpt [question]
┃  ▸ ${config.PREFIX}gemini [question]
┃  ▸ ${config.PREFIX}deepseek [question]
┃  ▸ ${config.PREFIX}grok-ai [question]
┃  ▸ ${config.PREFIX}codeai [code]
┃  ▸ ${config.PREFIX}storyai [thème]
┃  ▸ ${config.PREFIX}triviaai
┃  ▸ ${config.PREFIX}photoai [description]
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  groupmenu: `┏━━━━━━[ 👥 *GROUPE MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}tagall [msg]
┃  ▸ ${config.PREFIX}hidetag [msg]
┃  ▸ ${config.PREFIX}promote @user
┃  ▸ ${config.PREFIX}demote @user
┃  ▸ ${config.PREFIX}kick @user
┃  ▸ ${config.PREFIX}add numéro
┃  ▸ ${config.PREFIX}mute / ${config.PREFIX}unmute
┃  ▸ ${config.PREFIX}grouplink
┃  ▸ ${config.PREFIX}resetlink
┃  ▸ ${config.PREFIX}kickall
┃  ▸ ${config.PREFIX}listadmins
┃  ▸ ${config.PREFIX}groupinfo
┃  ▸ ${config.PREFIX}subject [nom]
┃  ▸ ${config.PREFIX}desc [description]
┃  ▸ ${config.PREFIX}left
┃  ▸ ${config.PREFIX}join [lien]
┃  ▸ ${config.PREFIX}poll Question | Op1 | Op2
┃  ▸ ${config.PREFIX}warn @user
┃  ▸ ${config.PREFIX}lock / ${config.PREFIX}unlock
┃  ▸ ${config.PREFIX}creategroup [nom]
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  ownermenu: `┏━━━━━━[ 👑 *OWNER MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}ping
┃  ▸ ${config.PREFIX}alive
┃  ▸ ${config.PREFIX}mode public/self
┃  ▸ ${config.PREFIX}block @user
┃  ▸ ${config.PREFIX}unblock @user
┃  ▸ ${config.PREFIX}broadcast [msg]
┃  ▸ ${config.PREFIX}addsudo @user
┃  ▸ ${config.PREFIX}delsudo @user
┃  ▸ ${config.PREFIX}listsudo
┃  ▸ ${config.PREFIX}listgc
┃  ▸ ${config.PREFIX}leaveall
┃  ▸ ${config.PREFIX}del (reply)
┃  ▸ ${config.PREFIX}autoviewstatus on/off
┃  ▸ ${config.PREFIX}autotyping on/off
┃  ▸ ${config.PREFIX}autorecording on/off
┃  ▸ ${config.PREFIX}setbio [texte]
┃  ▸ ${config.PREFIX}setname [nom]
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  funmenu: `┏━━━━━━[ 🎉 *FUN MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}truth
┃  ▸ ${config.PREFIX}dare
┃  ▸ ${config.PREFIX}joke
┃  ▸ ${config.PREFIX}ship @user1 @user2
┃  ▸ ${config.PREFIX}rate [chose]
┃  ▸ ${config.PREFIX}flirt @user
┃  ▸ ${config.PREFIX}roast @user
┃  ▸ ${config.PREFIX}compliment @user
┃  ▸ ${config.PREFIX}wouldyou
┃  ▸ ${config.PREFIX}8ball [question]
┃  ▸ ${config.PREFIX}advice
┃  ▸ ${config.PREFIX}urban [mot]
┃  ▸ ${config.PREFIX}triviafact
┃  ▸ ${config.PREFIX}inspire
┃  ▸ ${config.PREFIX}ascii [texte]
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  gamemenu: `┏━━━━━━[ 🎮 *GAME MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}rps [pierre/feuille/ciseaux]
┃  ▸ ${config.PREFIX}dice
┃  ▸ ${config.PREFIX}coin
┃  ▸ ${config.PREFIX}coinbattle @user
┃  ▸ ${config.PREFIX}numberbattle @user
┃  ▸ ${config.PREFIX}hangman
┃  ▸ ${config.PREFIX}lettre [lettre]
┃  ▸ ${config.PREFIX}guess
┃  ▸ ${config.PREFIX}g [nombre]
┃  ▸ ${config.PREFIX}math
┃  ▸ ${config.PREFIX}rep [réponse]
┃  ▸ ${config.PREFIX}emojiquiz
┃  ▸ ${config.PREFIX}ans [réponse]
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  soundmenu: `┏━━━━━━[ 🎵 *SOUND MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}tts [texte]
┃  ▸ ${config.PREFIX}say [texte]
┃  ▸ ${config.PREFIX}bass (reply audio)
┃  ▸ ${config.PREFIX}nightcore (reply audio)
┃  ▸ ${config.PREFIX}reverse (reply audio)
┃  ▸ ${config.PREFIX}robot (reply audio)
┃  ▸ ${config.PREFIX}slow (reply audio)
┃  ▸ ${config.PREFIX}fast (reply audio)
┃
┃  ⚠️ FFmpeg requis pour effets audio
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  othermenu: `┏━━━━━━[ 🔧 *OTHER MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}weather [ville]
┃  ▸ ${config.PREFIX}wiki [recherche]
┃  ▸ ${config.PREFIX}currency [montant] [de] [vers]
┃  ▸ ${config.PREFIX}time [ville]
┃  ▸ ${config.PREFIX}qrcode [texte]
┃  ▸ ${config.PREFIX}shorturl [url]
┃  ▸ ${config.PREFIX}myip
┃  ▸ ${config.PREFIX}jid
┃  ▸ ${config.PREFIX}github [username]
┃  ▸ ${config.PREFIX}npm [package]
┃  ▸ ${config.PREFIX}imdb [film]
┃  ▸ ${config.PREFIX}dictionary [mot]
┃  ▸ ${config.PREFIX}recipe [plat]
┃  ▸ ${config.PREFIX}remind [minutes] [message]
┃  ▸ ${config.PREFIX}calculate [calcul]
┃  ▸ ${config.PREFIX}mathfact [nombre]
┃  ▸ ${config.PREFIX}sciencefact
┃  ▸ ${config.PREFIX}horoscope [signe]
┃  ▸ ${config.PREFIX}password [longueur]
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  dlmenu: `┏━━━━━━[ 📥 *DOWNLOADER* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}ytmp3 [url/titre]
┃  ▸ ${config.PREFIX}ytb [url]
┃  ▸ ${config.PREFIX}song [titre]
┃  ▸ ${config.PREFIX}play [titre]
┃  ▸ ${config.PREFIX}mp4 [url]
┃  ▸ ${config.PREFIX}fb [url]
┃  ▸ ${config.PREFIX}insta [url]
┃  ▸ ${config.PREFIX}pint [url]
┃  ▸ ${config.PREFIX}apk [nom app]
┃  ▸ ${config.PREFIX}git [user/repo]
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  mediamenu: `┏━━━━━━[ 📸 *MEDIA MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}sticker (reply image/vidéo)
┃  ▸ ${config.PREFIX}s (reply image/vidéo)
┃  ▸ ${config.PREFIX}sticker2img (reply sticker)
┃  ▸ ${config.PREFIX}toimage (reply sticker)
┃  ▸ ${config.PREFIX}remini (reply image)
┃  ▸ ${config.PREFIX}imageinfo (reply image)
┃  ▸ ${config.PREFIX}qrcode [texte]
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  searchmenu: `┏━━━━━━[ 🔍 *SEARCH MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}img [recherche]
┃  ▸ ${config.PREFIX}yts [titre]
┃  ▸ ${config.PREFIX}iplookup [ip]
┃  ▸ ${config.PREFIX}circle [url image]
┃  ▸ ${config.PREFIX}get [url]
┃  ▸ ${config.PREFIX}currency [montant] [de] [vers]
┃  ▸ ${config.PREFIX}time [ville]
┃  ▸ ${config.PREFIX}ffstalk [uid FF]
┃  ▸ ${config.PREFIX}npmstalk [package]
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  randommenu: `┏━━━━━━[ 🖼️ *RANDOM IMAGE* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}chinagirl
┃  ▸ ${config.PREFIX}bluearchive
┃  ▸ ${config.PREFIX}boypic
┃  ▸ ${config.PREFIX}carimage
┃  ▸ ${config.PREFIX}random-girl
┃  ▸ ${config.PREFIX}hijab-girl
┃  ▸ ${config.PREFIX}indonesia-girl
┃  ▸ ${config.PREFIX}japan-girl
┃  ▸ ${config.PREFIX}korean-girl
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,

  animemenu: `┏━━━━━━[ 🎌 *ANIME MENU* ]━━━━━━┓
┃
┃  ▸ ${config.PREFIX}achar [personnage]
┃  ▸ ${config.PREFIX}aquote
┃  ▸ ${config.PREFIX}arecommend
┃  ▸ ${config.PREFIX}asearch [anime]
┃  ▸ ${config.PREFIX}anime [nom]
┃  ▸ ${config.PREFIX}manga [nom]
┃  ▸ ${config.PREFIX}lyrics [chanson]
┃  ▸ ${config.PREFIX}loli
┃  ▸ ${config.PREFIX}maid
┃  ▸ ${config.PREFIX}neko
┃  ▸ ${config.PREFIX}waifu
┃  ▸ ${config.PREFIX}shinobu
┃  ▸ ${config.PREFIX}megumin
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛
${config.BOT_FOOTER}`,
};

// ─── DONNÉES STATIQUES ───────────────────────────────────────────
const truths = [
  "Quelle est ta plus grande peur ?",
  "Quel est ton secret le plus embarrassant ?",
  "As-tu déjà menti à un ami proche ?",
  "Quelle est la chose la plus stupide que tu aies faite ?",
  "Qui est ton crush en ce moment ?",
  "Quelle est ta plus grande faiblesse ?",
  "Quel est ton plus grand regret ?",
];
const dares = [
  "Envoie ton selfie le plus bizarre !",
  "Chante une chanson et envoie l'audio !",
  "Écris un poème en 2 minutes et envoie-le !",
  "Imite un animal et envoie l'audio !",
  "Envoie une blague nulle à 5 amis !",
];
const jokes = [
  "Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tomberaient dans le bateau ! 😂",
  "Qu'est-ce qu'un canif ? C'est le petit frère du canard ! 🦆",
  "Pourquoi les squelettes ne se battent jamais ? Ils n'ont pas le cœur à ça ! 💀",
  "Que dit un oignon quand il se baigne ? Oh! un bain! 🧅",
  "Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ? Un chat-peint de Noël ! 🐱",
];
const quotes = [
  "\"La vie est courte, souris pendant qu'il te reste des dents.\" - Inconnu",
  "\"Le succès c'est aller d'échec en échec sans perdre son enthousiasme.\" - Churchill",
  "\"L'imagination est plus importante que le savoir.\" - Einstein",
  "\"La seule façon de faire du bon travail est d'aimer ce que tu fais.\" - Steve Jobs",
];
const flirts = [
  "✨ Tu es si beau(belle) que même les étoiles te demandent ton secret !",
  "💖 Si la beauté était un crime, tu serais condamné(e) à perpétuité !",
  "🌹 Chaque fois que je te vois, je comprends pourquoi le soleil brille !",
];
const roasts = [
  "😂 T'es tellement lent(e) que tu mettrais 2h à regarder 60 minutes !",
  "🤣 Ton cerveau fonctionne comme un PC Windows 95 !",
  "💀 Si la bêtise était douloureuse, tu crierais 24h/24 !",
];
const hangmanWords = ['javascript','python','elephant','ordinateur','programmation','whatsapp','internet','telephone','developpeur','application'];

// ─── HANDLER PRINCIPAL ───────────────────────────────────────────
async function handleCommand(ctx) {
  const { command, text, reply, sock, from, msg, sender, senderNumber, isGroup, args, isOwner: ownerCheck } = ctx;

  switch (command) {

    // ════════════════════════════════════════════════════════════
    //  📋  SOUS-MENUS (tous en case explicite)
    // ════════════════════════════════════════════════════════════
    case 'aimenu': {
      return sendMenu(sock, from, msg, MENUS.aimenu);
    }

    case 'groupmenu': {
      return sendMenu(sock, from, msg, MENUS.groupmenu);
    }

    case 'ownermenu': {
      return sendMenu(sock, from, msg, MENUS.ownermenu);
    }

    case 'funmenu': {
      return sendMenu(sock, from, msg, MENUS.funmenu);
    }

    case 'gamemenu': {
      return sendMenu(sock, from, msg, MENUS.gamemenu);
    }

    case 'soundmenu': {
      return sendMenu(sock, from, msg, MENUS.soundmenu);
    }

    case 'othermenu': {
      return sendMenu(sock, from, msg, MENUS.othermenu);
    }

    case 'dlmenu': {
      return sendMenu(sock, from, msg, MENUS.dlmenu);
    }

    case 'mediamenu': {
      return sendMenu(sock, from, msg, MENUS.mediamenu);
    }

    case 'searchmenu': {
      return sendMenu(sock, from, msg, MENUS.searchmenu);
    }

    case 'randommenu': {
      return sendMenu(sock, from, msg, MENUS.randommenu);
    }

    case 'animemenu': {
      return sendMenu(sock, from, msg, MENUS.animemenu);
    }

    // ════════════════════════════════════════════════════════════
    //  🏓  UTILITAIRES DE BASE
    // ════════════════════════════════════════════════════════════
    case 'ping': {
      const start = Date.now();
      await reply('🏓 Pong!');
      return reply(`✅ *Ping*: ${Date.now() - start}ms\n\n${config.BOT_FOOTER}`);
    }

    case 'alive':
    case 'status':
    case 'botinfo': {
      return reply(`✅ *${config.BOT_NAME}*\n\n🟢 En ligne!\n👨‍💻 Dev: ${config.DEV_NAME}\n🌐 Mode: ${config.MODE.toUpperCase()}\n\n${config.BOT_FOOTER}`);
    }

    // ════════════════════════════════════════════════════════════
    //  🧠  IA
    // ════════════════════════════════════════════════════════════
    case 'ai':
    case 'gpt':
    case 'gpt4':
    case 'gpt5':
    case 'metaai':
    case 'deepseek':
    case 'qwen':
    case 'grok-ai': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [question]`);
      await reply('🤖 Traitement en cours...');
      const resp = await callFreeAI(text);
      return reply(`🧠 *${command.toUpperCase()}*\n\n${resp}\n\n${config.BOT_FOOTER}`);
    }

    case 'gemini': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}gemini [question]`);
      await reply('✨ Gemini pense...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(text)}`);
        const ans = res.data?.answer || res.data?.response || 'Pas de réponse.';
        return reply(`✨ *Gemini AI*\n\n${ans}\n\n${config.BOT_FOOTER}`);
      } catch (e) {
        return reply(`✨ *Gemini AI*\n\n${await callFreeAI(text)}\n\n${config.BOT_FOOTER}`);
      }
    }

    case 'codeai': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}codeai [code/question]`);
      await reply('💻 Analyse du code...');
      const resp = await callFreeAI(`Expert développeur: ${text}`);
      return reply(`💻 *Code AI*\n\n\`\`\`${resp}\`\`\`\n\n${config.BOT_FOOTER}`);
    }

    case 'storyai': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}storyai [thème]`);
      await reply('📖 Création d\'histoire...');
      const resp = await callFreeAI(`Écris une courte histoire sur: ${text}`);
      return reply(`📖 *Story AI*\n\n${resp}\n\n${config.BOT_FOOTER}`);
    }

    case 'triviaai': {
      await reply('🎯 Génération...');
      const resp = await callFreeAI('Donne une question de culture générale avec sa réponse');
      return reply(`🎯 *Trivia AI*\n\n${resp}\n\n${config.BOT_FOOTER}`);
    }

    case 'photoai': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}photoai [description]`);
      return reply(`🖼️ *Photo AI*\n\n"${text}"\n\n⚠️ Génération d'images = API premium.\nVisite: ${config.WEBSITE}\n\n${config.BOT_FOOTER}`);
    }

    // ════════════════════════════════════════════════════════════
    //  👥  GROUPE
    // ════════════════════════════════════════════════════════════
    case 'tagall':
    case 'everyone':
    case 'rtag':
    case 'totag': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      try {
        const meta = await sock.groupMetadata(from);
        const mentions = meta.participants.map(m => m.id);
        await sock.sendMessage(from, {
          text: `📢 *${text || 'Attention tout le monde!'}*\n\n${meta.participants.map(m => `@${m.id.split('@')[0]}`).join(' ')}`,
          mentions
        });
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'hidetag': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      try {
        const meta = await sock.groupMetadata(from);
        await sock.sendMessage(from, { text: text || '📢 Message', mentions: meta.participants.map(m => m.id) });
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'promote': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      try {
        await sock.groupParticipantsUpdate(from, mentioned, 'promote');
        reply(`✅ @${mentioned[0].split('@')[0]} promu admin!`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'demote': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      try {
        await sock.groupParticipantsUpdate(from, mentioned, 'demote');
        reply(`✅ @${mentioned[0].split('@')[0]} rétrogradé!`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'kick': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      try {
        await sock.groupParticipantsUpdate(from, mentioned, 'remove');
        reply(`✅ @${mentioned[0].split('@')[0]} expulsé!`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'add': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      if (!args[0]) return reply('❌ Usage: .add 242XXXXXXX');
      const num = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
      try {
        await sock.groupParticipantsUpdate(from, [num], 'add');
        reply(`✅ ${args[0]} ajouté!`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'mute':
    case 'closegc': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      try {
        await sock.groupSettingUpdate(from, 'announcement');
        reply('🔇 Groupe muté (admins seulement)');
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'unmute':
    case 'opengc': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      try {
        await sock.groupSettingUpdate(from, 'not_announcement');
        reply('🔊 Groupe ouvert à tous!');
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'grouplink':
    case 'invite': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      try {
        const link = await sock.groupInviteCode(from);
        reply(`🔗 Lien:\nhttps://chat.whatsapp.com/${link}`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'resetlink':
    case 'revoke': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      try {
        await sock.groupRevokeInvite(from);
        const link = await sock.groupInviteCode(from);
        reply(`✅ Nouveau lien:\nhttps://chat.whatsapp.com/${link}`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'kickall': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      try {
        const meta = await sock.groupMetadata(from);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const ownerJid = config.OWNER_NUMBER + '@s.whatsapp.net';
        const members = meta.participants.filter(p => p.id !== botId && p.id !== ownerJid).map(p => p.id);
        for (const m of members) {
          try { await sock.groupParticipantsUpdate(from, [m], 'remove'); await delay(500); } catch (e2) {}
        }
        reply(`✅ ${members.length} membres expulsés!`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'listadmins': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      try {
        const meta = await sock.groupMetadata(from);
        const admins = meta.participants.filter(p => p.admin);
        reply(`👑 *Admins*\n\n${admins.map(a => `• @${a.id.split('@')[0]}`).join('\n')}`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'groupinfo': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      try {
        const meta = await sock.groupMetadata(from);
        reply(`📋 *Info Groupe*\n\n📌 Nom: ${meta.subject}\n👥 Membres: ${meta.participants.length}\n👑 Admins: ${meta.participants.filter(p => p.admin).length}\n📝 Desc: ${meta.desc || 'Aucune'}\n🆔 ID: ${from}`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'subject': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      if (!text) return reply('❌ Donne un nom!');
      try {
        await sock.groupUpdateSubject(from, text);
        reply(`✅ Nom changé: *${text}*`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'desc': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      if (!text) return reply('❌ Donne une description!');
      try {
        await sock.groupUpdateDescription(from, text);
        reply('✅ Description mise à jour!');
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'left':
    case 'leave': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      try { await sock.groupLeave(from); } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'join': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      if (!text) return reply('❌ Donne le lien du groupe!');
      const code = text.split('chat.whatsapp.com/').pop() || text;
      try {
        await sock.groupAcceptInvite(code);
        reply('✅ Groupe rejoint!');
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'poll': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      const parts = text.split('|').map(s => s.trim());
      if (parts.length < 3) return reply('❌ Usage: .poll Question | Option1 | Option2');
      const [question, ...options] = parts;
      try {
        await sock.sendMessage(from, { poll: { name: question, values: options, selectableCount: 1 } });
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'warn': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      const key = from + '_' + mentioned[0];
      const count = (warnStore.get(key) || 0) + 1;
      warnStore.set(key, count);
      if (count >= 3) {
        try { await sock.groupParticipantsUpdate(from, [mentioned[0]], 'remove'); } catch (_) {}
        warnStore.delete(key);
        return reply(`⛔ @${mentioned[0].split('@')[0]} expulsé après 3 avertissements!`);
      }
      return reply(`⚠️ *Avertissement ${count}/3*\n\n@${mentioned[0].split('@')[0]}\nRaison: ${text || 'Non précisée'}`);
    }

    case 'lock': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      try { await sock.groupSettingUpdate(from, 'locked'); reply('🔒 Groupe verrouillé!'); }
      catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'unlock': {
      if (!isGroup) return reply('❌ Réservé aux groupes!');
      if (!await isBotAdmin(sock, from)) return reply('❌ Le bot doit être admin!');
      try { await sock.groupSettingUpdate(from, 'unlocked'); reply('🔓 Groupe déverrouillé!'); }
      catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'creategroup': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      if (!text) return reply('❌ Donne un nom au groupe!');
      try {
        await sock.groupCreate(text, [sender]);
        reply(`✅ Groupe "${text}" créé!`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    // ════════════════════════════════════════════════════════════
    //  👑  OWNER / ADMIN BOT
    // ════════════════════════════════════════════════════════════
    case 'mode': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      const val = text?.toLowerCase();
      if (val === 'self') { config.MODE = 'self'; return reply('✅ Mode SELF activé!'); }
      if (val === 'public') { config.MODE = 'public'; return reply('✅ Mode PUBLIC activé!'); }
      return reply(`ℹ️ Mode actuel: ${config.MODE.toUpperCase()}\nUsage: .mode public / .mode self`);
    }

    case 'self': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      config.MODE = 'self';
      return reply('✅ Mode SELF activé!');
    }

    case 'public': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      config.MODE = 'public';
      return reply('✅ Mode PUBLIC activé!');
    }

    case 'block': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      const mentioned = getMentioned(msg);
      if (!mentioned.length && !args[0]) return reply('❌ Mentionne quelqu\'un!');
      const target = mentioned[0] || (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
      try {
        await sock.updateBlockStatus(target, 'block');
        blocklist.add(target);
        reply(`🚫 @${target.split('@')[0]} bloqué!`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'unblock': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      const mentioned = getMentioned(msg);
      if (!mentioned.length && !args[0]) return reply('❌ Mentionne quelqu\'un!');
      const target = mentioned[0] || (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
      try {
        await sock.updateBlockStatus(target, 'unblock');
        blocklist.delete(target);
        reply(`✅ @${target.split('@')[0]} débloqué!`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'broadcast': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      if (!text) return reply('❌ Usage: .broadcast [message]');
      const sessions = store.getAllSessions();
      let sent = 0;
      for (const [num, sess] of sessions) {
        try {
          await sess.sock.sendMessage(num + '@s.whatsapp.net', { text: `📢 *Broadcast DENTSU MD V7*\n\n${text}\n\n${config.BOT_FOOTER}` });
          sent++;
          await delay(1000);
        } catch (e) {}
      }
      reply(`✅ Broadcast envoyé à ${sent} contact(s)!`);
      return;
    }

    case 'addsudo': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      sudoList.add(mentioned[0]);
      reply(`✅ @${mentioned[0].split('@')[0]} ajouté en sudo!`);
      return;
    }

    case 'delsudo': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un utilisateur!');
      sudoList.delete(mentioned[0]);
      reply(`✅ @${mentioned[0].split('@')[0]} retiré!`);
      return;
    }

    case 'listsudo': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      reply(sudoList.size === 0 ? '📋 Aucun sudo' : `👑 *Sudo*:\n${[...sudoList].map(j => `• @${j.split('@')[0]}`).join('\n')}`);
      return;
    }

    case 'del':
    case 'delete': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      const quotedKey = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!quotedKey) return reply('❌ Réponds à un message à supprimer!');
      try {
        await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: quotedParticipant === sock.user.id, id: quotedKey, participant: quotedParticipant } });
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'listgc': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      try {
        const groups = await sock.groupFetchAllParticipating();
        const list = Object.values(groups).map(g => `• ${g.subject} (${g.participants.length} membres)`);
        reply(`📋 *Groupes actifs*:\n\n${list.join('\n') || 'Aucun'}`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'leaveall': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      try {
        const groups = await sock.groupFetchAllParticipating();
        const ids = Object.keys(groups);
        for (const id of ids) { try { await sock.groupLeave(id); await delay(1000); } catch (e2) {} }
        reply(`✅ Quitté ${ids.length} groupe(s)!`);
      } catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'autoviewstatus': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      const val = text?.toLowerCase();
      if (val === 'on') { config.AUTO_VIEW_STATUS = true; return reply('✅ Auto-view status ON!'); }
      if (val === 'off') { config.AUTO_VIEW_STATUS = false; return reply('✅ Auto-view status OFF!'); }
      return reply(`ℹ️ Auto-view: ${config.AUTO_VIEW_STATUS ? 'ON' : 'OFF'}`);
    }

    case 'autotyping': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      const val = text?.toLowerCase();
      if (val === 'on') { config.AUTO_TYPING = true; return reply('✅ Auto-typing ON!'); }
      if (val === 'off') { config.AUTO_TYPING = false; return reply('✅ Auto-typing OFF!'); }
      return reply(`ℹ️ Auto-typing: ${config.AUTO_TYPING ? 'ON' : 'OFF'}`);
    }

    case 'autorecording': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      const val = text?.toLowerCase();
      if (val === 'on') { config.AUTO_RECORDING = true; return reply('✅ Auto-recording ON!'); }
      if (val === 'off') { config.AUTO_RECORDING = false; return reply('✅ Auto-recording OFF!'); }
      return reply(`ℹ️ Auto-recording: ${config.AUTO_RECORDING ? 'ON' : 'OFF'}`);
    }

    case 'setbio':
    case 'setaccount': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      if (!text) return reply('❌ Donne une bio!');
      try { await sock.updateProfileStatus(text); reply(`✅ Bio: "${text}"`); }
      catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    case 'setname':
    case 'myname': {
      if (!ownerCheck) return reply('❌ Réservé au propriétaire!');
      if (!text) return reply('❌ Donne un nom!');
      try { await sock.updateProfileName(text); reply(`✅ Nom: "${text}"`); }
      catch (e) { reply('❌ Erreur: ' + e.message); }
      return;
    }

    // ════════════════════════════════════════════════════════════
    //  🎉  FUN
    // ════════════════════════════════════════════════════════════
    case 'truth': {
      return reply(`🎲 *Vérité*\n\n${truths[Math.floor(Math.random() * truths.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'dare': {
      return reply(`🎯 *Défi*\n\n${dares[Math.floor(Math.random() * dares.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'joke':
    case 'meme': {
      return reply(`😂 *Blague*\n\n${jokes[Math.floor(Math.random() * jokes.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'ship': {
      const mentioned = getMentioned(msg);
      if (mentioned.length < 2) return reply('❌ Mentionne 2 personnes! Ex: .ship @user1 @user2');
      const pct = Math.floor(Math.random() * 101);
      const bar = '❤️'.repeat(Math.floor(pct / 10)) + '🖤'.repeat(10 - Math.floor(pct / 10));
      return reply(`💕 *Ship*\n\n@${mentioned[0].split('@')[0]} + @${mentioned[1].split('@')[0]}\n\n${bar}\n💯 ${pct}%\n\n${pct >= 75 ? '🔥 PARFAITS!' : pct >= 50 ? '💛 Bonne chance!' : '💔 Hmm...'}\n\n${config.BOT_FOOTER}`);
    }

    case 'rate': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}rate [chose]`);
      const pct = Math.floor(Math.random() * 101);
      return reply(`⭐ *Rating*\n\n"${text}"\n\n${'⭐'.repeat(Math.floor(pct / 20))}\n📊 ${pct}/100\n\n${config.BOT_FOOTER}`);
    }

    case 'flirt': {
      const mentioned = getMentioned(msg);
      const target = mentioned.length ? `@${mentioned[0].split('@')[0]}` : 'toi';
      return reply(`💖 *Flirt pour ${target}*\n\n${flirts[Math.floor(Math.random() * flirts.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'roast': {
      const mentioned = getMentioned(msg);
      const target = mentioned.length ? `@${mentioned[0].split('@')[0]}` : 'toi';
      return reply(`🔥 *Roast pour ${target}*\n\n${roasts[Math.floor(Math.random() * roasts.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'compliment': {
      const mentioned = getMentioned(msg);
      const target = mentioned.length ? `@${mentioned[0].split('@')[0]}` : 'toi';
      const compliments = ["Tu es quelqu'un d'exceptionnel!", "Le monde est meilleur avec toi!", "Ta gentillesse illumine les journées!"];
      return reply(`💐 *Compliment pour ${target}*\n\n${compliments[Math.floor(Math.random() * compliments.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'wouldyou': {
      const scenarios = [
        "Préférerais-tu voler ou être invisible ?",
        "Vivrais-tu 100 ans normalement ou 50 ans en parfaite santé ?",
        "Riche mais seul ou pauvre avec des amis ?",
        "Préférerais-tu parler toutes les langues ou jouer de tous les instruments ?",
      ];
      return reply(`🤔 *Would You Rather?*\n\n${scenarios[Math.floor(Math.random() * scenarios.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case '8ball': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}8ball [question]`);
      const answers = ['✅ Oui!', '✅ Certainement!', '✅ Très probablement!', '❓ Difficile à dire...', '❓ Redemande plus tard!', '❌ Non!', '❌ Pas du tout!'];
      return reply(`🎱 *8-Ball*\n\n❓ ${text}\n\n${answers[Math.floor(Math.random() * answers.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'advice': {
      const advices = [
        "Souris chaque matin, ça devient une habitude!",
        "La patience est la clé de toutes les portes!",
        "Chaque jour est une nouvelle chance de s'améliorer!",
        "Prends soin de ta santé mentale autant que physique!",
      ];
      return reply(`💡 *Conseil*\n\n${advices[Math.floor(Math.random() * advices.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'moviequote':
    case 'inspire': {
      return reply(`✨ *Citation*\n\n${quotes[Math.floor(Math.random() * quotes.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'triviafact': {
      const facts = [
        "🐙 Les pieuvres ont trois cœurs!",
        "🍯 Le miel ne se périme jamais!",
        "🦋 Les papillons goûtent avec leurs pieds!",
        "🐬 Les dauphins ont des noms propres!",
        "🧠 Le cerveau peut stocker ~2,5 pétaoctets!",
      ];
      return reply(`🧠 *Fact*\n\n${facts[Math.floor(Math.random() * facts.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'urban': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}urban [mot]`);
      try {
        const res = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(text)}`);
        const def = res.data?.list?.[0];
        if (!def) return reply(`❌ Aucune définition pour "${text}"`);
        return reply(`📖 *Urban Dictionary*\n\n*${text}*\n\n${def.definition.substring(0, 500)}\n\n_Exemple: ${def.example?.substring(0, 200) || 'N/A'}_\n\n👍 ${def.thumbs_up} | 👎 ${def.thumbs_down}\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Impossible de trouver "${text}"`); }
    }

    case 'ascii': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}ascii [texte]`);
      const map = { A:'/-\\',B:'|3',C:'(',D:'|)',E:'3',F:'|=',G:'6',H:'|-|',I:'!',J:'_|',K:'|<',L:'|_',M:'|\\/|',N:'|\\|',O:'0',P:'|D',Q:'(_,)',R:'|2',S:'5',T:'7',U:'|_|',V:'\\/',W:'\\/\\/',X:'><',Y:'`/',Z:'2' };
      const ascii = text.toUpperCase().split('').map(c => map[c] || c).join(' ');
      return reply(`🔤 *ASCII*\n\n${ascii}\n\n${config.BOT_FOOTER}`);
    }

    // ════════════════════════════════════════════════════════════
    //  🎮  JEUX
    // ════════════════════════════════════════════════════════════
    case 'rps': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}rps [pierre/feuille/ciseaux]`);
      const choices = ['pierre', 'feuille', 'ciseaux'];
      const emojis = { pierre: '🪨', feuille: '📄', ciseaux: '✂️' };
      const player = text.toLowerCase();
      if (!choices.includes(player)) return reply('❌ Choisis: pierre, feuille ou ciseaux');
      const bot = choices[Math.floor(Math.random() * 3)];
      let result = player === bot ? '🤝 Égalité!'
        : ((player === 'pierre' && bot === 'ciseaux') || (player === 'feuille' && bot === 'pierre') || (player === 'ciseaux' && bot === 'feuille'))
          ? '🎉 Tu gagnes!' : '💀 Tu perds!';
      return reply(`🎮 *Pierre/Feuille/Ciseaux*\n\n👤 Toi: ${emojis[player]} ${player}\n🤖 Bot: ${emojis[bot]} ${bot}\n\n${result}\n\n${config.BOT_FOOTER}`);
    }

    case 'dice': {
      const result = Math.floor(Math.random() * 6) + 1;
      const emojis = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
      return reply(`🎲 *Dé*\n\n${emojis[result]} = *${result}*\n\n${config.BOT_FOOTER}`);
    }

    case 'coin': {
      return reply(`🪙 *Pile ou Face*\n\n${Math.random() > 0.5 ? 'FACE 👑' : 'PILE 🔵'}\n\n${config.BOT_FOOTER}`);
    }

    case 'coinbattle': {
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply(`❌ Mentionne un adversaire!`);
      const p1 = Math.random() > 0.5, p2 = Math.random() > 0.5;
      const winner = p1 !== p2 ? (p1 ? `@${senderNumber}` : `@${mentioned[0].split('@')[0]}`) : null;
      return reply(`🪙 *Coin Battle*\n\n@${senderNumber}: ${p1 ? '👑 FACE' : '🔵 PILE'}\n@${mentioned[0].split('@')[0]}: ${p2 ? '👑 FACE' : '🔵 PILE'}\n\n${winner ? `🏆 Gagnant: ${winner}!` : '🤝 Égalité!'}\n\n${config.BOT_FOOTER}`);
    }

    case 'numberbattle':
    case 'numbattle': {
      const mentioned = getMentioned(msg);
      if (!mentioned.length) return reply('❌ Mentionne un adversaire!');
      const n1 = Math.floor(Math.random() * 100) + 1, n2 = Math.floor(Math.random() * 100) + 1;
      const winner = n1 > n2 ? `@${senderNumber}` : n2 > n1 ? `@${mentioned[0].split('@')[0]}` : null;
      return reply(`🔢 *Number Battle*\n\n@${senderNumber}: *${n1}*\n@${mentioned[0].split('@')[0]}: *${n2}*\n\n${winner ? `🏆 ${winner}!` : '🤝 Égalité!'}\n\n${config.BOT_FOOTER}`);
    }

    case 'hangman': {
      const word = hangmanWords[Math.floor(Math.random() * hangmanWords.length)];
      activeGames.set(from + '_hangman', { word, guessed: [], tries: 6 });
      return reply(`🎯 *Pendu*\n\n${'_ '.repeat(word.length).trim()}\n\n${word.length} lettres | ❤️ 6 essais\n\nTape ${config.PREFIX}lettre [a-z]\n\n${config.BOT_FOOTER}`);
    }

    case 'lettre': {
      const game = activeGames.get(from + '_hangman');
      if (!game) return reply(`❌ Pas de partie! Tape ${config.PREFIX}hangman`);
      const letter = text?.toLowerCase()?.[0];
      if (!letter || !/[a-z]/.test(letter)) return reply('❌ Tape une lettre valide!');
      if (game.guessed.includes(letter)) return reply(`❌ Déjà essayé '${letter}'!`);
      game.guessed.push(letter);
      if (!game.word.includes(letter)) game.tries--;
      const display = game.word.split('').map(c => game.guessed.includes(c) ? c : '_').join(' ');
      if (!display.includes('_')) { activeGames.delete(from + '_hangman'); return reply(`🎉 BRAVO! Mot: *${game.word}*\n\n${config.BOT_FOOTER}`); }
      if (game.tries <= 0) { activeGames.delete(from + '_hangman'); return reply(`💀 PERDU! Mot: *${game.word}*\n\n${config.BOT_FOOTER}`); }
      return reply(`🎯 *Pendu*\n\n${display}\n\n❤️ Essais: ${game.tries} | Lettres: ${game.guessed.join(', ')}`);
    }

    case 'guess': {
      const number = Math.floor(Math.random() * 100) + 1;
      guessGames.set(from + '_' + sender, { number, tries: 0 });
      return reply(`🔢 *Devine!*\n\nNombre entre 1-100.\nTape ${config.PREFIX}g [nombre]\n\n${config.BOT_FOOTER}`);
    }

    case 'g': {
      const game = guessGames.get(from + '_' + sender);
      if (!game) return reply(`❌ Pas de partie! Tape ${config.PREFIX}guess`);
      const n = parseInt(text);
      if (isNaN(n)) return reply('❌ Donne un nombre!');
      game.tries++;
      if (n === game.number) { guessGames.delete(from + '_' + sender); return reply(`🎉 BRAVO! C'était *${game.number}* en ${game.tries} essai(s)!\n\n${config.BOT_FOOTER}`); }
      return reply(`${n < game.number ? '📈 Plus grand!' : '📉 Plus petit!'} (essai ${game.tries})`);
    }

    case 'math': {
      const ops = ['+', '-', '*'];
      const op = ops[Math.floor(Math.random() * 3)];
      const a = Math.floor(Math.random() * 50) + 1, b = Math.floor(Math.random() * 20) + 1;
      const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
      mathGames.set(from + '_math', { answer, question: `${a} ${op} ${b}` });
      setTimeout(() => mathGames.delete(from + '_math'), 30000);
      return reply(`🧮 *Math*\n\n${a} ${op} ${b} = ?\n\nTape ${config.PREFIX}rep [réponse] (30s)\n\n${config.BOT_FOOTER}`);
    }

    case 'rep': {
      const game = mathGames.get(from + '_math');
      if (!game) return reply(`❌ Pas de question! Tape ${config.PREFIX}math`);
      const ans = parseInt(text);
      if (isNaN(ans)) return reply('❌ Donne un nombre!');
      mathGames.delete(from + '_math');
      return reply(ans === game.answer ? `🎉 CORRECT! ${game.question} = ${game.answer}\n\n${config.BOT_FOOTER}` : `❌ FAUX! ${game.question} = ${game.answer}\n\n${config.BOT_FOOTER}`);
    }

    case 'emojiquiz': {
      const quizzes = [
        { q: '🦁 + 👑 = ?', a: 'roi lion' },
        { q: '🕷️ + 👦 = ?', a: 'spider-man' },
        { q: '🦇 + 🦸 = ?', a: 'batman' },
        { q: '🌊 + 🏠 = ?', a: 'moana' },
      ];
      const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
      activeGames.set(from + '_emoji_' + sender, quiz.a);
      return reply(`🎯 *Emoji Quiz*\n\n${quiz.q}\n\nTape ${config.PREFIX}ans [réponse]\n\n${config.BOT_FOOTER}`);
    }

    case 'ans': {
      const answer = activeGames.get(from + '_emoji_' + sender);
      if (!answer) return reply(`❌ Pas de quiz! Tape ${config.PREFIX}emojiquiz`);
      if (text?.toLowerCase().includes(answer)) {
        activeGames.delete(from + '_emoji_' + sender);
        return reply(`🎉 CORRECT! Réponse: *${answer}*\n\n${config.BOT_FOOTER}`);
      }
      return reply(`❌ FAUX! Essaie encore!`);
    }

    // ════════════════════════════════════════════════════════════
    //  🎵  SONS
    // ════════════════════════════════════════════════════════════
    case 'tts':
    case 'say': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [texte]`);
      try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=fr&client=tw-ob&q=${encodeURIComponent(text)}`;
        await sock.sendMessage(from, { audio: { url }, mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur TTS: ${e.message}`); }
      return;
    }

    case 'bass':
    case 'blown':
    case 'deep':
    case 'earrape':
    case 'fast':
    case 'nightcore':
    case 'reverse':
    case 'robot':
    case 'slow':
    case 'smooth':
    case 'squirrel': {
      const quotedMsg2 = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg2?.audioMessage && !quotedMsg2?.videoMessage) {
        return reply(`❌ Réponds à un audio!\nUsage: Réponds avec ${config.PREFIX}${command}\n\n${config.BOT_FOOTER}`);
      }
      return reply(`⏳ Effet *${command}* en cours...\n\n⚠️ FFmpeg requis sur le serveur.\n\n${config.BOT_FOOTER}`);
    }

    // ════════════════════════════════════════════════════════════
    //  🔧  AUTRES OUTILS
    // ════════════════════════════════════════════════════════════
    case 'weather': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}weather [ville]`);
      try {
        const res = await axios.get(`https://wttr.in/${encodeURIComponent(text)}?format=j1`);
        const w = res.data?.current_condition?.[0];
        if (!w) return reply('❌ Ville non trouvée!');
        return reply(`🌤️ *Météo - ${text}*\n\n🌡️ ${w.temp_C}°C (${w.temp_F}°F)\n💧 Humidité: ${w.humidity}%\n💨 Vent: ${w.windspeedKmph} km/h\n☁️ ${w.weatherDesc?.[0]?.value || 'N/A'}\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Ville "${text}" introuvable`); }
    }

    case 'wiki': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}wiki [recherche]`);
      try {
        const res = await axios.get(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text)}`);
        const data = res.data;
        return reply(`📚 *Wikipedia - ${data.title}*\n\n${data.extract?.substring(0, 700)}...\n\n🔗 ${data.content_urls?.desktop?.page || ''}\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Aucun résultat pour "${text}"`); }
    }

    case 'calculate':
    case 'calc': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}calculate [expression]`);
      try {
        const expr = text.replace(/[^0-9+\-*/.() ]/g, '');
        const result = eval(expr);
        return reply(`🧮 *Calcul*\n\n${text} = *${result}*\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply('❌ Expression invalide!'); }
    }

    case 'jid': {
      const mentioned = getMentioned(msg);
      const target = mentioned[0] || sender;
      return reply(`🆔 *JID*\n\n📱 ${target}\n🔢 ${target.split('@')[0]}\n🌐 ${target.split('@')[1]}\n\n${config.BOT_FOOTER}`);
    }

    case 'github': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}github [username]`);
      try {
        const res = await axios.get(`https://api.github.com/users/${text}`);
        const u = res.data;
        return reply(`🐙 *GitHub - ${u.login}*\n\n📛 Nom: ${u.name || 'N/A'}\n📝 Bio: ${u.bio || 'N/A'}\n📦 Repos: ${u.public_repos}\n👥 Followers: ${u.followers}\n🔗 ${u.html_url}\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Utilisateur "${text}" non trouvé!`); }
    }

    case 'npm': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}npm [package]`);
      try {
        const res = await axios.get(`https://registry.npmjs.org/${text}`);
        const p = res.data, latest = p['dist-tags']?.latest;
        return reply(`📦 *NPM - ${p.name}*\n\n📝 ${p.description || 'N/A'}\n🏷️ Version: ${latest}\n🔗 https://npmjs.com/package/${text}\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Package "${text}" non trouvé!`); }
    }

    case 'shorturl': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}shorturl [url]`);
      try {
        const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`);
        return reply(`🔗 *URL*\n\nOriginal: ${text}\nCourt: ${res.data}\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Erreur: ${e.message}`); }
    }

    case 'myip': {
      try {
        const res = await axios.get('https://api.ipify.org?format=json');
        return reply(`🌐 *IP du bot*\n\n${res.data.ip}\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Erreur: ${e.message}`); }
    }

    case 'password': {
      const len = parseInt(text) || 12;
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let pwd = '';
      for (let i = 0; i < Math.min(len, 32); i++) pwd += chars[Math.floor(Math.random() * chars.length)];
      return reply(`🔑 *Mot de passe*\n\n\`${pwd}\`\n\n${config.BOT_FOOTER}`);
    }

    case 'mathfact': {
      const n = parseInt(text) || Math.floor(Math.random() * 100);
      try {
        const res = await axios.get(`http://numbersapi.com/${n}/math`);
        return reply(`🔢 *Math Fact*\n\n${res.data}\n\n${config.BOT_FOOTER}`);
      } catch (e) {
        return reply(`🔢 *Math Fact*\n\n${n} est un nombre ${n % 2 === 0 ? 'pair' : 'impair'}!\n\n${config.BOT_FOOTER}`);
      }
    }

    case 'sciencefact': {
      const facts = [
        "⚡ La foudre est 5x plus chaude que la surface du soleil!",
        "🧬 L'ADN humain fait ~2 mètres si déroulé!",
        "🌌 Plus d'étoiles dans l'univers que de grains de sable!",
        "💡 La lumière du soleil prend 8min 20s pour atteindre la Terre!",
      ];
      return reply(`🔬 *Science Fact*\n\n${facts[Math.floor(Math.random() * facts.length)]}\n\n${config.BOT_FOOTER}`);
    }

    case 'horoscope': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}horoscope [signe]\nSignes: belier, taureau, gemeaux, cancer, lion, vierge, balance, scorpion, sagittaire, capricorne, verseau, poissons`);
      const horoscopes = { 'belier':'♈ Journée excellente pour les initiatives!','taureau':'♉ La patience sera ta meilleure alliée.','gemeaux':'♊ Tes capacités de communication brillent!','cancer':'♋ Prends soin de toi et des tiens.','lion':'♌ Tu brilleras dans tout ce que tu fais!','vierge':'♍ L\'organisation te mènera au succès.','balance':'♎ Harmonie et équilibre au rendez-vous.','scorpion':'♏ Fais confiance à ton instinct.','sagittaire':'♐ Aventure et découvertes t\'attendent!','capricorne':'♑ Ton travail acharné portera ses fruits.','verseau':'♒ L\'innovation sera ta force.','poissons':'♓ Ta créativité sera débordante!' };
      const sign = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const horoscope = horoscopes[sign];
      if (!horoscope) return reply(`❌ Signe invalide! Ex: belier, lion, cancer...`);
      return reply(`🔮 *Horoscope - ${sign}*\n\n${horoscope}\n\n${config.BOT_FOOTER}`);
    }

    case 'imdb': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}imdb [film]`);
      try {
        const res = await axios.get(`https://www.omdbapi.com/?t=${encodeURIComponent(text)}&apikey=trilogy&type=movie`);
        if (res.data.Response === 'False') return reply(`❌ Film "${text}" non trouvé!`);
        const m = res.data;
        return reply(`🎬 *${m.Title}* (${m.Year})\n\n⭐ ${m.imdbRating}/10\n🎭 ${m.Genre}\n⏱️ ${m.Runtime}\n👥 ${m.Actors}\n📝 ${m.Plot?.substring(0, 300)}\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Erreur IMDB: ${e.message}`); }
    }

    case 'dictionary': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}dictionary [mot]`);
      try {
        const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
        const entry = res.data?.[0], meaning = entry?.meanings?.[0], def = meaning?.definitions?.[0];
        if (!entry) return reply(`❌ "${text}" non trouvé!`);
        return reply(`📖 *${entry.word}*\n\n🏷️ ${meaning?.partOfSpeech}\n📝 ${def?.definition}\n📌 Exemple: ${def?.example || 'N/A'}\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply('❌ Mot non trouvé!'); }
    }

    case 'remind': {
      const minutes = parseInt(args[0]);
      const reminderText = args.slice(1).join(' ');
      if (!minutes || !reminderText) return reply(`❌ Usage: ${config.PREFIX}remind [minutes] [message]`);
      reply(`⏰ Rappel dans ${minutes} min: "${reminderText}"`);
      setTimeout(async () => {
        try { await sock.sendMessage(from, { text: `⏰ *RAPPEL*\n\n${reminderText}\n\n${config.BOT_FOOTER}` }, { quoted: msg }); } catch (e) {}
      }, minutes * 60000);
      return;
    }

    case 'recipe': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}recipe [plat]`);
      try {
        const res = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(text)}`);
        const meal = res.data?.meals?.[0];
        if (!meal) return reply(`❌ Aucune recette pour "${text}"!`);
        const ingredients = [];
        for (let i = 1; i <= 10; i++) {
          if (meal[`strIngredient${i}`]) ingredients.push(`• ${meal[`strMeasure${i}`]} ${meal[`strIngredient${i}`]}`);
        }
        return reply(`🍽️ *${meal.strMeal}*\n\n🌍 ${meal.strArea} | 📂 ${meal.strCategory}\n\n*Ingrédients:*\n${ingredients.join('\n')}\n\n📝 ${meal.strInstructions?.substring(0, 400)}...\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Erreur: ${e.message}`); }
    }

    // ════════════════════════════════════════════════════════════
    //  📥  DOWNLOADER
    // ════════════════════════════════════════════════════════════
    case 'ytmp3':
    case 'song':
    case 'play':
    case 'yta': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [titre ou URL YouTube]`);
      await reply('🔍 Recherche...');
      try {
        const apis = [
          `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(text)}`,
          `https://api.akuari.my.id/dl/ytmp3?url=${encodeURIComponent(text)}`
        ];
        let audioUrl = null, title = text;
        for (const api of apis) {
          try {
            const res = await axios.get(api);
            audioUrl = res.data?.url || res.data?.download?.url || res.data?.data?.url;
            title = res.data?.title || text;
            if (audioUrl) break;
          } catch (e2) {}
        }
        if (!audioUrl) return reply(`⚠️ Téléchargement indisponible.\nEssaie un lien YouTube direct!\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, { audio: { url: audioUrl }, mimetype: 'audio/mp4', fileName: `${title}.mp3` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'ytb':
    case 'video':
    case 'mp4': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [URL YouTube]`);
      await reply('🎬 Téléchargement vidéo...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(text)}`);
        const videoUrl = res.data?.url || res.data?.download?.url;
        const title = res.data?.title || 'video';
        if (!videoUrl) return reply(`⚠️ Impossible de télécharger.\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, { video: { url: videoUrl }, caption: `🎬 ${title}\n\n${config.BOT_FOOTER}`, fileName: `${title}.mp4` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'fb': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}fb [URL Facebook]`);
      await reply('📥 Téléchargement...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/fb?url=${encodeURIComponent(text)}`);
        const url = res.data?.url || res.data?.hd || res.data?.sd;
        if (!url) return reply(`❌ Impossible de télécharger.\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, { video: { url }, caption: `📥 Facebook\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}\n\nLien public uniquement!`); }
      return;
    }

    case 'insta': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}insta [URL Instagram]`);
      await reply('📥 Téléchargement...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/instagram?url=${encodeURIComponent(text)}`);
        const url = res.data?.url?.[0] || res.data?.data?.[0]?.url;
        if (!url) return reply(`❌ Impossible de télécharger.\n\n${config.BOT_FOOTER}`);
        if (url.includes('.mp4') || url.includes('video')) {
          await sock.sendMessage(from, { video: { url }, caption: `📥 Instagram\n\n${config.BOT_FOOTER}` }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { image: { url }, caption: `📥 Instagram\n\n${config.BOT_FOOTER}` }, { quoted: msg });
        }
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'pint': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}pint [URL Pinterest]`);
      await reply('📥 Téléchargement...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/pinterest?url=${encodeURIComponent(text)}`);
        const url = res.data?.url || res.data?.data?.url;
        if (!url) return reply(`❌ Impossible.\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, { image: { url }, caption: `📥 Pinterest\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'git':
    case 'gitclone': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}git [user/repo]`);
      return reply(`🐙 *GitHub*\n\n📦 ${text}\n🔗 https://github.com/${text}\n📥 Clone: git clone https://github.com/${text}.git\n📁 ZIP: https://github.com/${text}/archive/refs/heads/main.zip\n\n${config.BOT_FOOTER}`);
    }

    case 'apk': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}apk [nom app]`);
      return reply(`📱 *APK - "${text}"*\n\n🔗 https://apkpure.com/search?q=${encodeURIComponent(text)}\n🔗 https://apkmirror.com/?s=${encodeURIComponent(text)}\n\n${config.BOT_FOOTER}`);
    }

    // ════════════════════════════════════════════════════════════
    //  📸  MÉDIA
    // ════════════════════════════════════════════════════════════
    case 'sticker':
    case 's': {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg) return reply(`❌ Réponds à une image!\n\n${config.BOT_FOOTER}`);
      try {
        const mtype = getContentType(quotedMsg);
        if (mtype === 'imageMessage') {
          const buffer = await downloadMediaMessage({ message: quotedMsg, key: msg.key }, 'buffer', {});
          await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
        } else if (mtype === 'videoMessage') {
          reply('⏳ Conversion vidéo → sticker...\n\n⚠️ FFmpeg requis.');
        } else {
          reply('❌ Réponds à une image!');
        }
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'sticker2img':
    case 'toimage': {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg?.stickerMessage) return reply(`❌ Réponds à un sticker!\n\n${config.BOT_FOOTER}`);
      try {
        const buffer = await downloadMediaMessage({ message: quotedMsg }, 'buffer', {});
        await sock.sendMessage(from, { image: buffer, caption: `✅ Sticker → Image!\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'remini': {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg?.imageMessage) return reply(`❌ Réponds à une image!\n\n${config.BOT_FOOTER}`);
      await reply('🔧 Amélioration Remini...');
      try {
        const buffer = await downloadMediaMessage({ message: quotedMsg }, 'buffer', {});
        const form = new (require('form-data'))();
        form.append('image', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
        const res = await axios.post('https://api.ryzendesu.vip/api/ai/remini', form, { headers: form.getHeaders(), responseType: 'arraybuffer' });
        await sock.sendMessage(from, { image: Buffer.from(res.data), caption: `✅ Image améliorée!\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur Remini: ${e.message}`); }
      return;
    }

    case 'imageinfo': {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg?.imageMessage) return reply(`❌ Réponds à une image!\n\n${config.BOT_FOOTER}`);
      const img = quotedMsg.imageMessage;
      return reply(`📸 *Image Info*\n\n📐 ${img.width}x${img.height}px\n📦 ${Math.round(img.fileLength / 1024)} KB\n📝 ${img.mimetype}\n\n${config.BOT_FOOTER}`);
    }

    case 'qrcode': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}qrcode [texte]`);
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
        await sock.sendMessage(from, { image: { url: qrUrl }, caption: `🔳 *QR Code*\n\n📝 ${text}\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    // ════════════════════════════════════════════════════════════
    //  🔍  RECHERCHE
    // ════════════════════════════════════════════════════════════
    case 'img': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}img [recherche]`);
      await reply('🔍 Recherche images...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/search/gsearch?query=${encodeURIComponent(text)}&type=image`);
        const images = res.data?.result || res.data?.images || [];
        if (!images.length) return reply(`❌ Aucune image pour "${text}"`);
        const img = images[Math.floor(Math.random() * Math.min(images.length, 5))];
        const url = img.url || img.link || img;
        await sock.sendMessage(from, { image: { url }, caption: `🖼️ *${text}*\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'yts': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}yts [titre]`);
      await reply('🔍 Recherche YouTube...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/search/yt?query=${encodeURIComponent(text)}`);
        const results = res.data?.result?.slice(0, 5) || [];
        if (!results.length) return reply(`❌ Aucun résultat pour "${text}"`);
        let txt = `🎬 *YouTube - "${text}"*\n\n`;
        results.forEach((r, i) => {
          txt += `${i + 1}. *${r.title}*\n   ⏱️ ${r.duration || 'N/A'}\n   🔗 https://youtube.com/watch?v=${r.id || r.videoId}\n\n`;
        });
        return reply(txt + config.BOT_FOOTER);
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'iplookup': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}iplookup [ip]`);
      try {
        const res = await axios.get(`https://ipapi.co/${text}/json/`);
        if (res.data.error) return reply('❌ IP invalide!');
        const d = res.data;
        return reply(`🌐 *IP Lookup*\n\n📡 ${d.ip}\n🌍 ${d.country_name}\n🏙️ ${d.city}\n⏰ ${d.timezone}\n🏢 ${d.org}\n\n${config.BOT_FOOTER}`);
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'circle': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}circle [URL image]`);
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/edit/circle?url=${encodeURIComponent(text)}`, { responseType: 'arraybuffer' });
        await sock.sendMessage(from, { image: Buffer.from(res.data), caption: `⭕ Image circulaire\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'get': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}get [URL]`);
      try {
        const res = await axios.get(text, { timeout: 10000 });
        const content = JSON.stringify(res.data, null, 2).substring(0, 1500);
        return reply(`📡 *GET*\n\n${text}\nStatus: ${res.status}\n\n\`\`\`${content}\`\`\`\n\n${config.BOT_FOOTER}`);
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'ffstalk': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}ffstalk [UID Free Fire]`);
      await reply('🎮 Recherche joueur...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/stalk/ff?uid=${text}`);
        const info = res.data?.data?.AccountInfo || res.data?.AccountInfo;
        if (!info) return reply(`❌ UID "${text}" non trouvé!`);
        return reply(`🎮 *Free Fire*\n\n👤 ${info.AccountName}\n🏆 Niveau: ${info.AccountLevel}\n⭐ EXP: ${info.AccountEXP}\n\n${config.BOT_FOOTER}`);
      } catch (e) { reply(`❌ Erreur FF: ${e.message}`); }
      return;
    }

    case 'npmstalk': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}npmstalk [package]`);
      try {
        const [dl, info] = await Promise.all([
          axios.get(`https://api.npmjs.org/downloads/point/last-week/${text}`),
          axios.get(`https://registry.npmjs.org/${text}`)
        ]);
        const d = info.data;
        return reply(`📦 *NPM Stats - ${text}*\n\n📊 DL/semaine: ${dl.data?.downloads?.toLocaleString() || 'N/A'}\n🏷️ ${d['dist-tags']?.latest}\n📝 ${d.description}\n\n${config.BOT_FOOTER}`);
      } catch (e) { reply(`❌ "${text}" non trouvé!`); }
      return;
    }

    case 'currency': {
      if (!text || args.length < 3) return reply(`❌ Usage: ${config.PREFIX}currency [montant] [de] [vers]\nEx: .currency 100 USD EUR`);
      const [amount, from2, to] = args;
      try {
        const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from2.toUpperCase()}`);
        const rate = res.data?.rates?.[to.toUpperCase()];
        if (!rate) return reply(`❌ Devise "${to}" non trouvée!`);
        return reply(`💱 *Conversion*\n\n${amount} ${from2.toUpperCase()} = *${(parseFloat(amount) * rate).toFixed(2)} ${to.toUpperCase()}*\n\n${config.BOT_FOOTER}`);
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'time': {
      const moment = require('moment-timezone');
      const zones = { 'brazzaville': 'Africa/Brazzaville', 'paris': 'Europe/Paris', 'london': 'Europe/London', 'new york': 'America/New_York', 'tokyo': 'Asia/Tokyo', 'dubai': 'Asia/Dubai', 'moscow': 'Europe/Moscow' };
      if (!text) {
        let timeList = '*🕐 Heures mondiales*\n\n';
        for (const [city, tz] of Object.entries(zones)) timeList += `🌍 ${city}: *${moment().tz(tz).format('HH:mm:ss')}*\n`;
        return reply(timeList + `\n${config.BOT_FOOTER}`);
      }
      const tz = Object.entries(zones).find(([k]) => text.toLowerCase().includes(k));
      if (!tz) return reply('❌ Ville non reconnue!\nVilles: Brazzaville, Paris, London, New York, Tokyo, Dubai, Moscow');
      return reply(`🕐 *${text}*\n\n${moment().tz(tz[1]).format('YYYY-MM-DD HH:mm:ss')}\n\n${config.BOT_FOOTER}`);
    }

    // ════════════════════════════════════════════════════════════
    //  🖼️  IMAGES ALÉATOIRES
    // ════════════════════════════════════════════════════════════
    case 'hentai': {
      try {
        const res = await axios.get('https://api.waifu.pics/nsfw/waifu');
        const url = res.data?.url;
        if (!url) return reply(`❌ Indisponible.\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, { image: { url }, caption: `🔞 *NSFW - 18+*\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'chinagirl':
    case 'bluearchive':
    case 'boypic':
    case 'carimage':
    case 'random-girl':
    case 'hijab-girl':
    case 'indonesia-girl':
    case 'japan-girl':
    case 'korean-girl': {
      try {
        const url = await getRandomImage(command);
        if (!url) return reply(`⚠️ Aucune image disponible.\n\n${config.BOT_FOOTER}`);
        const captions = { 'chinagirl':'🇨🇳 China Girl','bluearchive':'🎮 Blue Archive','boypic':'👦 Boy Pic','carimage':'🚗 Car','random-girl':'👧 Random Girl','hijab-girl':'🧕 Hijab Girl','indonesia-girl':'🇮🇩 Indonesia','japan-girl':'🇯🇵 Japan','korean-girl':'🇰🇷 Korea' };
        await sock.sendMessage(from, { image: { url }, caption: `${captions[command]}\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    // ════════════════════════════════════════════════════════════
    //  🎌  ANIME
    // ════════════════════════════════════════════════════════════
    case 'loli':
    case 'maid':
    case 'megumin':
    case 'neko':
    case 'shinobu':
    case 'waifu': {
      const waifuUrls = { loli:'https://api.waifu.pics/sfw/neko', maid:'https://api.waifu.pics/sfw/maid', megumin:'https://api.waifu.pics/sfw/megumin', neko:'https://api.waifu.pics/sfw/neko', shinobu:'https://api.waifu.pics/sfw/shinobu', waifu:'https://api.waifu.pics/sfw/waifu' };
      try {
        const res = await axios.get(waifuUrls[command]);
        const url = res.data?.url;
        if (!url) return reply(`❌ Indisponible!\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, { image: { url }, caption: `🎌 *${command.charAt(0).toUpperCase() + command.slice(1)}*\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'achar':
    case 'character': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [personnage]`);
      await reply('🔍 Recherche personnage...');
      try {
        const res = await axios.get(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(text)}&limit=1`);
        const char = res.data?.data?.[0];
        if (!char) return reply(`❌ "${text}" non trouvé!`);
        const img = char.images?.jpg?.image_url;
        const caption = `👤 *${char.name}*\n\n📺 ${char.anime?.map(a => a.anime?.title).slice(0, 3).join(', ') || 'N/A'}\n❤️ Favoris: ${char.favorites?.toLocaleString()}\n\n🔗 ${char.url}\n\n${config.BOT_FOOTER}`;
        img ? await sock.sendMessage(from, { image: { url: img }, caption }, { quoted: msg }) : reply(caption);
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'aquote': {
      const animeQuotes = [
        { q: "La force vient d'une volonté indomptable.", a: "Naruto" },
        { q: "Un homme qui ne peut pas respecter son serment ne vaut rien.", a: "Zoro (One Piece)" },
        { q: "Le travail acharné est trahi par le talent.", a: "Rock Lee (Naruto)" },
      ];
      const q = animeQuotes[Math.floor(Math.random() * animeQuotes.length)];
      return reply(`💬 *Anime Quote*\n\n"${q.q}"\n\n— _${q.a}_\n\n${config.BOT_FOOTER}`);
    }

    case 'arecommend': {
      const animes = [
        { title: 'Attack on Titan', score: '9.0', genre: 'Action, Drame', desc: 'Humanité vs Titans' },
        { title: 'Death Note', score: '8.9', genre: 'Thriller', desc: 'Un cahier qui tue' },
        { title: 'Demon Slayer', score: '8.7', genre: 'Action', desc: 'Chasseurs de démons' },
        { title: 'One Piece', score: '9.2', genre: 'Aventure', desc: 'Quête du One Piece' },
        { title: 'Jujutsu Kaisen', score: '8.8', genre: 'Action', desc: 'Exorcistes modernes' },
      ];
      const a = animes[Math.floor(Math.random() * animes.length)];
      return reply(`🎌 *Recommandation*\n\n📺 *${a.title}*\n⭐ ${a.score}/10\n🎭 ${a.genre}\n📝 ${a.desc}\n\n${config.BOT_FOOTER}`);
    }

    case 'asearch':
    case 'anime': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [nom]`);
      await reply('🔍 Recherche anime...');
      try {
        const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(text)}&limit=1`);
        const a = res.data?.data?.[0];
        if (!a) return reply(`❌ "${text}" non trouvé!`);
        const caption = `🎌 *${a.title}*\n\n⭐ ${a.score || 'N/A'}/10\n📺 Épisodes: ${a.episodes || 'N/A'}\n🎭 ${a.genres?.map(g => g.name).join(', ') || 'N/A'}\n📅 ${a.status}\n📝 ${a.synopsis?.substring(0, 300)}...\n\n🔗 ${a.url}\n\n${config.BOT_FOOTER}`;
        const img = a.images?.jpg?.image_url;
        img ? await sock.sendMessage(from, { image: { url: img }, caption }, { quoted: msg }) : reply(caption);
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'manga': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}manga [nom]`);
      await reply('🔍 Recherche manga...');
      try {
        const res = await axios.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(text)}&limit=1`);
        const m = res.data?.data?.[0];
        if (!m) return reply(`❌ "${text}" non trouvé!`);
        return reply(`📚 *${m.title}*\n\n⭐ ${m.score || 'N/A'}/10\n📖 Chapitres: ${m.chapters || 'N/A'}\n🎭 ${m.genres?.map(g => g.name).join(', ') || 'N/A'}\n📅 ${m.status}\n📝 ${m.synopsis?.substring(0, 300)}...\n\n🔗 ${m.url}\n\n${config.BOT_FOOTER}`);
      } catch (e) { reply(`❌ Erreur: ${e.message}`); }
      return;
    }

    case 'lyrics': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}lyrics [chanson]`);
      await reply('🎵 Recherche paroles...');
      try {
        const query = encodeURIComponent(text);
        const res = await axios.get(`https://api.lyrics.ovh/v1/${query.replace('%20', '/')}}`);
        const lyr = res.data?.lyrics?.substring(0, 1500);
        if (!lyr) return reply(`❌ Paroles de "${text}" non trouvées!`);
        return reply(`🎵 *Paroles: ${text}*\n\n${lyr}...\n\n${config.BOT_FOOTER}`);
      } catch (e) { return reply(`❌ Paroles de "${text}" non trouvées!`); }
    }

    // ════════════════════════════════════════════════════════════
    //  ❓  COMMANDE INCONNUE
    // ════════════════════════════════════════════════════════════
    default: {
      return false;
    }

  }
}

module.exports = { handleCommand };
