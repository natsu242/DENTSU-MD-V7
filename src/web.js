const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const { startSession } = require('./bot');
const store = require('./lib/store');
const config = require('./config');
const { generateOTP } = require('./lib/utils');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../website/views'));
app.use(express.static(path.join(__dirname, '../website/public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));

// ── Page principale (pairing) ──────────────────────────────────────
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
  const { number } = req.body;
  if (!number) return res.json({ success: false, error: 'Numéro requis' });

  const sanitized = number.replace(/[^0-9]/g, '');
  if (sanitized.length < 8) return res.json({ success: false, error: 'Numéro invalide' });

  if (store.sessionCount() >= config.MAX_SESSIONS) {
    return res.json({ success: false, error: `Limite de ${config.MAX_SESSIONS} sessions atteinte` });
  }

  const existing = store.getSession(sanitized);
  if (existing) return res.json({ success: false, error: 'Ce numéro est déjà connecté!' });

  try {
    const { sock, code } = await startSession(sanitized);
    if (code) {
      return res.json({ success: true, code, message: 'Entre ce code dans WhatsApp → Appareils liés → Lier un appareil → Code de jumelage' });
    }
    return res.json({ success: true, code: null, message: 'Déjà connecté!' });
  } catch (err) {
    console.error('Pair error:', err.message);
    return res.json({ success: false, error: err.message });
  }
});

// ── Status des sessions ────────────────────────────────────────────
app.get('/status', (req, res) => {
  const sessions = store.getAllSessions().map(([num]) => ({
    number: num.replace(/(\d{3})(\d+)(\d{3})/, '$1***$3'),
    connected: true,
  }));
  res.json({ sessions, count: sessions.length, max: config.MAX_SESSIONS });
});

// ── Déconnecter une session ────────────────────────────────────────
app.post('/disconnect', async (req, res) => {
  const { number, ownerKey } = req.body;
  if (ownerKey !== config.OWNER_NUMBER) return res.json({ success: false, error: 'Non autorisé' });
  const sanitized = number?.replace(/[^0-9]/g, '');
  if (!sanitized) return res.json({ success: false, error: 'Numéro requis' });
  const sess = store.getSession(sanitized);
  if (!sess) return res.json({ success: false, error: 'Session non trouvée' });
  try {
    await sess.sock.logout();
    store.deleteSession(sanitized);
    res.json({ success: true, message: `${sanitized} déconnecté` });
  } catch(e) {
    store.deleteSession(sanitized);
    res.json({ success: true, message: `${sanitized} supprimé` });
  }
});

// ── Healthcheck pour Render ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: config.BOT_NAME, sessions: store.sessionCount(), uptime: process.uptime() });
});

function startWebServer() {
  const PORT = process.env.PORT || config.PORT;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 Site de couplage: http://localhost:${PORT}`);
    console.log(`📱 Pour connecter: entre ton numéro sur le site web`);
  });
}

module.exports = { startWebServer };
