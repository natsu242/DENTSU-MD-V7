const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
  delay,
  getContentType,
  proto,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const store = require('./lib/store');
const { messageHandler } = require('./handlers/message');
const { setupStatusHandlers } = require('./handlers/status');

const logger = pino({ level: 'silent' });

async function startSession(number) {
  const sanitized = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(config.SESSION_BASE_PATH, sanitized);
  fs.ensureDirSync(sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.macOS('Safari'),
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 2000,
    generateHighQualityLinkPreview: true,
  });

  // Retourner un code de pairing si pas encore connecté
  if (!sock.authState.creds.registered) {
    await delay(2000);
    const code = await sock.requestPairingCode(sanitized);
    return { sock, code };
  }

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => onConnectionUpdate(update, sock, number, sanitized));
  sock.ev.on('messages.upsert', async (m) => messageHandler(sock, m));

  await setupStatusHandlers(sock);
  store.setSession(sanitized, { sock, number: sanitized });

  return { sock, code: null };
}

async function onConnectionUpdate(update, sock, number, sanitized) {
  const { connection, lastDisconnect, qr } = update;

  if (connection === 'close') {
    const reason = lastDisconnect?.error?.output?.statusCode;
    console.log(`[${sanitized}] Connexion fermée: ${reason}`);

    if (reason === DisconnectReason.loggedOut) {
      store.deleteSession(sanitized);
      const sessionPath = path.join(config.SESSION_BASE_PATH, sanitized);
      fs.removeSync(sessionPath);
      console.log(`[${sanitized}] Session supprimée (déconnecté)`);
    } else if (reason !== DisconnectReason.loggedOut) {
      console.log(`[${sanitized}] Reconnexion dans 5s...`);
      setTimeout(() => reconnectSession(number), 5000);
    }
  }

  if (connection === 'open') {
    console.log(`[${sanitized}] ✅ Connecté avec succès`);
    store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });
    // Envoyer message de bienvenue au propriétaire
    try {
      await delay(3000);
      await sock.sendMessage(sanitized + '@s.whatsapp.net', {
        image: { url: config.MENU_IMAGE },
        caption: `✅ *DENTSU MD V7* connecté avec succès!\n\n📱 Numéro: *${sanitized}*\n⏰ ${new Date().toLocaleString()}\n\n${config.BOT_FOOTER}`,
      });
    } catch(e) {}
  }
}

async function reconnectSession(number) {
  const sanitized = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(config.SESSION_BASE_PATH, sanitized);
  if (!fs.existsSync(sessionPath)) return;
  try {
    await startSession(number);
  } catch(e) {
    console.error(`Erreur reconnexion ${sanitized}:`, e.message);
  }
}

async function startExistingSessions() {
  if (!fs.existsSync(config.SESSION_BASE_PATH)) return;
  const dirs = fs.readdirSync(config.SESSION_BASE_PATH).filter(d =>
    fs.statSync(path.join(config.SESSION_BASE_PATH, d)).isDirectory()
  );
  console.log(`[BOT] ${dirs.length} session(s) existante(s) trouvée(s)`);
  for (const dir of dirs) {
    try {
      await startSession(dir);
      await delay(2000);
    } catch(e) {
      console.error(`Erreur démarrage session ${dir}:`, e.message);
    }
  }
}

function startBot() {
  startExistingSessions();
}

module.exports = { startBot, startSession };
