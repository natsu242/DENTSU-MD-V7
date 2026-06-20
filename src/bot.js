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
const pendingSockets = new Map();
const msgCaches = new Map();
const watchdogs = new Map();
const presenceTimers = new Map();

const FALLBACK_VERSION = [2, 3000, 1023596128];
const WS_OPEN = 1; // WebSocket.OPEN

async function getVersion() {
  try {
    const { version } = await fetchLatestBaileysVersion();
    console.log('[BOT] WhatsApp version:', version.join('.'));
    return version;
  } catch (e) {
    console.log('[BOT] fetchLatestBaileysVersion failed → fallback version');
    return FALLBACK_VERSION;
  }
}

function getBrowserValue() {
  if (typeof Browsers?.macOS === 'function') return Browsers.macOS('Safari');
  if (Array.isArray(Browsers?.macOS)) return Browsers.macOS;
  return ['Ubuntu', 'Chrome', '22.0.0'];
}

function clearWatchdog(sanitized) {
  if (watchdogs.has(sanitized)) {
    clearInterval(watchdogs.get(sanitized));
    watchdogs.delete(sanitized);
  }
}

function clearPresenceTimer(sanitized) {
  if (presenceTimers.has(sanitized)) {
    clearInterval(presenceTimers.get(sanitized));
    presenceTimers.delete(sanitized);
  }
}

// Force-reconnect helper — ne supprime PAS les fichiers de session
function forceReconnect(sanitized, sock, reason) {
  console.log(`[${sanitized}] 🔴 ${reason} → reconnexion forcée...`);
  clearWatchdog(sanitized);
  clearPresenceTimer(sanitized);
  store.deleteSession(sanitized);
  try { sock.end(new Error(reason)); } catch (_) {}
  setTimeout(() => reconnectSession(sanitized), 4000);
}

