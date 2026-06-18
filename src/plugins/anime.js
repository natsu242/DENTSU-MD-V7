const config = require('../config');
const axios = require('axios');

const ANIME_MENU = `
╔══════════════════════╗
║   🎌 *ANIME MENU*   ║
╚══════════════════════╝

│ ${config.PREFIX}achar [personnage]
│ ${config.PREFIX}aquote
│ ${config.PREFIX}arecommend
│ ${config.PREFIX}asearch [anime]
│ ${config.PREFIX}loli
│ ${config.PREFIX}maid
│ ${config.PREFIX}megumin
│ ${config.PREFIX}neko
│ ${config.PREFIX}shinobu
│ ${config.PREFIX}waifu
│ ${config.PREFIX}anime [nom]
│ ${config.PREFIX}manga [nom]
│ ${config.PREFIX}character [nom]
│ ${config.PREFIX}lyrics [chanson]

${config.BOT_FOOTER}`;

const WAIFU_TYPES = {
  loli: 'https://api.waifu.pics/sfw/neko',
  maid: 'https://api.waifu.pics/sfw/maid',
  megumin: 'https://api.waifu.pics/sfw/megumin',
  neko: 'https://api.waifu.pics/sfw/neko',
  shinobu: 'https://api.waifu.pics/sfw/shinobu',
  waifu: 'https://api.waifu.pics/sfw/waifu',
};

