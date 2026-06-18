const axios = require('axios');
const config = require('../config');

const AI_MENUS = {
  aimenu: `
╔══════════════════════╗
║    🧠 *AI MENU*     ║
╚══════════════════════╝

│ ${config.PREFIX}ai [question]
│ ${config.PREFIX}gpt [question]
│ ${config.PREFIX}gpt4 [question]
│ ${config.PREFIX}gpt5 [question]
│ ${config.PREFIX}metaai [question]
│ ${config.PREFIX}codeai [code]
│ ${config.PREFIX}photoai [description]
│ ${config.PREFIX}storyai [thème]
│ ${config.PREFIX}triviaai
│ ${config.PREFIX}deepseek [question]
│ ${config.PREFIX}grok-ai [question]
│ ${config.PREFIX}qwen [question]
│ ${config.PREFIX}gemini [question]

${config.BOT_FOOTER}`
};

async function callFreeAI(question, model = 'gpt-3.5-turbo') {
  try {
    const res = await axios.get(`https://api.simsimi.vip/v1/simtalk?text=${encodeURIComponent(question)}&lc=fr`);
    return res.data?.success || 'Désolé, je ne peux pas répondre pour le moment.';
  } catch(e) {
    try {
      const res2 = await axios.get(`https://api.ryzendesu.vip/api/ai/chatgpt?text=${encodeURIComponent(question)}`);
      return res2.data?.answer || res2.data?.response || 'Je ne peux pas répondre maintenant.';
    } catch(e2) {
      return `🤖 *IA temporairement indisponible*\nEssaie plus tard ou vérifie ta connexion.`;
    }
  }
}

async function handle(ctx) {
  const { command, text, reply, sendImage, from, sock, msg } = ctx;

  if (AI_MENUS[command]) {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: AI_MENUS[command]
    }, { quoted: msg });
    return true;
  }

  switch(command) {
    case 'ai':
    case 'gpt':
    case 'gpt4':
    case 'gpt5':
    case 'metaai':
    case 'deepseek':
    case 'grok-ai':
    case 'qwen': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}${command} [question]`);
      await reply('🤖 Traitement en cours...');
      const resp = await callFreeAI(text, command);
      return reply(`🧠 *${command.toUpperCase()}*\n\n${resp}\n\n${config.BOT_FOOTER}`);
    }

    case 'gemini': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}gemini [question]`);
      await reply('✨ Gemini pense...');
      try {
        const res = await axios.get(`https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(text)}`);
        const ans = res.data?.answer || res.data?.response || 'Pas de réponse.';
        return reply(`✨ *Gemini AI*\n\n${ans}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        const ans = await callFreeAI(text);
        return reply(`✨ *Gemini AI*\n\n${ans}\n\n${config.BOT_FOOTER}`);
      }
    }

    case 'codeai': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}codeai [code ou question de code]`);
      await reply('💻 Analyse du code...');
      const resp = await callFreeAI(`Réponds en tant qu'expert développeur. Question: ${text}`);
      return reply(`💻 *Code AI*\n\n\`\`\`${resp}\`\`\`\n\n${config.BOT_FOOTER}`);
    }

    case 'storyai': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}storyai [thème]`);
      await reply('📖 Création d\'histoire...');
      const resp = await callFreeAI(`Écris une courte histoire créative sur le thème: ${text}`);
      return reply(`📖 *Story AI*\n\n${resp}\n\n${config.BOT_FOOTER}`);
    }

    case 'triviaai': {
      await reply('🎯 Génération de trivia...');
      const resp = await callFreeAI('Donne moi une question de culture générale intéressante avec sa réponse');
      return reply(`🎯 *Trivia AI*\n\n${resp}\n\n${config.BOT_FOOTER}`);
    }

    case 'photoai': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}photoai [description]`);
      return reply(`🖼️ *Photo AI*\n\nDescription: "${text}"\n\n⚠️ La génération d'images nécessite une API premium.\nVisite: ${config.WEBSITE}\n\n${config.BOT_FOOTER}`);
    }

    default:
      return false;
  }
}

module.exports = { handle };
