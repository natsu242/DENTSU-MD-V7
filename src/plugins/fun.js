const config = require('../config');
const axios = require('axios');

const FUN_MENU = `
╔══════════════════════╗
║    🎉 *FUN MENU*    ║
╚══════════════════════╝

│ ${config.PREFIX}truth
│ ${config.PREFIX}dare
│ ${config.PREFIX}joke
│ ${config.PREFIX}meme
│ ${config.PREFIX}ship @user1 @user2
│ ${config.PREFIX}rate [chose]
│ ${config.PREFIX}flirt @user
│ ${config.PREFIX}roast @user
│ ${config.PREFIX}compliment @user
│ ${config.PREFIX}wouldyou
│ ${config.PREFIX}8ball [question]
│ ${config.PREFIX}advice
│ ${config.PREFIX}urban [mot]
│ ${config.PREFIX}moviequote
│ ${config.PREFIX}triviafact
│ ${config.PREFIX}inspire
│ ${config.PREFIX}ascii [texte]

${config.BOT_FOOTER}`;

const truths = [
  "Quelle est ta plus grande peur ?",
  "Quel est ton secret le plus embarrassant ?",
  "As-tu déjà menti à un ami proche ?",
  "Quelle est la chose la plus stupide que tu aies faite ?",
  "Qui est ton crush en ce moment ?",
  "Quelle est ta plus grande faiblesse ?",
  "As-tu déjà trahi la confiance de quelqu'un ?",
  "Quel est ton plus grand regret ?",
  "Quelle est la chose la plus bizarre que tu aies mangée ?",
  "As-tu déjà volé quelque chose ?"
];

const dares = [
  "Envoie ton selfie le plus bizarre !",
  "Envoie un message gênant à ton contact le plus récent !",
  "Fais 20 pompes et prouve-le !",
  "Chante une chanson et envoie l'audio !",
  "Dis 'Je t'aime' à la prochaine personne qui te texte !",
  "Change ton status WhatsApp en 'Je suis fou/folle' pendant 1h !",
  "Envoie une blague nulle à 5 amis !",
  "Imite un animal et envoie l'audio !",
  "Écris un poème en 2 minutes et envoie-le !",
  "Dis 'BANZAI' à voix haute 3 fois !"
];

const jokes = [
  "Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tomberaient dans le bateau ! 😂",
  "Qu'est-ce qu'un canif ? C'est le petit frère du canard ! 🦆",
  "Pourquoi les squelettes ne se battent jamais ? Ils n'ont pas le cœur à ça ! 💀",
  "Que dit un oignon quand il se baigne ? Oh! un bain! 🧅",
  "Pourquoi les vaches portent-elles des cloches ? Parce que leurs cornes ne sonnent pas ! 🐄",
  "Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ? Un chat-peint de Noël ! 🐱",
  "Qu'est-ce qu'un crocodile qui surveille la cour d'école ? Un sac à dents ! 🐊",
  "Pourquoi les éléphants n'utilisent pas d'ordinateurs ? Parce qu'ils ont peur des souris ! 🐘"
];

const quotes = [
  "\"La vie est courte, souris pendant qu'il te reste des dents.\" - Inconnu",
  "\"Le succès c'est aller d'échec en échec sans perdre son enthousiasme.\" - Winston Churchill",
  "\"Sois le changement que tu veux voir dans le monde.\" - Gandhi",
  "\"L'imagination est plus importante que le savoir.\" - Einstein",
  "\"La seule façon de faire du bon travail est d'aimer ce que tu fais.\" - Steve Jobs",
  "\"Le meilleur moment pour planter un arbre était il y a 20 ans. Le deuxième meilleur moment c'est maintenant.\" - Proverbe chinois"
];

