const express = require('express');
const path = require('path');
const { startSession } = require('./bot');
const store = require('./lib/store');
const config = require('./config');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../website/views'));
app.use(express.static(path.join(__dirname, '../website/public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Garder les requêtes de pairing en cours (éviter les doublons)
const pendingPairs = new Set();

// ── Page principale ────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.render('index', {
    botName: config.BOT_NAME,
    devName: config.DEV_NAME,
    menuImage: config.MENU_IMAGE,
    channelLink: config.CHANNEL_LINK,
    groupLink: config.GROUP_LINK,
    telegram: config.TELEGRAM,
    website: config.WEBSITE,
    sessions: store.sessionCount(),
    maxSessions: config.MAX_SESSIONS,
  });
});

// ── Demander un code de jumelage ───────────────────────────────────
app.post('/pair', async (req, res) => {
  let { number } = req.body;
  if (!number) return res.json({ success: false, error: 'Numéro requis' });

  // Nettoyer le numéro (garder que les chiffres)
  const sanitized = number.replace(/[^0-9]/g, '');

  if (sanitized.length < 7 || sanitized.length > 15) {
    return res.json({ success: false, error: 'Numéro invalide. Exemple: 242065121108' });
  }

  if (store.sessionCount() >= config.MAX_SESSIONS) {
    return res.json({ success: false, error: `Limite de ${config.MAX_SESSIONS} sessions atteinte` });
  }

  const existing = store.getSession(sanitized);
  if (existing) {
    return res.json({ success: false, error: 'Ce numéro est déjà connecté au bot!' });
  }

  if (pendingPairs.has(sanitized)) {
    return res.json({ success: false, error: 'Une demande est déjà en cours pour ce numéro. Attends 30 secondes.' });
  }

  pendingPairs.add(sanitized);

  try {
    const { code } = await startSession(sanitized);

    if (code) {
      // Retirer de la liste pending après 60s (timeout)
      setTimeout(() => pendingPairs.delete(sanitized), 60000);
      return res.json({
        success: true,
        code,
        message: `Entre ce code dans WhatsApp :\nParamètres → Appareils liés → Lier un appareil → Code de jumelage`,
      });
    }

    pendingPairs.delete(sanitized);
    return res.json({ success: true, code: null, message: 'Numéro déjà connecté!' });

  } catch (err) {
    pendingPairs.delete(sanitized);
    console.error(`[WEB] Pair error ${sanitized}:`, err.message);

    let errorMsg = err.message;
    if (err.message.includes('timed out') || err.message.includes('timeout')) {
      errorMsg = 'Timeout: Le numéro ne répond pas. Vérifie que WhatsApp est installé et actif sur ce numéro.';
    } else if (err.message.includes('rate-limit') || err.message.includes('429')) {
      errorMsg = 'Trop de demandes. Attends quelques minutes et réessaie.';
    } else if (err.message.includes('not registered') || err.message.includes('404')) {
      errorMsg = 'Ce numéro n\'est pas enregistré sur WhatsApp.';
    }

    return res.json({ success: false, error: errorMsg });
  }
});

// ── Status ─────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  const sessions = store.getAllSessions().map(([num]) => ({
    number: num.slice(0, 3) + '***' + num.slice(-3),
    connected: true,
  }));
  res.json({ sessions, count: sessions.length, max: config.MAX_SESSIONS });
});

// ── Healthcheck Render ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: config.BOT_NAME, sessions: store.sessionCount(), uptime: Math.floor(process.uptime()) });
});

function startWebServer() {
  const PORT = process.env.PORT || config.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 Site de couplage démarré sur le port ${PORT}`);
    console.log(`📱 Ouvre le site et entre ton numéro WhatsApp pour obtenir le code\n`);
  });
}

module.exports = { startWebServer };
