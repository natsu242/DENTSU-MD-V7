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
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    retryRequestDelayMs: 2000,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
  });

  // ── TOUJOURS configurer les listeners EN PREMIER ──────────────────
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.output?.payload?.error || statusCode;
      console.log(`[${sanitized}] Connexion fermée. Raison: ${reason}`);

      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        // Supprimer la session corrompue
        store.deleteSession(sanitized);
        fs.removeSync(sessionPath);
        console.log(`[${sanitized}] Session supprimée (logout)`);
      } else {
        // Toute autre erreur → reconnexion
        console.log(`[${sanitized}] Reconnexion dans 8s...`);
        setTimeout(() => reconnectSession(sanitized), 8000);
      }
    }

    if (connection === 'open') {
      console.log(`[${sanitized}] ✅ Session connectée avec succès!`);
      store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });

      // Setup des handlers une fois connecté
      sock.ev.on('messages.upsert', async (m) => {
        try { await messageHandler(sock, m); } catch(e) {}
      });
      await setupStatusHandlers(sock).catch(() => {});

      // Message de bienvenue
      try {
        await delay(3000);
        await sock.sendMessage(sanitized + '@s.whatsapp.net', {
          image: { url: config.MENU_IMAGE },
          caption: `✅ *DENTSU MD V7* connecté avec succès!\n\n📱 Numéro: *+${sanitized}*\n⏰ ${new Date().toLocaleString()}\n\nTape *.menu* pour voir toutes les commandes\n\n${config.BOT_FOOTER}`,
        });
      } catch(e) {
        console.log(`[${sanitized}] Impossible d'envoyer le message de bienvenue`);
      }
    }
  });

  // ── Demander le code de jumelage si pas encore inscrit ───────────
  if (!sock.authState.creds.registered) {
    await delay(1500);
    try {
      const code = await sock.requestPairingCode(sanitized);
      // Formater le code en XXXX-XXXX pour l'affichage
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`[${sanitized}] Code de jumelage: ${formattedCode}`);
      return { sock, code: formattedCode };
    } catch (err) {
      console.error(`[${sanitized}] Erreur pairing code:`, err.message);
      throw new Error('Impossible de générer le code. Vérifie que le numéro est sur WhatsApp.');
    }
  }

  // Déjà connecté – remettre les handlers
  sock.ev.on('messages.upsert', async (m) => {
    try { await messageHandler(sock, m); } catch(e) {}
  });
  await setupStatusHandlers(sock).catch(() => {});
  store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });

  return { sock, code: null };
}

async function reconnectSession(sanitized) {
  const sessionPath = path.join(config.SESSION_BASE_PATH, sanitized);
  if (!fs.existsSync(sessionPath)) return;
  try {
    await startSession(sanitized);
  } catch(e) {
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
    } catch(e) {
      console.error(`[BOT] Erreur démarrage session ${dir}:`, e.message);
    }
  }
}

function startBot() {
  startExistingSessions();
}

module.exports = { startBot, startSession };
