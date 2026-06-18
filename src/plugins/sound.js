const config = require('../config');

const SOUND_MENU = `
╔══════════════════════╗
║   🎵 *SOUND MENU*   ║
╚══════════════════════╝

│ ${config.PREFIX}bass [reply audio]
│ ${config.PREFIX}blown [reply audio]
│ ${config.PREFIX}deep [reply audio]
│ ${config.PREFIX}earrape [reply audio]
│ ${config.PREFIX}fast [reply audio]
│ ${config.PREFIX}nightcore [reply audio]
│ ${config.PREFIX}reverse [reply audio]
│ ${config.PREFIX}robot [reply audio]
│ ${config.PREFIX}slow [reply audio]
│ ${config.PREFIX}smooth [reply audio]
│ ${config.PREFIX}squirrel [reply audio]
│ ${config.PREFIX}tts [texte]
│ ${config.PREFIX}say [texte]

⚠️ FFmpeg requis pour les effets audio

${config.BOT_FOOTER}`;

async function handle(ctx) {
  const { command, text, reply, sock, from, msg } = ctx;

  if (command === 'soundmenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: SOUND_MENU
    }, { quoted: msg });
    return true;
  }

  const soundCmds = ['bass','blown','deep','earrape','fast','nightcore','reverse','robot','slow','smooth','squirrel'];

  if (soundCmds.includes(command)) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted?.audioMessage && !quoted?.videoMessage) {
      return reply(`❌ Réponds à un audio/vidéo!\nUsage: Réponds à un audio avec ${config.PREFIX}${command}\n\n${config.BOT_FOOTER}`);
    }
    return reply(`⏳ Effet *${command}* en cours de traitement...\n\n⚠️ FFmpeg doit être installé sur le serveur.\n\n${config.BOT_FOOTER}`);
  }

  switch(command) {
    case 'tts':
    case 'say': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [texte à lire]`);
      try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=fr&client=tw-ob&q=${encodeURIComponent(text)}`;
        await sock.sendMessage(from, {
          audio: { url },
          mimetype: 'audio/mp4',
          ptt: true
        }, { quoted: msg });
      } catch(e) {
        reply(`❌ Erreur TTS: ${e.message}\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
