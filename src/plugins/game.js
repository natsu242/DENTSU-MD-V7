const config = require('../config');

const GAME_MENU = `
╔══════════════════════╗
║   🎮 *GAME MENU*    ║
╚══════════════════════╝

│ ${config.PREFIX}rps [pierre/feuille/ciseaux]
│ ${config.PREFIX}dice
│ ${config.PREFIX}coin
│ ${config.PREFIX}coinbattle @user
│ ${config.PREFIX}numberbattle @user
│ ${config.PREFIX}hangman
│ ${config.PREFIX}tictactoe @user
│ ${config.PREFIX}guess
│ ${config.PREFIX}math
│ ${config.PREFIX}emojiquiz

${config.BOT_FOOTER}`;

const hangmanWords = ['javascript','python','elephant','ordinateur','programmation','whatsapp','internet','telephone','developpeur','application'];
const activeGames = new Map();
const mathGames = new Map();
const guessGames = new Map();

async function handle(ctx) {
  const { command, text, reply, sock, from, msg, sender, args } = ctx;

  if (command === 'gamemenu') {
    await sock.sendMessage(from, {
      image: { url: config.MENU_IMAGE },
      caption: GAME_MENU
    }, { quoted: msg });
    return true;
  }

  switch(command) {
    case 'rps': {
      if (!text) return reply(`❌ Usage: ${config.PREFIX}rps [pierre/feuille/ciseaux]`);
      const choices = ['pierre', 'feuille', 'ciseaux'];
      const emojis = { pierre: '🪨', feuille: '📄', ciseaux: '✂️' };
      const player = text.toLowerCase();
      if (!choices.includes(player)) return reply(`❌ Choisis: pierre, feuille ou ciseaux`);
      const bot = choices[Math.floor(Math.random() * 3)];
      let result;
      if (player === bot) result = "🤝 Égalité!";
      else if ((player === 'pierre' && bot === 'ciseaux') || (player === 'feuille' && bot === 'pierre') || (player === 'ciseaux' && bot === 'feuille')) result = "🎉 Tu gagnes!";
      else result = "💀 Tu perds!";
      reply(`🎮 *Pierre/Feuille/Ciseaux*\n\n👤 Toi: ${emojis[player]} ${player}\n🤖 Bot: ${emojis[bot]} ${bot}\n\n${result}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'dice': {
      const result = Math.floor(Math.random() * 6) + 1;
      const emojis = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
      reply(`🎲 *Lancer de dé*\n\n${emojis[result]}\nRésultat: *${result}*\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'coin': {
      const result = Math.random() > 0.5 ? 'FACE 👑' : 'PILE 🔵';
      reply(`🪙 *Pile ou Face*\n\n${result}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'coinbattle': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned.length) return reply(`❌ Mentionne un adversaire! Ex: ${config.PREFIX}coinbattle @user`);
      const p1 = Math.random() > 0.5;
      const p2 = Math.random() > 0.5;
      const winner = p1 !== p2 ? (p1 ? `@${ctx.senderNumber}` : `@${mentioned[0].split('@')[0]}`) : null;
      reply(`🪙 *Coin Battle*\n\n@${ctx.senderNumber}: ${p1 ? '👑 FACE' : '🔵 PILE'}\n@${mentioned[0].split('@')[0]}: ${p2 ? '👑 FACE' : '🔵 PILE'}\n\n${winner ? `🏆 Gagnant: ${winner}!` : '🤝 Égalité!'}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'numberbattle':
    case 'numbattle': {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned.length) return reply(`❌ Mentionne un adversaire!`);
      const n1 = Math.floor(Math.random() * 100) + 1;
      const n2 = Math.floor(Math.random() * 100) + 1;
      const winner = n1 > n2 ? `@${ctx.senderNumber}` : n2 > n1 ? `@${mentioned[0].split('@')[0]}` : null;
      reply(`🔢 *Number Battle*\n\n@${ctx.senderNumber}: *${n1}*\n@${mentioned[0].split('@')[0]}: *${n2}*\n\n${winner ? `🏆 Gagnant: ${winner}!` : '🤝 Égalité!'}\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'hangman': {
      const word = hangmanWords[Math.floor(Math.random() * hangmanWords.length)];
      const display = '_ '.repeat(word.length).trim();
      activeGames.set(from + '_hangman', { word, guessed: [], tries: 6 });
      reply(`🎯 *Pendu*\n\n${display}\n\nMot de ${word.length} lettres\n❤️ Essais: 6\n\nTape une lettre pour jouer! Ex: .lettre a\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'lettre': {
      const game = activeGames.get(from + '_hangman');
      if (!game) return reply(`❌ Pas de partie en cours! Tape ${config.PREFIX}hangman`);
      const letter = text?.toLowerCase()?.[0];
      if (!letter || !/[a-z]/.test(letter)) return reply('❌ Tape une lettre valide!');
      if (game.guessed.includes(letter)) return reply(`❌ Tu as déjà essayé '${letter}'!`);
      game.guessed.push(letter);
      const correct = game.word.includes(letter);
      if (!correct) game.tries--;
      const display = game.word.split('').map(c => game.guessed.includes(c) ? c : '_').join(' ');
      const won = !display.includes('_');
      const lost = game.tries <= 0;
      if (won) { activeGames.delete(from + '_hangman'); return reply(`🎉 BRAVO! Le mot était: *${game.word}*\n\n${config.BOT_FOOTER}`); }
      if (lost) { activeGames.delete(from + '_hangman'); return reply(`💀 PERDU! Le mot était: *${game.word}*\n\n${config.BOT_FOOTER}`); }
      reply(`🎯 *Pendu*\n\n${display}\n\n❤️ Essais restants: ${game.tries}\n🔤 Lettres essayées: ${game.guessed.join(', ')}\n${correct ? '✅ Bonne lettre!' : '❌ Mauvaise lettre!'}`);
      return true;
    }

    case 'guess': {
      const number = Math.floor(Math.random() * 100) + 1;
      guessGames.set(from + '_' + sender, { number, tries: 0 });
      reply(`🔢 *Devine le nombre!*\n\nJ'ai pensé à un nombre entre 1 et 100.\nTape ${config.PREFIX}g [nombre] pour deviner!\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'g': {
      const game = guessGames.get(from + '_' + sender);
      if (!game) return reply(`❌ Pas de partie! Tape ${config.PREFIX}guess pour commencer`);
      const n = parseInt(text);
      if (isNaN(n)) return reply('❌ Donne un nombre!');
      game.tries++;
      if (n === game.number) {
        guessGames.delete(from + '_' + sender);
        return reply(`🎉 BRAVO! C'était *${game.number}*! Trouvé en ${game.tries} essai(s)!\n\n${config.BOT_FOOTER}`);
      }
      reply(`${n < game.number ? '📈 Plus grand!' : '📉 Plus petit!'} (essai ${game.tries})`);
      return true;
    }

    case 'math': {
      const ops = ['+', '-', '*'];
      const op = ops[Math.floor(Math.random() * 3)];
      const a = Math.floor(Math.random() * 50) + 1;
      const b = Math.floor(Math.random() * 20) + 1;
      let answer;
      if (op === '+') answer = a + b;
      else if (op === '-') answer = a - b;
      else answer = a * b;
      mathGames.set(from + '_math', { answer, question: `${a} ${op} ${b}` });
      reply(`🧮 *Math Challenge*\n\n${a} ${op} ${b} = ?\n\nTape ${config.PREFIX}rep [réponse]\n⏰ 30 secondes!\n\n${config.BOT_FOOTER}`);
      setTimeout(() => mathGames.delete(from + '_math'), 30000);
      return true;
    }

    case 'rep': {
      const game = mathGames.get(from + '_math');
      if (!game) return reply(`❌ Pas de question en cours! Tape ${config.PREFIX}math`);
      const ans = parseInt(text);
      if (isNaN(ans)) return reply('❌ Donne un nombre!');
      mathGames.delete(from + '_math');
      if (ans === game.answer) reply(`🎉 CORRECT! ${game.question} = ${game.answer}\n\n${config.BOT_FOOTER}`);
      else reply(`❌ FAUX! ${game.question} = ${game.answer} (tu avais dit ${ans})\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'emojiquiz': {
      const quizzes = [
        { q: '🦁 + 👑 = ?', a: 'roi lion', hint: 'Film Disney' },
        { q: '🧊 + ❄️ + 👸 = ?', a: 'frozen', hint: 'Film d\'animation' },
        { q: '🕷️ + 👦 = ?', a: 'spider-man', hint: 'Super-héros' },
        { q: '🦇 + 🦸 = ?', a: 'batman', hint: 'Super-héros' },
        { q: '🌊 + 🏠 = ?', a: 'moana', hint: 'Film Disney' }
      ];
      const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
      activeGames.set(from + '_emoji_' + sender, quiz.a);
      reply(`🎯 *Emoji Quiz*\n\n${quiz.q}\n\nIndice: ${quiz.hint}\nTape ${config.PREFIX}ans [réponse]\n\n${config.BOT_FOOTER}`);
      return true;
    }

    case 'ans': {
      const answer = activeGames.get(from + '_emoji_' + sender);
      if (!answer) return reply(`❌ Pas de quiz! Tape ${config.PREFIX}emojiquiz`);
      if (text?.toLowerCase().includes(answer)) {
        activeGames.delete(from + '_emoji_' + sender);
        reply(`🎉 CORRECT! La réponse était: *${answer}*\n\n${config.BOT_FOOTER}`);
      } else {
        reply(`❌ FAUX! Essaie encore! (Tape ${config.PREFIX}ans [réponse])`);
      }
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
