const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  delay,
  makeInMemoryStore,
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

// Per-session message cache — lets Baileys respond to WhatsApp retries
// Without this, WhatsApp repeatedly asks for message keys, Baileys can't
// answer, and messages.upsert silently stops firing after a few minutes.
const msgCaches = new Map();

const FALLBACK_VERSION = [2, 3000, 1023596128];

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

  // Per-session message retry counter + cache
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
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 500,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    // KEY FIX: without getMessage, WhatsApp retries go unanswered and
    // messages.upsert stops firing — bot stays "connected" but goes deaf.
    msgRetryCounterMap,
    getMessage: async (key) => {
      const cached = msgCache.get(key.id);
      if (cached) return cached;
      return { conversation: '' };
    },
  });

  pendingSockets.set(sanitized, sock);

  sock.ev.on('creds.update', saveCreds);

  // Cache every outgoing/incoming message so getMessage can serve retries
  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    for (const m of msgs) {
      if (m.message && m.key?.id) {
        msgCache.set(m.key.id, m.message);
        // Keep cache bounded — drop oldest entries beyond 500
        if (msgCache.size > 500) {
          const firstKey = msgCache.keys().next().value;
          msgCache.delete(firstKey);
        }
      }
    }
    try { await messageHandler(sock, { messages: msgs, type }); }
    catch (e) { console.error(`[${sanitized}] messageHandler error:`, e.message); }
  });

  setupStatusHandlers(sock);

  // ── Group events: Welcome / Goodbye ────────────────────────────
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
      console.log(`[${sanitized}] ✅ Connected!`);
      pendingSockets.delete(sanitized);
      store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });

      // Auto-follow newsletters + auto-join groupe supprimés (rate-limit → déconnexion)

      return;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason     = lastDisconnect?.error?.output?.payload?.error || statusCode;
      console.log(`[${sanitized}] Connection closed. Reason: ${reason} (code: ${statusCode})`);

      pendingSockets.delete(sanitized);

      // 401 retiré — un 401 réseau n'est pas un vrai logout
      if (statusCode === DisconnectReason.loggedOut) {
        store.deleteSession(sanitized);
        fs.removeSync(sessionPath);
        msgCaches.delete(sanitized);
        console.log(`[${sanitized}] Session deleted (logout)`);
      } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
        console.log(`[${sanitized}] Restart required, reconnecting in 2s...`);
        setTimeout(() => reconnectSession(sanitized), 2000);
      } else if (statusCode === 408 || statusCode === 503) {
        console.log(`[${sanitized}] Timeout/Service unavailable, reconnecting in 10s...`);
        setTimeout(() => reconnectSession(sanitized), 10000);
      } else {
        console.log(`[${sanitized}] Reconnecting in 5s...`);
        setTimeout(() => reconnectSession(sanitized), 5000);
      }
    }
  });

  if (!sock.authState.creds.registered) {
    await delay(3000);
    try {
      console.log(`[${sanitized}] Requesting pairing code (version ${version.join('.')})...`);
      const code          = await sock.requestPairingCode(sanitized);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`[${sanitized}] ✅ Code: ${formattedCode}`);

      setTimeout(() => {
        if (pendingSockets.has(sanitized)) {
          console.log(`[${sanitized}] Pairing timeout (5min), cleaning pending socket`);
          pendingSockets.delete(sanitized);
        }
      }, 5 * 60 * 1000);

      return { sock, code: formattedCode };
    } catch (err) {
      const realError = err?.message || String(err);
      console.error(`[${sanitized}] requestPairingCode error:`, realError);
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
  if (!fs.existsSync(sessionPath)) return;
  if (store.getSession(sanitized)) return;
  try {
    await startSession(sanitized);
  } catch (e) {
    console.error(`[${sanitized}] Reconnection error:`, e.message);
    setTimeout(() => reconnectSession(sanitized), 15000);
  }
}

async function startExistingSessions() {
  if (!fs.existsSync(config.SESSION_BASE_PATH)) return;
  const dirs = fs.readdirSync(config.SESSION_BASE_PATH).filter(d => {
    const p = path.join(config.SESSION_BASE_PATH, d);
    return fs.statSync(p).isDirectory() && fs.readdirSync(p).length > 0;
  });
  console.log(`[BOT] ${dirs.length} existing session(s) to restore`);
  for (const dir of dirs) {
    try {
      await startSession(dir);
      await delay(2000);
    } catch (e) {
      console.error(`[BOT] Session error ${dir}:`, e.message);
    }
  }
}

function startBot() {
  startExistingSessions();
}

module.exports = { startBot, startSession };
