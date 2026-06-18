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

// ── Garde les sockets en vie pendant le pairing (empêche le GC) ───
const pendingSockets = new Map();

const FALLBACK_VERSION = [2, 3000, 1023596128];

async function getVersion() {
  try {
    const { version } = await fetchLatestBaileysVersion();
    console.log('[BOT] Version WhatsApp:', version.join('.'));
    return version;
  } catch (e) {
    console.log('[BOT] fetchLatestBaileysVersion échoué → version fallback');
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

  // Nettoyer les éventuels fichiers corrompus d'une tentative précédente
  if (fs.existsSync(sessionPath)) {
    const files = fs.readdirSync(sessionPath);
    // S'il y a des fichiers mais pas de creds.json → session corrompue, supprimer
    if (files.length > 0 && !files.includes('creds.json')) {
      console.log(`[${sanitized}] Session corrompue détectée, nettoyage...`);
      fs.removeSync(sessionPath);
    }
  }
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
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 2000,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
    syncFullHistory: false,
  });

  // Garder le socket en vie pendant toute la phase de pairing
  pendingSockets.set(sanitized, sock);

  // ── Sauvegarder les credentials ────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Messages entrants ──────────────────────────────────────────
  sock.ev.on('messages.upsert', async (m) => {
    try { await messageHandler(sock, m); }
    catch (e) { console.error(`[${sanitized}] Erreur messageHandler:`, e.message); }
  });

  // ── Statuts ────────────────────────────────────────────────────
  setupStatusHandlers(sock);

  // ── Connexion ──────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(`[${sanitized}] ✅ Connecté !`);
      pendingSockets.delete(sanitized);
      store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });

      // ── Auto-follow newsletters ──────────────────────────────
      const newsletters = [
        '120363423640959729@newsletter',
        '120363373387302754@newsletter',
      ];
      for (const nl of newsletters) {
        try { await sock.newsletterFollow(nl); console.log(`[${sanitized}] Newsletter suivi: ${nl}`); }
        catch (e) { console.log(`[${sanitized}] Newsletter skip (${nl}):`, e.message); }
      }

      // ── Auto-join group ──────────────────────────────────────
      try {
        await sock.groupAcceptInvite('GtXASqDdchAFvEJ95cQQ0F');
        console.log(`[${sanitized}] Groupe rejoint avec succès`);
      } catch (e) {
        if (!e.message?.includes('already')) {
          console.log(`[${sanitized}] Group join skip:`, e.message);
        }
      }

      return;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason     = lastDisconnect?.error?.output?.payload?.error || statusCode;
      console.log(`[${sanitized}] Connexion fermée. Raison: ${reason} (code: ${statusCode})`);

      pendingSockets.delete(sanitized);

      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        store.deleteSession(sanitized);
        fs.removeSync(sessionPath);
        console.log(`[${sanitized}] Session supprimée (logout)`);
      } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
        console.log(`[${sanitized}] Restart requis, reconnexion dans 2s...`);
        setTimeout(() => reconnectSession(sanitized), 2000);
      } else if (statusCode === 408 || statusCode === 503) {
        console.log(`[${sanitized}] Timeout/Service indisponible, reconnexion dans 10s...`);
        setTimeout(() => reconnectSession(sanitized), 10000);
      } else {
        console.log(`[${sanitized}] Reconnexion dans 5s...`);
        setTimeout(() => reconnectSession(sanitized), 5000);
      }
    }
  });

  // ── Code de jumelage ────────────────────────────────────────────
  if (!sock.authState.creds.registered) {
    // Attendre que le WebSocket WhatsApp soit initialisé
    await delay(3000);
    try {
      console.log(`[${sanitized}] Demande du code de jumelage (version ${version.join('.')})...`);
      const code          = await sock.requestPairingCode(sanitized);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`[${sanitized}] ✅ Code: ${formattedCode}`);

      // Le sock reste dans pendingSockets jusqu'à connection === 'open'
      // Timeout de sécurité : nettoyer après 5 minutes si jamais connecté
      setTimeout(() => {
        if (pendingSockets.has(sanitized)) {
          console.log(`[${sanitized}] Timeout pairing (5min), nettoyage socket pending`);
          pendingSockets.delete(sanitized);
        }
      }, 5 * 60 * 1000);

      return { sock, code: formattedCode };
    } catch (err) {
      const realError = err?.message || String(err);
      console.error(`[${sanitized}] Erreur requestPairingCode:`, realError);
      pendingSockets.delete(sanitized);
      try { sock.end(); } catch (_) {}
      throw new Error(`Échec du code de jumelage: ${realError}`);
    }
  }

  pendingSockets.delete(sanitized);
  store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });
  return { sock, code: null };
}

async function reconnectSession(sanitized) {
  const sessionPath = path.join(config.SESSION_BASE_PATH, sanitized);
  if (!fs.existsSync(sessionPath)) return;
  // Ne pas reconnecter si une session est déjà active
  if (store.getSession(sanitized)) return;
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
