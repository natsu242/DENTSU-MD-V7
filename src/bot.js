const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  delay,
} = require('baileys');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const store = require('./lib/store');
const { messageHandler } = require('./handlers/message');
const { setupStatusHandlers } = require('./handlers/status');

const logger = pino({ level: 'silent' });

// Version de secours si fetchLatestBaileysVersion échoue
const FALLBACK_VERSION = [2, 3000, 1023596128];

async function getVersion() {
  try {
    const { version } = await fetchLatestBaileysVersion();
    return version;
  } catch (e) {
    console.log('[BOT] fetchLatestBaileysVersion a échoué, utilisation de la version de secours');
    return FALLBACK_VERSION;
  }
}

function getBrowserValue() {
  if (typeof Browsers?.macOS === 'function') return Browsers.macOS('Safari');
  if (Array.isArray(Browsers?.macOS)) return Browsers.macOS;
  return ['Ubuntu', 'Chrome', '22.0.0'];
}

async function startSession(number) {
  const sanitized = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(config.SESSION_BASE_PATH, sanitized);
  fs.ensureDirSync(sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const version = await getVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: getBrowserValue(),
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 25000,
    retryRequestDelayMs: 2000,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
    syncFullHistory: false,
  });

  // ── Sauvegarder les credentials ──────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Gestionnaire de COMMANDES (messages entrants) ─────────────────────────
  sock.ev.on('messages.upsert', async (m) => {
    try {
      await messageHandler(sock, m);
    } catch (e) {
      console.error(`[${sanitized}] Erreur messageHandler:`, e.message);
    }
  });

  // ── Gestionnaire de STATUTS (auto-view, auto-like) ────────────────────────
  setupStatusHandlers(sock);

  // ── Gestion de la connexion ───────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason     = lastDisconnect?.error?.output?.payload?.error || statusCode;
      console.log(`[${sanitized}] Connexion fermée. Raison: ${reason}`);

      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        store.deleteSession(sanitized);
        fs.removeSync(sessionPath);
        console.log(`[${sanitized}] Session supprimée (logout)`);
      } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
        console.log(`[${sanitized}] Restart requis (pairing OK), reconnexion immédiate...`);
        setTimeout(() => reconnectSession(sanitized), 1500);
      } else {
        console.log(`[${sanitized}] Reconnexion dans 5s...`);
        setTimeout(() => reconnectSession(sanitized), 5000);
      }
      return;
    }

    if (connection === 'open') {
      console.log(`[${sanitized}] ✅ Connecté ! Tape .menu pour voir les commandes.`);
      store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });
    }
  });

  // ── Demander le code de jumelage si pas encore couplé ────────────────────
  if (!sock.authState.creds.registered) {
    // Attendre que la connexion WebSocket soit prête (3s plus fiable que 1.5s)
    await delay(3000);
    try {
      console.log(`[${sanitized}] Demande du code de jumelage...`);
      const code          = await sock.requestPairingCode(sanitized);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`[${sanitized}] Code de jumelage: ${formattedCode}`);
      return { sock, code: formattedCode };
    } catch (err) {
      // Logguer l'erreur réelle pour debug
      const realError = err?.message || String(err);
      console.error(`[${sanitized}] Erreur requestPairingCode:`, realError);
      // Fermer proprement le socket avant de relancer
      try { sock.end(); } catch (_) {}
      throw new Error(`Échec du code de jumelage: ${realError}`);
    }
  }

  store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });
  return { sock, code: null };
}

async function reconnectSession(sanitized) {
  const sessionPath = path.join(config.SESSION_BASE_PATH, sanitized);
  if (!fs.existsSync(sessionPath)) return;
  try {
    await startSession(sanitized);
  } catch (e) {
    console.error(`[${sanitized}] Erreur reconnexion:`, e.message);
    setTimeout(() => reconnectSession(sanitized), 15000);
  }
}

async function startExistingSessions() {
  if (!fs.existsSync(config.SESSION_BASE_PATH)) return;
  const dirs = fs.readdirSync(config.SESSION_BASE_PATH).filter(d => {
    const p = path.join(config.SESSION_BASE_PATH, d);
    return fs.statSync(p).isDirectory() && fs.readdirSync(p).length > 0;
  });
  console.log(`[BOT] ${dirs.length} session(s) existante(s) à restaurer`);
  for (const dir of dirs) {
    try {
      await startSession(dir);
      await delay(2000);
    } catch (e) {
      console.error(`[BOT] Erreur session ${dir}:`, e.message);
    }
  }
}

function startBot() {
  startExistingSessions();
}

module.exports = { startBot, startSession };
