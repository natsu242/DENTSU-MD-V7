const config = require('../config');
const axios = require('axios');

const SEARCH_MENU = `
╔══════════════════════╗
║  🔍 *SEARCH MENU*   ║
╚══════════════════════╝

│ ${config.PREFIX}img [recherche]
│ ${config.PREFIX}wiki [recherche]
│ ${config.PREFIX}yts [titre]
│ ${config.PREFIX}calc [calcul]
│ ${config.PREFIX}circle [url image]
│ ${config.PREFIX}get [url]
│ ${config.PREFIX}shorturl [url]
│ ${config.PREFIX}tomp3 [url]
│ ${config.PREFIX}iplookup [ip]
│ ${config.PREFIX}ffstalk [uid FF]
│ ${config.PREFIX}npmstalk [package]

${config.BOT_FOOTER}`;

async function handle(ctx) {
  const { command, text, reply, sock, from, msg, args } = ctx;

  if (command === 'searchmenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: SEARCH_MENU
    }, { quoted: msg });
    return true;
  }

  switch(command) {
    case 'img': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}img [recherche]`);
      await reply('🔍 Recherche d\'images...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/search/gsearch?query=${encodeURIComponent(text)}&type=image`);
        const images = res.data?.result || res.data?.images || [];
        if (!images.length) return reply(`❌ Aucune image trouvée pour "${text}"`);
        const img = images[Math.floor(Math.random() * Math.min(images.length, 5))];
        const url = img.url || img.link || img;
        await sock.sendMessage(from, {
          image: { url },
          caption: `🖼️ *${text}*\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur recherche: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'yts': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}yts [titre]`);
      await reply('🔍 Recherche YouTube...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/search/yt?query=${encodeURIComponent(text)}`);
        const results = res.data?.result?.slice(0, 5) || [];
        if (!results.length) return reply(`❌ Aucun résultat pour "${text}"`);
        let txt = `🎬 *Résultats YouTube - "${text}"*\n\n`;
        results.forEach((r, i) => {
          txt += `${i+1}. *${r.title}*\n   ⏱️ ${r.duration || 'N/A'} | 👁️ ${r.views || 'N/A'}\n   🔗 https://youtube.com/watch?v=${r.id || r.videoId}\n\n`;
        });
        txt += config.BOT_FOOTER;
        reply(txt);
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'iplookup': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}iplookup [adresse IP]`);
      try {
        const res = await axios.get(`https://ipapi.co/${text}/json/`);
        if (res.data.error) return reply(`❌ IP invalide!`);
        const d = res.data;
        reply(`🌐 *IP Lookup*\n\n📡 IP: ${d.ip}\n🌍 Pays: ${d.country_name} ${d.country_code}\n🏙️ Ville: ${d.city}\n📍 Région: ${d.region}\n📮 Code postal: ${d.postal}\n⏰ Fuseau: ${d.timezone}\n🔢 ASN: ${d.asn}\n🏢 FAI: ${d.org}\n📍 Coords: ${d.latitude}, ${d.longitude}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'circle': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}circle [URL image]`);
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/edit/circle?url=${encodeURIComponent(text)}`, { responseType: 'arraybuffer' });
        await sock.sendMessage(from, {
          image: Buffer.from(res.data),
          caption: `⭕ Image circulaire\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'get': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}get [URL]`);
      try {
        const res = await axios.get(text, { timeout: 10000 });
        const content = JSON.stringify(res.data, null, 2).substring(0, 2000);
        reply(`📡 *GET Request*\n\n🔗 URL: ${text}\n📊 Status: ${res.status}\n\n\`\`\`${content}\`\`\`\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Erreur requête: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'tomp3': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}tomp3 [URL vidéo/audio]`);
      reply(`🎵 Utilise ${config.PREFIX}ytmp3 [URL YouTube] pour télécharger en MP3!\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'ffstalk': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}ffstalk [UID Free Fire]`);
      await reply('🎮 Recherche du joueur Free Fire...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/stalk/ff?uid=${text}`);
        const d = res.data?.data || res.data;
        if (!d?.AccountInfo) return reply(`❌ Joueur UID "${text}" non trouvé!\n\n${config.BOT_FOOTER}`);
        const info = d.AccountInfo;
        reply(`🎮 *Free Fire - Stalk*\n\n👤 Nom: ${info.AccountName}\n🆔 UID: ${info.AccountId || text}\n🏆 Niveau: ${info.AccountLevel}\n⭐ EXP: ${info.AccountEXP}\n💎 BP: ${info.AccountBP || 'N/A'}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Erreur FF Stalk: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'npmstalk': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}npmstalk [package]`);
      try {
        const res = await axios.get(`https://api.npmjs.org/downloads/point/last-week/${text}`);
        const info = await axios.get(`https://registry.npmjs.org/${text}`);
        const d = info.data;
        reply(`📦 *NPM Stats - ${text}*\n\n📊 Téléchargements/semaine: ${res.data?.downloads?.toLocaleString() || 'N/A'}\n🏷️ Version: ${d['dist-tags']?.latest}\n📅 Modifié: ${new Date(d.time?.modified).toLocaleDateString()}\n📝 Description: ${d.description}\n🌐 ${d.homepage || 'N/A'}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Package "${text}" non trouvé!\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'qrcode': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}qrcode [texte ou URL]`);
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
        await sock.sendMessage(from, {
          image: { url: qrUrl },
          caption: `🔳 *QR Code généré!*\n\n📝 Contenu: ${text}\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'readqr': {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg?.imageMessage) return reply(`❌ Réponds à une image QR!\n\n${config.BOT_FOOTER}`);
      reply(`📷 *Lecture QR Code*\n\n⚠️ Fonctionnalité en cours d'implémentation.\nUtilise une app de scan QR pour lire le code!\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'currency': {
      if (!text || args.length < 3) return reply(`❌ Usage: ${config.PREFIX}currency [montant] [de] [vers]\nEx: ${config.PREFIX}currency 100 USD EUR`);
      const [amount, from2, to] = args;
      try {
        const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from2.toUpperCase()}`);
        const rate = res.data?.rates?.[to.toUpperCase()];
        if (!rate) return reply(`❌ Devise "${to}" non trouvée!`);
        const result = (parseFloat(amount) * rate).toFixed(2);
        reply(`💱 *Conversion de devises*\n\n${amount} ${from2.toUpperCase()} = *${result} ${to.toUpperCase()}*\n\n📊 Taux: 1 ${from2.toUpperCase()} = ${rate} ${to.toUpperCase()}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'time': {
      const moment = require('moment-timezone');
      if (!text) {
        const zones = { 'Brazzaville': 'Africa/Brazzaville', 'Paris': 'Europe/Paris', 'New York': 'America/New_York', 'Tokyo': 'Asia/Tokyo', 'Dubai': 'Asia/Dubai' };
        let timeList = '*🕐 Heures mondiales*\n\n';
        for (const [city, tz] of Object.entries(zones)) {
          timeList += `🌍 ${city}: *${moment().tz(tz).format('HH:mm:ss')}*\n`;
        }
        return reply(timeList + `\n${config.BOT_FOOTER}`);
      }
      const zones2 = { 'brazzaville': 'Africa/Brazzaville', 'paris': 'Europe/Paris', 'london': 'Europe/London', 'new york': 'America/New_York', 'tokyo': 'Asia/Tokyo', 'dubai': 'Asia/Dubai', 'moscow': 'Europe/Moscow' };
      const tz = Object.entries(zones2).find(([k]) => text.toLowerCase().includes(k));
      if (!tz) return reply(`❌ Ville non reconnue!\nVilles: Brazzaville, Paris, London, New York, Tokyo, Dubai, Moscow`);
      const time = moment().tz(tz[1]).format('YYYY-MM-DD HH:mm:ss');
      reply(`🕐 *Heure - ${text}*\n\n${time}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