async function startSession(number) {
  const sanitized = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(config.SESSION_BASE_PATH, sanitized);

  if (fs.existsSync(sessionPath)) {
    const files = fs.readdirSync(sessionPath);
    if (files.length > 0 && !files.includes('creds.json')) {
      console.log(`[${sanitized}] Corrupted session detected, cleaning...`);
      fs.removeSync(sessionPath);
    }
  }
  fs.ensureDirSync(sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const version = await getVersion();

  const msgRetryCounterMap = new Map();
  if (!msgCaches.has(sanitized)) msgCaches.set(sanitized, new Map());
  const msgCache = msgCaches.get(sanitized);

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
    defaultQueryTimeoutMs: 60000,
    // keepAlive au niveau protocole WebSocket (15s)
    keepAliveIntervalMs: 15000,
    retryRequestDelayMs: 250,
    generateHighQualityLinkPreview: false,
    // true = bot apparaît "en ligne" dès la connexion même si le téléphone est hors-ligne
    markOnlineOnConnect: true,
    syncFullHistory: false,
    msgRetryCounterMap,
    getMessage: async (key) => {
      const cached = msgCache.get(key.id);
      if (cached) return cached;
      return { conversation: '' };
    },
  });

  pendingSockets.set(sanitized, sock);
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    for (const m of msgs) {
      if (m.message && m.key?.id) {
        msgCache.set(m.key.id, m.message);
        if (msgCache.size > 500) {
          msgCache.delete(msgCache.keys().next().value);
        }
      }
    }
    messageHandler(sock, { messages: msgs, type }).catch(e =>
      console.error(`[${sanitized}] messageHandler error:`, e.message)
    );
  });

  setupStatusHandlers(sock);

  sock.ev.on('group-participants.update', async (update) => {
    try {
      const { id, participants, action } = update;
      const meta = await sock.groupMetadata(id);
      for (const jid of participants) {
        const num = jid.split('@')[0];
        if (action === 'add') {
          await sock.sendMessage(id, {
            image: { url: config.MENU_IMAGE },
            caption: `╔╦══════════════════╦╗\n║║   *WELCOME* 🎉   ║║\n╚╩══════════════════╩╝\n\n👋 Welcome @${num} to *${meta.subject}*!\n\nWe're glad to have you here. Please read the group rules.\n\n_Powered by DENTSU MD V7_`,
            mentions: [jid],
          });
        } else if (action === 'remove') {
          await sock.sendMessage(id, {
            image: { url: config.MENU_IMAGE },
            caption: `╔╦══════════════════╦╗\n║║   *GOODBYE* 👋   ║║\n╚╩══════════════════╩╝\n\n😢 @${num} has left *${meta.subject}*.\n\nWe'll miss you! Come back anytime.\n\n_Powered by DENTSU MD V7_`,
            mentions: [jid],
          });
        }
      }
    } catch (e) {
      console.log(`[group-participants] Error:`, e.message);
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(`[${sanitized}] ✅ Connecté!`);
      pendingSockets.delete(sanitized);
      store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });

      // Envoie immédiatement le statut "disponible"
      try { await sock.sendPresenceUpdate('available'); } catch (_) {}

      // ── WATCHDOG (toutes les 30s) ────────────────────────────
      // Vérifie d'abord l'état WebSocket BRUT (sock.ws.readyState).
      // Si le WS n'est pas OPEN → zombie détecté sans attendre d'erreur.
      // Ensuite envoie un presence update pour maintenir le compte EN LIGNE.
      clearWatchdog(sanitized);
      const wd = setInterval(async () => {
        if (!store.getSession(sanitized)) { clearWatchdog(sanitized); return; }

        // --- Vérification 1 : état WebSocket brut ---
        const wsState = sock.ws?.readyState;
        if (wsState !== WS_OPEN) {
          forceReconnect(sanitized, sock, `Watchdog: WS état=${wsState} (pas OPEN)`);
          return;
        }

        // --- Vérification 2 : ping applicatif + maintien en ligne ---
        try {
          await sock.sendPresenceUpdate('available');
        } catch (e) {
          forceReconnect(sanitized, sock, `Watchdog: presence update échoué (${e.message})`);
        }
      }, 30000); // 30 secondes
      watchdogs.set(sanitized, wd);

      // ── KEEP-ALIVE PRESENCE (toutes les 5 min) ───────────────
      // Maintient le bot "en ligne" même si le propriétaire n'a
      // plus de forfait internet. Le bot tourne sur Render = indépendant.
      clearPresenceTimer(sanitized);
      const pt = setInterval(async () => {
        if (!store.getSession(sanitized)) { clearPresenceTimer(sanitized); return; }
        try {
          await sock.sendPresenceUpdate('available');
        } catch (_) {}
      }, 5 * 60 * 1000); // 5 minutes
      presenceTimers.set(sanitized, pt);

      return;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.output?.payload?.error || statusCode;
      console.log(`[${sanitized}] Connexion fermée. Raison: ${reason} (code: ${statusCode})`);

      clearWatchdog(sanitized);
      clearPresenceTimer(sanitized);
      pendingSockets.delete(sanitized);

      if (statusCode === DisconnectReason.loggedOut) {
        // Déconnexion volontaire WhatsApp → supprimer la session
        store.deleteSession(sanitized);
        fs.removeSync(sessionPath);
        msgCaches.delete(sanitized);
        console.log(`[${sanitized}] Session supprimée (logout)`);
      } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
        console.log(`[${sanitized}] Redémarrage requis, reconnexion dans 2s...`);
        setTimeout(() => reconnectSession(sanitized), 2000);
      } else if (statusCode === 408 || statusCode === 503) {
        console.log(`[${sanitized}] Timeout/Indisponible, reconnexion dans 10s...`);
        setTimeout(() => reconnectSession(sanitized), 10000);
      } else {
        console.log(`[${sanitized}] Reconnexion dans 5s...`);
        setTimeout(() => reconnectSession(sanitized), 5000);
      }
    }
  });

  if (!sock.authState.creds.registered) {
    await delay(3000);
    try {
      console.log(`[${sanitized}] Demande de code de jumelage (version ${version.join('.')})...`);
      const code = await sock.requestPairingCode(sanitized);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`[${sanitized}] ✅ Code: ${formattedCode}`);

      setTimeout(() => {
        if (pendingSockets.has(sanitized)) {
          console.log(`[${sanitized}] Timeout jumelage (5min), nettoyage socket en attente`);
          pendingSockets.delete(sanitized);
        }
      }, 5 * 60 * 1000);

      return { sock, code: formattedCode };
    } catch (err) {
      const realError = err?.message || String(err);
      console.error(`[${sanitized}] requestPairingCode erreur:`, realError);
      pendingSockets.delete(sanitized);
      try { sock.end(); } catch (_) {}
      throw new Error(`Pairing code failed: ${realError}`);
    }
  }

  pendingSockets.delete(sanitized);
  store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });
  return { sock, code: null };
}

async function reconnectSession(sanitized) {
  const sessionPath = path.join(config.SESSION_BASE_PATH, sanitized);
  if (!fs.existsSync(sessionPath)) {
    console.log(`[${sanitized}] Pas de session sur disque, abandon reconnexion.`);
    return;
  }
  if (store.getSession(sanitized)) {
    console.log(`[${sanitized}] Session déjà active, pas de reconnexion.`);
    return;
  }
  console.log(`[${sanitized}] Reconnexion avec la session existante...`);
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
  console.log(`[BOT] ${dirs.length} session(s) à restaurer`);
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