async function handle(ctx) {
  const { command, text, reply, sock, from, msg } = ctx;

  if (command === 'animemenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: ANIME_MENU
    }, { quoted: msg });
    return true;
  }

  // Images waifu
  if (WAIFU_TYPES[command]) {
    try {
      const res = await axios.get(WAIFU_TYPES[command]);
      const url = res.data?.url;
      if (!url) return reply(`❌ Image non disponible!\n\n${config.BOT_FOOTER}`);
      await sock.sendMessage(from, {
        image: { url },
        caption: `🎌 *${command.charAt(0).toUpperCase() + command.slice(1)}*\n\n${config.BOT_FOOTER}`
      }, { quoted: msg });
    } catch(e) {
      reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
    }
    return true;
  }

  switch(command) {
    case 'achar':
    case 'character': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [nom personnage]`);
      await reply('🔍 Recherche du personnage...');
      try {
        const res = await axios.get(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(text)}&limit=1`);
        const char = res.data?.data?.[0];
        if (!char) return reply(`❌ Personnage "${text}" non trouvé!`);
        const img = char.images?.jpg?.image_url;
        const bio = char.about?.substring(0, 300) || 'Pas de biographie disponible.';
        if (img) {
          await sock.sendMessage(from, {
            image: { url: img },
            caption: `👤 *${char.name}*\n\n📺 Animes: ${char.anime?.map(a => a.anime?.title).slice(0,3).join(', ') || 'N/A'}\n❤️ Favoris: ${char.favorites?.toLocaleString()}\n\n📝 ${bio}\n\n🔗 ${char.url}\n\n${config.BOT_FOOTER}`
          }, { quoted: msg });
        } else {
          reply(`👤 *${char.name}*\n\n📺 Animes: ${char.anime?.map(a => a.anime?.title).slice(0,3).join(', ') || 'N/A'}\n❤️ Favoris: ${char.favorites?.toLocaleString()}\n\n${config.BOT_FOOTER}`);
        }
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'aquote': {
      const quotes = [
        { q: "La force ne vient pas du corps physique. Elle vient d'une volonté indomptable.", a: "Mahatma Gandhi (Naruto)" },
        { q: "Les gens qui abandonnent leurs rêves pour les rêves des autres sont... des lâches.", a: "Eiichiro Oda (One Piece)" },
        { q: "Je ne fuis pas parce que je peux courir vite. Je cours vite parce que je refuse de fuir.", a: "Killua (HxH)" },
        { q: "Un homme qui ne peut pas respecter son serment ne vaut rien.", a: "Roronoa Zoro (One Piece)" },
        { q: "Le travail acharné est trahi par le talent.", a: "Rock Lee (Naruto)" }
      ];
      const q = quotes[Math.floor(Math.random() * quotes.length)];
      reply(`💬 *Anime Quote*\n\n"${q.q}"\n\n— _${q.a}_\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'arecommend': {
      const animes = [
        { title: 'Attack on Titan', score: '9.0', genre: 'Action, Drame', desc: 'Humanité vs Titans géants' },
        { title: 'Death Note', score: '8.9', genre: 'Thriller, Psychologique', desc: 'Un cahier qui tue' },
        { title: 'Demon Slayer', score: '8.7', genre: 'Action, Fantaisie', desc: 'Chasseurs de démons' },
        { title: 'One Piece', score: '9.2', genre: 'Aventure, Action', desc: 'Quête du One Piece' },
        { title: 'Jujutsu Kaisen', score: '8.8', genre: 'Action, Surnaturel', desc: 'Exorcistes modernes' },
        { title: 'Hunter x Hunter', score: '9.1', genre: 'Aventure, Action', desc: 'Chasseurs légendaires' }
      ];
      const a = animes[Math.floor(Math.random() * animes.length)];
      reply(`🎌 *Recommandation Anime*\n\n📺 *${a.title}*\n⭐ Score: ${a.score}/10\n🎭 Genre: ${a.genre}\n📝 ${a.desc}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'asearch':
    case 'anime': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [nom anime]`);
      await reply('🔍 Recherche anime...');
      try {
        const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(text)}&limit=1`);
        const a = res.data?.data?.[0];
        if (!a) return reply(`❌ Anime "${text}" non trouvé!`);
        const img = a.images?.jpg?.large_image_url;
        const caption = `🎌 *${a.title}*\n\n⭐ Score: ${a.score || 'N/A'}/10\n📺 Épisodes: ${a.episodes || 'N/A'}\n🎭 Genre: ${a.genres?.map(g=>g.name).join(', ') || 'N/A'}\n📅 Statut: ${a.status}\n📝 ${a.synopsis?.substring(0, 300)}...\n\n🔗 ${a.url}\n\n${config.BOT_FOOTER}`;
        if (img) {
          await sock.sendMessage(from, { image: { url: img }, caption }, { quoted: msg });
        } else {
          reply(caption);
        }
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'manga': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}manga [nom manga]`);
      await reply('🔍 Recherche manga...');
      try {
        const res = await axios.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(text)}&limit=1`);
        const m = res.data?.data?.[0];
        if (!m) return reply(`❌ Manga "${text}" non trouvé!`);
        const img = m.images?.jpg?.large_image_url;
        const caption = `📖 *${m.title}*\n\n⭐ Score: ${m.score || 'N/A'}/10\n📚 Chapitres: ${m.chapters || 'En cours'}\n🎭 Genre: ${m.genres?.map(g=>g.name).join(', ') || 'N/A'}\n📅 Statut: ${m.status}\n📝 ${m.synopsis?.substring(0, 300)}...\n\n🔗 ${m.url}\n\n${config.BOT_FOOTER}`;
        if (img) {
          await sock.sendMessage(from, { image: { url: img }, caption }, { quoted: msg });
        } else {
          reply(caption);
        }
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'lyrics': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}lyrics [titre chanson]`);
      await reply('🎵 Recherche des paroles...');
      try {
        const res = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(text.split(' ').slice(0,2).join('/'))}/${encodeURIComponent(text.split(' ').slice(2).join(' ') || text)}`);
        const lyrics = res.data?.lyrics;
        if (!lyrics) return reply(`❌ Paroles non trouvées pour "${text}"`);
        const truncated = lyrics.substring(0, 1500);
        reply(`🎵 *Paroles - ${text}*\n\n${truncated}${lyrics.length > 1500 ? '\n...(tronqué)' : ''}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        try {
          const res2 = await axios.get(`https://some-random-api.com/lyrics?title=${encodeURIComponent(text)}`);
          const lyrics = res2.data?.lyrics;
          if (!lyrics) return reply(`❌ Paroles non trouvées!`);
          reply(`🎵 *Paroles - ${text}*\n\n${lyrics.substring(0, 1500)}\n\n${config.BOT_FOOTER}`);
        } catch(e2) {
          reply(`❌ Paroles non trouvées pour "${text}"\n\n${config.BOT_FOOTER}`);
        }
      }
      return true;
    }

    case 'weather': {
      return false;
    }

    default:
      return false;
  }
}

module.exports = { handle };
