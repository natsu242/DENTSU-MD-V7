require('dotenv').config();
const { startBot } = require('./src/bot');
const { startWebServer } = require('./src/web');

console.log(`
╔═══════════════════════════════════════╗
║       DENTSU MD V7 - Natsu Tech       ║
║    Multi-Session WhatsApp Bot v7.0    ║
╚═══════════════════════════════════════╝
`);

// Démarrer le serveur web (site de couplage)
startWebServer();

// Les sessions bot sont gérées via le site web
