const config = require('../config');
const axios = require('axios');

const RANDOM_MENU = `
╔══════════════════════╗
║  🖼️ *RANDOM IMAGE*  ║
╚══════════════════════╝

│ ${config.PREFIX}hentai (18+)
│ ${config.PREFIX}chinagirl
│ ${config.PREFIX}bluearchive
│ ${config.PREFIX}boypic
│ ${config.PREFIX}carimage
│ ${config.PREFIX}random-girl
│ ${config.PREFIX}hijab-girl
│ ${config.PREFIX}indonesia-girl
│ ${config.PREFIX}japan-girl
│ ${config.PREFIX}korean-girl

${config.BOT_FOOTER}`;

const imageCategories = {
  'bluearchive': 'https://api.waifu.pics/sfw/waifu',
  'boypic': 'https://api.waifu.pics/sfw/shinobu',
  'random-girl': 'https://api.waifu.pics/sfw/neko',
  'waifu': 'https://api.waifu.pics/sfw/waifu',
  'maid': 'https://api.waifu.pics/sfw/maid',
};

async function getRandomImage(category) {
  const apis = {
    'chinagirl': ['https://api.ryzendesu.vip/api/img/china', 'https://api.waifu.pics/sfw/waifu'],
    'hijab-girl': ['https://api.ryzendesu.vip/api/img/hijab'],
    'indonesia-girl': ['https://api.ryzendesu.vip/api/img/indo'],
    'japan-girl': ['https://api.ryzendesu.vip/api/img/japan', 'https://api.waifu.pics/sfw/waifu'],
    'korean-girl': ['https://api.ryzendesu.vip/api/img/korea'],
    'carimage': ['https://api.ryzendesu.vip/api/img/car'],
    'boypic': ['https://api.ryzendesu.vip/api/img/boy'],
    'bluearchive': ['https://api.waifu.pics/sfw/waifu'],
    'random-girl': ['https://api.waifu.pics/sfw/neko', 'https://api.waifu.pics/sfw/waifu'],
  };

  const urls = apis[category] || ['https://api.waifu.pics/sfw/waifu'];
  for (const url of urls) {
    try {
      const res = await axios.get(url);
      return res.data?.url || res.data?.image || res.data?.data?.url || null;
    } catch(e) {}
  }
  return null;
}

async function handle(ctx) {
  const { command, text, reply, sock, from, msg } = ctx;

  if (command === 'randommenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: RANDOM_MENU
    }, { quoted: msg });
    return true;
  }

  const randomCmds = ['hentai','chinagirl','bluearchive','boypic','carimage','random-girl','hijab-girl','indonesia-girl','japan-girl','korean-girl'];

  if (!randomCmds.includes(command)) return false;

  if (command === 'hentai') {
    try {
      const res = await axios.get('https://api.waifu.pics/nsfw/waifu');
      const url = res.data?.url;
      if (!url) return reply(`❌ Image non disponible.\n\n${config.BOT_FOOTER}`);
      await sock.sendMessage(from, {
        image: { url },
        caption: `🔞 *NSFW Content*\n\n⚠️ Réservé aux adultes (+18)\n\n${config.BOT_FOOTER}`
      }, { quoted: msg });
    } catch(e) {
      reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
    }
    return true;
  }

  try {
    const url = await getRandomImage(command);
    if (!url) return reply(`⚠️ Aucune image disponible pour "${command}". Réessaie!\n\n${config.BOT_FOOTER}`);
    const captions = {
      'chinagirl': '🇨🇳 China Girl',
      'bluearchive': '🎮 Blue Archive',
      'boypic': '👦 Boy Pic',
      'carimage': '🚗 Car Image',
      'random-girl': '👧 Random Girl',
      'hijab-girl': '🧕 Hijab Girl',
      'indonesia-girl': '🇮🇩 Indonesia Girl',
      'japan-girl': '🇯🇵 Japan Girl',
      'korean-girl': '🇰🇷 Korean Girl',
    };
    await sock.sendMessage(from, {
      image: { url },
      caption: `${captions[command] || '🖼️ Image'}\n\n${config.BOT_FOOTER}`
    }, { quoted: msg });
  } catch(e) {
    reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
  }
  return true;
}

module.exports = { handle };
