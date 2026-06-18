const config = require('../config');
const axios = require('axios');

const DL_MENU = `
╔══════════════════════╗
║  📥 *DOWNLOADER*    ║
╚══════════════════════╝

│ ${config.PREFIX}ytmp3 [url/titre]
│ ${config.PREFIX}ytb [url]
│ ${config.PREFIX}yta [url]
│ ${config.PREFIX}song [titre]
│ ${config.PREFIX}play [titre]
│ ${config.PREFIX}mp4 [url]
│ ${config.PREFIX}video [url]
│ ${config.PREFIX}fb [url]
│ ${config.PREFIX}insta [url]
│ ${config.PREFIX}git [user/repo]
│ ${config.PREFIX}pint [url]
│ ${config.PREFIX}apk [nom app]

${config.BOT_FOOTER}`;

async function searchYT(query) {
  try {
    const res = await axios.get(`https://api.ryzendesu.vip/api/search/yt?query=${encodeURIComponent(query)}`);
    return res.data?.result?.[0] || null;
  } catch(e) { return null; }
}

async function handle(ctx) {
  const { command, text, reply, sock, from, msg } = ctx;

  if (command === 'dlmenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: DL_MENU
    }, { quoted: msg });
    return true;
  }

  switch(command) {
    case 'ytmp3':
    case 'song':
    case 'play':
    case 'yta': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [titre ou URL YouTube]`);
      await reply('🔍 Recherche en cours...');
      try {
        const apis = [
          `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(text.includes('youtube') || text.includes('youtu.be') ? text : `https://www.youtube.com/results?search_query=${text}`)}`,
          `https://api.akuari.my.id/dl/ytmp3?url=${encodeURIComponent(text)}`
        ];
        let audioUrl = null;
        let title = text;
        for (const api of apis) {
          try {
            const res = await axios.get(api);
            audioUrl = res.data?.url || res.data?.download?.url || res.data?.data?.url;
            title = res.data?.title || res.data?.data?.title || text;
            if (audioUrl) break;
          } catch(e2) {}
        }
        if (!audioUrl) return reply(`⚠️ Téléchargement temporairement indisponible.\nEssaie avec un lien YouTube direct!\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, {
          audio: { url: audioUrl },
          mimetype: 'audio/mp4',
          fileName: `${title}.mp3`
        }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'ytb':
    case 'video':
    case 'mp4': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [URL YouTube]`);
      await reply('🎬 Téléchargement vidéo en cours...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(text)}`);
        const videoUrl = res.data?.url || res.data?.download?.url;
        const title = res.data?.title || 'video';
        if (!videoUrl) return reply(`⚠️ Impossible de télécharger cette vidéo.\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, {
          video: { url: videoUrl },
          caption: `🎬 ${title}\n\n${config.BOT_FOOTER}`,
          fileName: `${title}.mp4`
        }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'fb': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}fb [URL Facebook]`);
      await reply('📥 Téléchargement Facebook...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/fb?url=${encodeURIComponent(text)}`);
        const url = res.data?.url || res.data?.hd || res.data?.sd;
        if (!url) return reply(`❌ Impossible de télécharger cette vidéo Facebook.\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, {
          video: { url },
          caption: `📥 Facebook Vidéo\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\nAssure-toi que le lien est public!\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'insta': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}insta [URL Instagram]`);
      await reply('📥 Téléchargement Instagram...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/instagram?url=${encodeURIComponent(text)}`);
        const url = res.data?.url?.[0] || res.data?.data?.[0]?.url;
        if (!url) return reply(`❌ Impossible de télécharger ce contenu Instagram.\n\n${config.BOT_FOOTER}`);
        if (url.includes('.mp4') || url.includes('video')) {
          await sock.sendMessage(from, { video: { url }, caption: `📥 Instagram\n\n${config.BOT_FOOTER}` }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { image: { url }, caption: `📥 Instagram\n\n${config.BOT_FOOTER}` }, { quoted: msg });
        }
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'git':
    case 'gitclone': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}git [user/repo]`);
      reply(`🐙 *GitHub Repository*\n\n📦 Repo: ${text}\n🔗 URL: https://github.com/${text}\n📥 Clone: git clone https://github.com/${text}.git\n📁 ZIP: https://github.com/${text}/archive/refs/heads/main.zip\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'pint': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}pint [URL Pinterest]`);
      await reply('📥 Téléchargement Pinterest...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/pinterest?url=${encodeURIComponent(text)}`);
        const url = res.data?.url || res.data?.data?.url;
        if (!url) return reply(`❌ Impossible de télécharger.\n\n${config.BOT_FOOTER}`);
        await sock.sendMessage(from, { image: { url }, caption: `📥 Pinterest\n\n${config.BOT_FOOTER}` }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'apk': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}apk [nom de l'application]`);
      reply(`📱 *APK Downloader*\n\nRecherche de: "${text}"\n\n🔗 Télécharge depuis:\n• https://apkpure.com/search?q=${encodeURIComponent(text)}\n• https://apkmirror.com/?s=${encodeURIComponent(text)}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'mega': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}mega [URL Mega.nz]`);
      reply(`☁️ *Mega.nz Download*\n\n🔗 Lien: ${text}\n\n⚠️ Le téléchargement Mega nécessite une authentification.\nUtilise l'app officielle Mega pour télécharger.\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'edit': {
      reply(`📝 *Éditeur de médias*\n\nFonctionnalité disponible via:\n• Réponds à une image avec ${config.PREFIX}sticker\n• Réponds à une image avec ${config.PREFIX}remini\n\n${config.BOT_FOOTER}`);
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
