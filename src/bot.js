const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
} = require('baileys');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const store = require('./lib/store');
const { messageHandler, sendMainMenu } = require('./handlers/message');
const { setupStatusHandlers } = require('./handlers/status');
const { getDate, getTime, getRam, getHost, countCommands } = require('./lib/utils');

const logger = pino({ level: 'silent' });

// ── Envoie le menu de bienvenue au numéro couplé ──────────────────────────
async function sendWelcomeMenu(sock, sanitized) {
  let totalCmds = 0;
  try { totalCmds = await countCommands(); } catch (_) {}

  const prefixStr = (config.PREFIXES || ['.']).join('  ');

  const menuText =
`╔══════════════════════╗
║   🤖 *DENTSU MD V7*  ║
╚══════════════════════╝

✅ Bot connecté avec succès !

┌─────────────────────────
│ 📌 *Version* : V7
│ 👨‍💻 *Dev* : Natsu Tech
│ 📱 *Numéro* : +${sanitized}
│ 📅 *Date* : ${getDate()}
│ ⏰ *Heure* : ${getTime()}
│ 📊 *Commandes* : ${totalCmds}+
│ 🌐 *Mode* : ${config.MODE.toUpperCase()}
│ ⌨️ *Préfixes* : ${prefixStr}
│ 🖥️ *RAM* : ${getRam()}
│ 🌍 *Host* : ${getHost()}
└─────────────────────────

*📋 CATÉGORIES DE COMMANDES*

🧠 *AI MENU*      → .aimenu
👥 *GROUP MENU*   → .groupmenu
👑 *OWNER MENU*   → .ownermenu
🎉 *FUN MENU*     → .funmenu
🎮 *GAME MENU*    → .gamemenu
🎵 *SOUND MENU*   → .soundmenu
🔧 *OTHER MENU*   → .othermenu
📥 *DOWNLOADER*   → .dlmenu
📸 *MEDIA MENU*   → .mediamenu
🔍 *SEARCH MENU*  → .searchmenu
🖼️ *RANDOM IMAGE* → .randommenu
🎌 *ANIME MENU*   → .animemenu

━━━━━━━━━━━━━━━━━━━━━
💡 Tape *.menu* ou juste *menu* pour revoir ce menu
${config.BOT_FOOTER}`;

  try {
    await sock.sendMessage(sanitized + '@s.whatsapp.net', {
      image: { url: config.MENU_IMAGE },
      caption: menuText,
    });
  } catch (_) {
    try {
      await sock.sendMessage(sanitized + '@s.whatsapp.net', { text: menuText });
    } catch (e2) {
      console.log(`[${sanitized}] Impossible d'envoyer le menu de bienvenue: ${e2.message}`);
    }
  }
}

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
    browser: ['Ubuntu', 'Chrome', '22.0.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    retryRequestDelayMs: 2000,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
  });

  // ── Sauvegarder les credentials ──────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Gestionnaire de COMMANDES (messages entrants) ─────────────────────────
  // Enregistré UNE SEULE FOIS ici, avant tout le reste
  sock.ev.on('messages.upsert', async (m) => {
    try {
      await messageHandler(sock, m);
    } catch (e) {
      console.error(`[${sanitized}] Erreur messageHandler:`, e.message);
    }
  });

  // ── Gestionnaire de STATUTS (auto-view, auto-like) ────────────────────────
  // Enregistré UNE SEULE FOIS ici, avant tout le reste
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
      } else {
        console.log(`[${sanitized}] Reconnexion dans 8s...`);
        setTimeout(() => reconnectSession(sanitized), 8000);
      }
      return;
    }

    if (connection === 'open') {
      console.log(`[${sanitized}] ✅ Connecté !`);
      store.setSession(sanitized, { sock, number: sanitized, connectedAt: Date.now() });

      // Envoyer le menu (pas juste un message de bienvenue)
      try {
        await delay(2000);
        await sendWelcomeMenu(sock, sanitized);
      } catch (e) {
        console.log(`[${sanitized}] Erreur menu bienvenue: ${e.message}`);
      }
    }
  });

  // ── Demander le code de jumelage si pas encore couplé ────────────────────
  if (!sock.authState.creds.registered) {
    await delay(1500);
    try {
      const code          = await sock.requestPairingCode(sanitized);
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`[${sanitized}] Code de jumelage: ${formattedCode}`);
      return { sock, code: formattedCode };
    } catch (err) {
      console.error(`[${sanitized}] Erreur pairing code:`, err.message);
      throw new Error('Impossible de générer le code. Vérifie que le numéro est sur WhatsApp.');
    }
  }

  // Session déjà enregistrée → juste mettre à jour le store
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