const flirts = [
  "✨ Tu es si beau(belle) que même les étoiles te demandent ton secret !",
  "💖 Si la beauté était un crime, tu serais condamné(e) à perpétuité !",
  "🌹 Chaque fois que je te vois, je comprends pourquoi le soleil brille !",
  "💫 Tu es la raison pour laquelle mon téléphone ne quitte pas ma main !",
  "🎵 Ta voix est la plus belle mélodie que j'aie jamais entendue !"
];

const roasts = [
  "😂 T'es tellement lent(e) que tu mettrais 2h à regarder 60 minutes !",
  "🤣 Ton cerveau fonctionne comme un PC Windows 95 !",
  "😏 T'as l'air d'un avant-après... avant le café du matin !",
  "💀 Si la bêtise était douloureuse, tu crierais 24h/24 !",
  "😂 Tu es la preuve que l'évolution peut aller dans les deux sens !"
];

async function handle(ctx) {
  const { command, text, reply, sock, from, msg, args } = ctx;

  if (command === 'funmenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: FUN_MENU
    }, { quoted: msg });
    return true;
  }

  switch(command) {
    case 'truth':
      reply(`🎲 *Vérité*\n\n${truths[Math.floor(Math.random() * truths.length)]}\n\n${config.BOT_FOOTER}`);
      return true;

    case 'dare':
      reply(`🎯 *Défi*\n\n${dares[Math.floor(Math.random() * dares.length)]}\n\n${config.BOT_FOOTER}`);
      return true;

    case 'joke':
    case 'meme':
      reply(`😂 *Blague du jour*\n\n${jokes[Math.floor(Math.random() * jokes.length)]}\n\n${config.BOT_FOOTER}`);
      return true;

    case 'ship': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentioned.length < 2) return reply('❌ Mentionne 2 personnes! Ex: .ship @user1 @user2');
      const pct = Math.floor(Math.random() * 101);
      const bar = '❤️'.repeat(Math.floor(pct/10)) + '🖤'.repeat(10-Math.floor(pct/10));
      reply(`💕 *Ship Meter*\n\n@${mentioned[0].split('@')[0]} + @${mentioned[1].split('@')[0]}\n\n${bar}\n💯 Compatibilité: ${pct}%\n\n${pct >= 75 ? '🔥 PARFAITS!' : pct >= 50 ? '💛 Bonne chance!' : '💔 Hmm...'}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'rate': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}rate [chose]`);
      const pct = Math.floor(Math.random() * 101);
      const stars = '⭐'.repeat(Math.floor(pct/20));
      reply(`⭐ *Rating*\n\n"${text}"\n\n${stars}\n📊 Score: ${pct}/100\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'flirt': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const target = mentioned.length ? `@${mentioned[0].split('@')[0]}` : 'toi';
      reply(`💖 *Flirt pour ${target}*\n\n${flirts[Math.floor(Math.random() * flirts.length)]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'roast': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const target = mentioned.length ? `@${mentioned[0].split('@')[0]}` : 'toi';
      reply(`🔥 *Roast pour ${target}*\n\n${roasts[Math.floor(Math.random() * roasts.length)]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'compliment': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const target = mentioned.length ? `@${mentioned[0].split('@')[0]}` : 'toi';
      const compliments = [
        "Tu es quelqu'un d'exceptionnel!",
        "Le monde est meilleur avec toi dedans!",
        "Ta gentillesse illumine les journées des autres!",
        "Tu as un sourire qui rend les gens heureux!",
        "Tu es plus fort(e) que tu ne le crois!"
      ];
      reply(`💐 *Compliment pour ${target}*\n\n${compliments[Math.floor(Math.random() * compliments.length)]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'wouldyou': {
      const scenarios = [
        "Préférerais-tu avoir le pouvoir de voler ou d'être invisible ?",
        "Vivrais-tu 100 ans normalement ou 50 ans en parfaite santé ?",
        "Choisirais-tu d'être très riche mais seul ou avoir des amis mais pauvre ?",
        "Préférerais-tu parler toutes les langues ou jouer de tous les instruments ?",
        "Voyagerais-tu dans le passé ou dans le futur ?"
      ];
      reply(`🤔 *Would You Rather?*\n\n${scenarios[Math.floor(Math.random() * scenarios.length)]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case '8ball': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}8ball [question]`);
      const answers = [
        '✅ Oui, certainement!', '✅ Sans aucun doute!', '✅ Très probablement!',
        '✅ Les signes pointent vers oui!', '✅ Ma réponse est oui!',
        '❓ Difficile à dire maintenant...', '❓ Concentre-toi et redemande!',
        '❓ Pas de réponse pour l\'instant...', '❓ La réponse est floue...',
        '❌ Ne compte pas là-dessus!', '❌ Ma réponse est non!', '❌ Perspectives très sombres!'
      ];
      reply(`🎱 *8-Ball*\n\n❓ ${text}\n\n${answers[Math.floor(Math.random() * answers.length)]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'advice': {
      const advices = [
        "Souris chaque matin, même si tu n'en as pas envie. Ça devient une habitude!",
        "Ne remets pas à demain ce que tu peux faire aujourd'hui!",
        "Traite les autres comme tu voudrais être traité!",
        "La patience est la clé de toutes les portes!",
        "Chaque jour est une nouvelle chance de s'améliorer!",
        "Lis au moins 10 pages d'un bon livre chaque jour!",
        "Prends soin de ta santé mentale autant que physique!"
      ];
      reply(`💡 *Conseil du jour*\n\n${advices[Math.floor(Math.random() * advices.length)]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'moviequote':
      reply(`🎬 *Citation de film*\n\n${quotes[Math.floor(Math.random() * quotes.length)]}\n\n${config.BOT_FOOTER}`);
      return true;

    case 'inspire':
      reply(`✨ *Inspiration*\n\n${quotes[Math.floor(Math.random() * quotes.length)]}\n\n${config.BOT_FOOTER}`);
      return true;

    case 'triviafact': {
      const facts = [
        "🌍 La Grande Muraille de Chine n'est pas visible depuis l'espace à l'œil nu!",
        "🐙 Les pieuvres ont trois cœurs!",
        "🍯 Le miel ne se périme jamais - on a trouvé du miel comestible de 3000 ans dans des tombes égyptiennes!",
        "🦋 Les papillons goûtent avec leurs pieds!",
        "🌙 Une journée sur Vénus est plus longue qu'une année sur Vénus!",
        "🐬 Les dauphins ont des noms propres - ils s'appellent entre eux par des sifflements uniques!",
        "🧠 Le cerveau humain peut stocker environ 2,5 pétaoctets d'informations!"
      ];
      reply(`🧠 *Fact du jour*\n\n${facts[Math.floor(Math.random() * facts.length)]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'urban': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}urban [mot]`);
      try {
        const res = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(text)}`);
        const def = res.data?.list?.[0];
        if (!def) return reply(`❌ Aucune définition pour "${text}"`);
        reply(`📖 *Urban Dictionary*\n\n*${text}*\n\n${def.definition.substring(0, 500)}\n\n_Exemple: ${def.example?.substring(0, 200) || 'N/A'}_\n\n👍 ${def.thumbs_up} | 👎 ${def.thumbs_down}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Impossible de trouver la définition de "${text}"`);
      }
      return true;
    }

    case 'ascii': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}ascii [texte]`);
      const map = { A:'/-\\', B:'|3', C:'(', D:'|)', E:'3', F:'|=', G:'6', H:'|-|', I:'!', J:'_|', K:'|<', L:'|_', M:'|\\/|', N:'|\\|', O:'0', P:'|D', Q:'(_,)', R:'|2', S:'5', T:'7', U:'|_|', V:'\\/', W:'\\/\\/', X:'><', Y:'`/', Z:'2' };
      const ascii = text.toUpperCase().split('').map(c => map[c] || c).join(' ');
      reply(`🔤 *ASCII*\n\n${ascii}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
