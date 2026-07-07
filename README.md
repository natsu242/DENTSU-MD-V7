<div align="center">

<img src="https://files.catbox.moe/uwcemj.jpg" alt="DENTSU MD V9" width="100%" style="border-radius:16px; max-width:800px"/>

# 🤖 DENTSU MD V9

**Bot WhatsApp Multi-Sessions • 200+ Commandes • by NatsuTech's**

[![WhatsApp Channel](https://img.shields.io/badge/📢_Canal_WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029VbC1s7fFnSz1YhZYc01h)
[![Telegram Channel](https://img.shields.io/badge/✈️_Canal_Telegram-0088cc?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/DPLOIEMENT_DUN_BOT2)
[![Telegram Contact](https://img.shields.io/badge/💬_Contact_Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/Natsu_or_Dentsu)
[![YouTube](https://img.shields.io/badge/▶️_YouTube_Tutos-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/@Natsu-ras)

</div>

---

## 📋 À propos

**DENTSU MD V9** est un bot WhatsApp professionnel multi-sessions développé par **NatsuTech's**. Il supporte plus de 200 commandes couvrant l'IA, le téléchargement, les jeux, la gestion de groupes et bien plus encore. Connexion sans QR code grâce au système de **Pairing Code**.

| Champ | Valeur |
|---|---|
| **Nom** | DENTSU MD V9 |
| **Développeur** | NatsuTech's |
| **Version** | V9.0 |
| **Préfixe** | `.` |
| **Mode** | Public |
| **Multi-Sessions** | 50 max |
| **Connexion** | Pairing Code (sans QR) |

---

## ⚡ Déploiement rapide

### 🚂 Option 1 — Railway (Recommandé)

**1. Fork ce repo**

Clique sur **Fork** en haut à droite pour avoir ta propre copie.

**2. Nouveau projet Railway**

1. Va sur [railway.com](https://railway.com) → **New Project → Deploy from GitHub**
2. Sélectionne ton fork `DENTSU-MD-V9`
3. Railway détecte automatiquement le `railway.json` ✅

**3. Variables d'environnement**

Dans Railway → Variables, ajoute :

```env
BOT_NAME=DENTSU MD V9
DEV_NAME=NatsuTech's
PREFIX=.
MODE=public
OWNER_NUMBER=224624977006
MAX_SESSIONS=50
MENU_IMAGE=https://files.catbox.moe/uwcemj.jpg
CHANNEL_LINK=https://whatsapp.com/channel/0029VbC1s7fFnSz1YhZYc01h
TELEGRAM=https://t.me/Natsu_or_Dentsu
NODE_ENV=production
```

**4. Déployer**

Clique **Deploy** et attends 2–3 minutes. Ton URL Railway ressemblera à :
`https://dentsu-md-v9.up.railway.app`

---

### 🌐 Option 2 — Site de Jumelage (Vercel)

Le dossier `frontend/` contient un site React moderne pour obtenir ton code de jumelage.

**1. Importe sur Vercel**
- Root Directory : `frontend`
- Framework Preset : `Vite`

**2. Variable d'environnement Vercel**
```env
VITE_API_URL=https://ton-url.up.railway.app
```

**3. Déploie** — ton site de jumelage est en ligne en 1 minute !

---

## 🔗 Connexion WhatsApp

Une fois ton bot déployé :

1. Ouvre l'URL de ton service Railway (ou le site Vercel)
2. Entre ton numéro WhatsApp **avec l'indicatif pays** (ex : `224624977006`)
3. Reçois ton **code de jumelage à 8 caractères**
4. Dans WhatsApp → **Menu → Appareils liés → Lier un appareil → Lier avec un numéro de téléphone**
5. Saisis le code — ton bot est connecté ! ✅

---

## 📱 Commandes disponibles (200+)

| Catégorie | Exemples | Menu |
|---|---|---|
| 🧠 **Intelligence Artificielle** | `.gpt`, `.gemini`, `.deepseek` | `.aimenu` |
| 👥 **Gestion de groupes** | `.tagall`, `.kick`, `.promote` | `.groupmenu` |
| 👑 **Owner / Admin** | `.broadcast`, `.mode`, `.block` | `.ownermenu` |
| 🎉 **Fun & Social** | `.truth`, `.dare`, `.ship` | `.funmenu` |
| 🎮 **Jeux** | `.rps`, `.hangman`, `.math` | `.gamemenu` |
| 🎵 **Audio & Voix** | `.tts`, `.say`, `.bass` | `.soundmenu` |
| 📥 **Téléchargement** | `.ytmp3`, `.fb`, `.insta`, `.tiktok` | `.dlmenu` |
| 📸 **Médias & Stickers** | `.sticker`, `.remini`, `.blur` | `.mediamenu` |
| 🔍 **Recherche** | `.img`, `.yts`, `.github` | `.searchmenu` |
| 🖼️ **Images aléatoires** | `.waifu`, `.neko`, `.carimage` | `.randommenu` |
| 🎌 **Anime** | `.neko`, `.manga`, `.lyrics` | `.animemenu` |
| 🔧 **Utilitaires** | `.weather`, `.wiki`, `.calc` | `.othermenu` |

---

## 📞 Contacts & Support

| Canal | Lien |
|---|---|
| 📱 **WhatsApp (principal)** | [+224 624 977 006](https://wa.me/224624977006) |
| 📱 **WhatsApp (secondaire)** | [+242 053 323 191](https://wa.me/242053323191) |
| ✈️ **Telegram (contact)** | [@Natsu_or_Dentsu](https://t.me/Natsu_or_Dentsu) |
| 📢 **Canal WhatsApp** | [Rejoindre](https://whatsapp.com/channel/0029VbC1s7fFnSz1YhZYc01h) |
| 📡 **Canal Telegram (déploiement)** | [@DPLOIEMENT_DUN_BOT2](https://t.me/DPLOIEMENT_DUN_BOT2) |
| ▶️ **YouTube (tutoriels bot)** | [@Natsu-ras](https://youtube.com/@Natsu-ras) |

---

## 🛠️ Variables d'environnement complètes

```env
# ── Bot Core ──────────────────────────
BOT_NAME=DENTSU MD V9
DEV_NAME=NatsuTech's
PREFIX=.
MODE=public              # public | self

# ── Owner ─────────────────────────────
OWNER_NUMBER=224624977006

# ── Sessions ──────────────────────────
MAX_SESSIONS=50

# ── Médias ────────────────────────────
MENU_IMAGE=https://files.catbox.moe/uwcemj.jpg

# ── Liens sociaux ─────────────────────
CHANNEL_LINK=https://whatsapp.com/channel/0029VbC1s7fFnSz1YhZYc01h
GROUP_LINK=https://chat.whatsapp.com/GtXASqDdchAFvEJ95cQQ0F
TELEGRAM=https://t.me/Natsu_or_Dentsu

# ── CORS (si frontend Vercel séparé) ──
FRONTEND_URL=https://ton-site.vercel.app
NODE_ENV=production
```

---

## 🏗️ Structure du projet

```
DENTSU-MD-V9/
├── index.js              # Point d'entrée principal
├── railway.json          # Config déploiement Railway
├── package.json
├── src/
│   ├── bot.js            # Logique de connexion Baileys
│   ├── web.js            # Serveur Express + API pairing
│   ├── config.js         # Configuration centrale
│   ├── commands.js       # 200+ commandes
│   ├── handlers/
│   │   └── message.js    # Gestionnaire de messages
│   └── plugins/
│       ├── media.js      # Stickers, images, vidéos
│       └── owner.js      # Commandes owner
└── frontend/             # Site de jumelage (Vercel)
    ├── src/
    │   ├── App.jsx       # Interface principale
    │   ├── i18n.js       # 10 langues
    │   └── index.css     # Design dark + vert WhatsApp
    └── vercel.json       # Config Vercel
```

---

<div align="center">

**Made with ❤️ by [NatsuTech's](https://t.me/Natsu_or_Dentsu)**

[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://wa.me/224624977006)
[![Telegram](https://img.shields.io/badge/Telegram-0088cc?style=flat-square&logo=telegram&logoColor=white)](https://t.me/Natsu_or_Dentsu)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=flat-square&logo=youtube&logoColor=white)](https://youtube.com/@Natsu-ras)

*DENTSU MD V9 — Le bot WhatsApp nouvelle génération 🚀*

</div>
