const config = require('../config');
const axios = require('axios');
const crypto = require('crypto');

const OTHER_MENU = `
╔══════════════════════╗
║   🔧 *OTHER MENU*   ║
╚══════════════════════╝

│ ${config.PREFIX}weather [ville]
│ ${config.PREFIX}wiki [recherche]
│ ${config.PREFIX}currency [montant] [de] [vers]
│ ${config.PREFIX}time [ville]
│ ${config.PREFIX}qrcode [texte]
│ ${config.PREFIX}shorturl [url]
│ ${config.PREFIX}myip
│ ${config.PREFIX}jid
│ ${config.PREFIX}github [username]
│ ${config.PREFIX}npm [package]
│ ${config.PREFIX}imdb [film]
│ ${config.PREFIX}dictionary [mot]
│ ${config.PREFIX}recipe [plat]
│ ${config.PREFIX}remind [minutes] [message]
│ ${config.PREFIX}calculate [calcul]
│ ${config.PREFIX}mathfact [nombre]
│ ${config.PREFIX}sciencefact
│ ${config.PREFIX}horoscope [signe]
│ ${config.PREFIX}password [longueur]
│ ${config.PREFIX}genpass [longueur]

${config.BOT_FOOTER}`;

async function handle(ctx) {
  const { command, text, reply, sock, from, msg, args } = ctx;

  if (command === 'othermenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: OTHER_MENU
    }, { quoted: msg });
    return true;
  }

  switch(command) {
    case 'weather':
    case 'weatherwiki': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}weather [ville]`);
      try {
        const res = await axios.get(`https://wttr.in/${encodeURIComponent(text)}?format=j1`);
        const w = res.data?.current_condition?.[0];
        if (!w) return reply('❌ Ville non trouvée!');
        reply(`🌤️ *Météo - ${text}*\n\n🌡️ Température: ${w.temp_C}°C (${w.temp_F}°F)\n💧 Humidité: ${w.humidity}%\n💨 Vent: ${w.windspeedKmph} km/h\n☁️ Conditions: ${w.weatherDesc?.[0]?.value || 'N/A'}\n👁️ Visibilité: ${w.visibility} km\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Impossible d'obtenir la météo de "${text}"`);
      }
      return true;
    }

    case 'wiki': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}wiki [recherche]`);
      try {
        const res = await axios.get(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text)}`);
        const data = res.data;
        reply(`📚 *Wikipedia - ${data.title}*\n\n${data.extract?.substring(0, 700) || 'Aucune info'}...\n\n🔗 ${data.content_urls?.desktop?.page || ''}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Aucun résultat pour "${text}"`);
      }
      return true;
    }

    case 'calculate':
    case 'calc': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}calculate [expression]`);
      try {
        const expr = text.replace(/[^0-9+\-*/.() ]/g, '');
        const result = eval(expr);
        reply(`🧮 *Calcul*\n\n${text} = *${result}*\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Expression invalide!`);
      }
      return true;
    }

    case 'jid': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const target = mentioned[0] || ctx.sender;
      reply(`🆔 *JID Info*\n\n👤 JID: ${target}\n📱 Numéro: ${target.split('@')[0]}\n🌐 Serveur: ${target.split('@')[1]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'github': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}github [username]`);
      try {
        const res = await axios.get(`https://api.github.com/users/${text}`);
        const u = res.data;
        reply(`🐙 *GitHub - ${u.login}*\n\n📛 Nom: ${u.name || 'N/A'}\n🌍 Localisation: ${u.location || 'N/A'}\n📝 Bio: ${u.bio || 'N/A'}\n📦 Dépôts publics: ${u.public_repos}\n👥 Followers: ${u.followers}\n👤 Suivant: ${u.following}\n🔗 ${u.html_url}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Utilisateur "${text}" non trouvé!`);
      }
      return true;
    }

    case 'npm': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}npm [package]`);
      try {
        const res = await axios.get(`https://registry.npmjs.org/${text}`);
        const p = res.data;
        const latest = p['dist-tags']?.latest;
        const version = p.versions?.[latest];
        reply(`📦 *NPM - ${p.name}*\n\n📝 Description: ${p.description || 'N/A'}\n🏷️ Version: ${latest}\n👤 Auteur: ${version?.author?.name || p.author?.name || 'N/A'}\n📅 Créé: ${new Date(p.time?.created).toLocaleDateString()}\n⬇️ Stats: ${p.keywords?.join(', ') || 'N/A'}\n🔗 https://npmjs.com/package/${text}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Package "${text}" non trouvé!`);
      }
      return true;
    }

    case 'shorturl': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}shorturl [url]`);
      try {
        const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`);
        reply(`🔗 *URL Raccourcie*\n\nOriginal: ${text}\nCourt: ${res.data}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Erreur: ${e.message}`);
      }
      return true;
    }

    case 'myip': {
      try {
        const res = await axios.get('https://api.ipify.org?format=json');
        reply(`🌐 *Mon IP*\n\n${res.data.ip}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Erreur: ${e.message}`);
      }
      return true;
    }

    case 'password':
    case 'genpass': {
      const length = parseInt(text) || 16;
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let pass = '';
      for (let i = 0; i < Math.min(length, 64); i++) {
        pass += chars[Math.floor(Math.random() * chars.length)];
      }
      reply(`🔐 *Mot de passe généré*\n\n\`${pass}\`\n\n📏 Longueur: ${pass.length} caractères\n\n⚠️ Ne partage jamais ton mot de passe!\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'mathfact': {
      const num = parseInt(text) || Math.floor(Math.random() * 1000);
      try {
        const res = await axios.get(`http://numbersapi.com/${num}/math`);
        reply(`🔢 *Math Fact: ${num}*\n\n${res.data}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`🔢 *Math Fact: ${num}*\n\n${num} est un nombre ${num % 2 === 0 ? 'pair' : 'impair'}${num > 0 ? ' positif' : ' négatif'}!\n\n${config.BOT_FOOTER}`);
      }
      return true;
    }

    case 'sciencefact': {
      const facts = [
        "⚗️ L'eau pure est un excellent isolant électrique - c'est les minéraux dissous qui conduisent le courant!",
        "🧬 L'ADN humain, si on le déroulait, ferait 2 mètres de long. Multiplié par toutes les cellules du corps = 170 milliards de km!",
        "⚡ Un éclair contient environ 1 milliard de volts d'électricité!",
        "🌌 Il y a plus d'étoiles dans l'univers que de grains de sable sur toutes les plages de la Terre!",
        "🦠 Le corps humain contient plus de bactéries que de cellules humaines!",
        "💡 La lumière du soleil prend 8 minutes et 20 secondes pour atteindre la Terre!",
        "🌊 L'océan contient 97% de l'eau de la Terre!"
      ];
      reply(`🔬 *Science Fact*\n\n${facts[Math.floor(Math.random() * facts.length)]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'horoscope': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}horoscope [signe]\nSignes: bélier, taureau, gémeaux, cancer, lion, vierge, balance, scorpion, sagittaire, capricorne, verseau, poissons`);
      const horoscopes = {
        'bélier': '♈ Aujourd\'hui est une excellente journée pour prendre des initiatives!',
        'taureau': '♉ La patience sera ta meilleure alliée aujourd\'hui.',
        'gémeaux': '♊ Tes capacités de communication seront à leur apogée!',
        'cancer': '♋ Prends soin de toi et de ceux que tu aimes.',
        'lion': '♌ Tu brilleras dans tout ce que tu entreprends!',
        'vierge': '♍ L\'organisation et la précision te mèneront au succès.',
        'balance': '♎ L\'harmonie et l\'équilibre seront au rendez-vous.',
        'scorpion': '♏ Fais confiance à ton instinct aujourd\'hui.',
        'sagittaire': '♐ L\'aventure et les nouvelles découvertes t\'attendent!',
        'capricorne': '♑ Ton travail acharné portera ses fruits très bientôt.',
        'verseau': '♒ L\'innovation sera ta force aujourd\'hui.',
        'poissons': '♓ Ta créativité sera débordante aujourd\'hui!'
      };
      const sign = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const key = Object.keys(horoscopes).find(k => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === sign);
      if (!key) return reply(`❌ Signe invalide! Essaie: bélier, taureau, gémeaux, cancer, lion, vierge, balance, scorpion, sagittaire, capricorne, verseau, poissons`);
      reply(`🔮 *Horoscope - ${key.charAt(0).toUpperCase() + key.slice(1)}*\n\n${horoscopes[key]}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'imbd':
    case 'imdb': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}imdb [film]`);
      try {
        const res = await axios.get(`https://www.omdbapi.com/?t=${encodeURIComponent(text)}&apikey=trilogy&type=movie`);
        if (res.data.Response === 'False') return reply(`❌ Film "${text}" non trouvé!`);
        const m = res.data;
        reply(`🎬 *${m.Title}* (${m.Year})\n\n⭐ Note: ${m.imdbRating}/10\n🎭 Genre: ${m.Genre}\n⏱️ Durée: ${m.Runtime}\n👥 Acteurs: ${m.Actors}\n📝 ${m.Plot?.substring(0, 300)}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Erreur IMDB: ${e.message}`);
      }
      return true;
    }

    case 'dictionary': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}dictionary [mot]`);
      try {
        const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
        const entry = res.data?.[0];
        if (!entry) return reply(`❌ Mot "${text}" non trouvé!`);
        const meaning = entry.meanings?.[0];
        const def = meaning?.definitions?.[0];
        reply(`📖 *Dictionnaire*\n\n*${entry.word}*\n📢 Phonétique: ${entry.phonetic || 'N/A'}\n🏷️ Type: ${meaning?.partOfSpeech}\n📝 Définition: ${def?.definition}\n📌 Exemple: ${def?.example || 'N/A'}\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Mot non trouvé!`);
      }
      return true;
    }

    case 'remind': {
      const minutes = parseInt(args[0]);
      const reminderText = args.slice(1).join(' ');
      if (!minutes || !reminderText) return reply(`❌ Usage: ${config.PREFIX}remind [minutes] [message]`);
      reply(`⏰ Rappel programmé dans ${minutes} minute(s): "${reminderText}"`);
      setTimeout(async () => {
        try {
          await sock.sendMessage(from, {
            text: `⏰ *RAPPEL*\n\n${reminderText}\n\n${config.BOT_FOOTER}`
          }, { quoted: msg });
        } catch(e) {}
      }, minutes * 60000);
      return true;
    }

    case 'recipe': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}recipe [plat]`);
      try {
        const res = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(text)}`);
        const meal = res.data?.meals?.[0];
        if (!meal) return reply(`❌ Aucune recette pour "${text}"!`);
        const ingredients = [];
        for (let i = 1; i <= 10; i++) {
          if (meal[`strIngredient${i}`]) {
            ingredients.push(`• ${meal[`strMeasure${i}`]} ${meal[`strIngredient${i}`]}`);
          }
        }
        reply(`🍽️ *Recette: ${meal.strMeal}*\n\n🌍 Origine: ${meal.strArea}\n📂 Catégorie: ${meal.strCategory}\n\n*Ingrédients:*\n${ingredients.join('\n')}\n\n📝 Instructions:\n${meal.strInstructions?.substring(0, 500)}...\n\n${config.BOT_FOOTER}`);
      } catch(e) {
        reply(`❌ Erreur: ${e.message}`);
      }
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
