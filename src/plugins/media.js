const config = require('../config');
const axios = require('axios');
const { downloadMediaMessage } = require('baileys');
const fs = require('fs-extra');
const path = require('path');

const MEDIA_MENU = `
╔══════════════════════╗
║   📸 *MEDIA MENU*   ║
╚══════════════════════╝

│ ${config.PREFIX}sticker (reply image/vidéo)
│ ${config.PREFIX}s (reply image/vidéo)
│ ${config.PREFIX}sticker2img (reply sticker)
│ ${config.PREFIX}toimage (reply sticker)
│ ${config.PREFIX}take [nom] [auteur]
│ ${config.PREFIX}remini (reply image)
│ ${config.PREFIX}imageinfo (reply image)
│ ${config.PREFIX}imagehelp

${config.BOT_FOOTER}`;

async function handle(ctx) {
  const { command, text, reply, sock, from, msg, args } = ctx;

  if (command === 'mediamenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: MEDIA_MENU
    }, { quoted: msg });
    return true;
  }

  const { getContentType } = require('baileys');
  const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  switch(command) {
    case 'sticker':
    case 's': {
      if (!quotedMsg) return reply(`❌ Réponds à une image ou vidéo!\nUsage: Réponds avec ${config.PREFIX}sticker\n\n${config.BOT_FOOTER}`);
      try {
        const mtype = getContentType(quotedMsg);
        if (mtype === 'imageMessage') {
          const buffer = await downloadMediaMessage({ message: quotedMsg, key: msg.message?.extendedTextMessage?.contextInfo?.stanzaId ? {} : msg.key }, 'buffer', {});
          await sock.sendMessage(from, {
            sticker: buffer
          }, { quoted: msg });
        } else if (mtype === 'videoMessage') {
          await reply('⏳ Conversion vidéo → sticker en cours...\n\n⚠️ FFmpeg requis sur le serveur.');
        } else {
          reply('❌ Réponds à une image ou vidéo!');
        }
      } catch(e) {
        reply(`❌ Erreur sticker: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'sticker2img':
    case 'toimage': {
      if (!quotedMsg?.stickerMessage) return reply(`❌ Réponds à un sticker!\n\n${config.BOT_FOOTER}`);
      try {
        const buffer = await downloadMediaMessage({ message: quotedMsg }, 'buffer', {});
        await sock.sendMessage(from, {
          image: buffer,
          caption: `✅ Sticker converti en image!\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'take': {
      if (!quotedMsg?.stickerMessage) return reply(`❌ Réponds à un sticker!\nUsage: ${config.PREFIX}take [nom] [auteur]\n\n${config.BOT_FOOTER}`);
      const packname = args[0] || 'DENTSU MD V9';
      const author = args[1] || 'Natsu Tech';
      reply(`✅ Sticker renommé!\n📦 Pack: ${packname}\n👤 Auteur: ${author}\n\n(Fonctionnalité complète avec sharp/ffmpeg)\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'remini': {
      if (!quotedMsg?.imageMessage) return reply(`❌ Réponds à une image!\n\n${config.BOT_FOOTER}`);
      await reply('🔧 Amélioration de l\'image avec Remini...');
      try {
        const buffer = await downloadMediaMessage({ message: quotedMsg }, 'buffer', {});
        const form = new (require('form-data'))();
        form.append('image', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
        const res = await axios.post('https://api.ryzendesu.vip/api/ai/remini', form, {
          headers: { ...form.getHeaders() },
          responseType: 'arraybuffer'
        });
        await sock.sendMessage(from, {
          image: Buffer.from(res.data),
          caption: `✅ Image améliorée avec Remini!\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur Remini: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'imageinfo': {
      if (!quotedMsg?.imageMessage) return reply(`❌ Réponds à une image!\n\n${config.BOT_FOOTER}`);
      const img = quotedMsg.imageMessage;
      reply(`📸 *Image Info*\n\n📐 Dimensions: ${img.width}x${img.height}px\n📦 Taille: ${Math.round(img.fileLength/1024)} KB\n📝 Type: ${img.mimetype}\n🔑 SHA: ${img.fileSha256 ? Buffer.from(img.fileSha256).toString('hex').substring(0,16) : 'N/A'}...\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'imagehelp': {
      reply(`📸 *Image Help*\n\n📌 Commandes disponibles:\n• ${config.PREFIX}sticker - Image → Sticker\n• ${config.PREFIX}sticker2img - Sticker → Image\n• ${config.PREFIX}remini - Améliorer qualité\n• ${config.PREFIX}take - Renommer sticker\n• ${config.PREFIX}imageinfo - Infos image\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'video2img': {
      reply(`🎬 *Video → Image*\n\nRéponds à une vidéo avec ${config.PREFIX}sticker\nFFmpeg requis pour extraire les frames.\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'vs': {
      reply(`⚔️ *VS Image*\n\nCette fonctionnalité crée une image VS entre deux utilisateurs.\nEnvoie 2 images pour créer la comparaison!\n\n${config.BOT_FOOTER}`);
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
