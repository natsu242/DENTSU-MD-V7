// ═══════════════════════════════════════════════════════
//  TRADUCTIONS / TRANSLATIONS
// ═══════════════════════════════════════════════════════
const TRANSLATIONS = {
  fr: {
    pairBtn: '📲 Obtenir mon code',
    pairBtnLoading: '⏳ Génération du code...',
    copyBtn: '📋 Copier le code',
    copiedBtn: '✅ Copié !',
    errorInvalidNumber: 'Entre un numéro valide avec le code pays. Ex: 242065121108',
    errorNetwork: 'Erreur réseau. Vérifie ta connexion et réessaie.',
    successCode: 'Code généré ! Suis les étapes ci-dessous 👇',
    successAlready: '✅ Déjà connecté !',
    errorUnknown: 'Erreur inconnue',
    steps: [
      'Ouvre <strong>WhatsApp</strong> sur ton téléphone',
      'Appuie sur les <strong>3 points</strong> (menu) en haut à droite',
      'Va dans <strong>Appareils liés</strong>',
      'Appuie sur <strong>Lier un appareil</strong>',
      'Choisis <strong>"Lier avec un numéro de téléphone"</strong> (pas le QR)',
      'Entre le code <strong><span id="codeInSteps"></span></strong> affiché ci-dessus',
      '✅ Le bot se connecte automatiquement !'
    ]
  },
  en: {
    pairBtn: '📲 Get my code',
    pairBtnLoading: '⏳ Generating code...',
    copyBtn: '📋 Copy code',
    copiedBtn: '✅ Copied!',
    errorInvalidNumber: 'Enter a valid number with country code. Ex: 242065121108',
    errorNetwork: 'Network error. Check your connection and try again.',
    successCode: 'Code generated! Follow the steps below 👇',
    successAlready: '✅ Already connected!',
    errorUnknown: 'Unknown error',
    steps: [
      'Open <strong>WhatsApp</strong> on your phone',
      'Tap the <strong>3 dots</strong> (menu) at the top right',
      'Go to <strong>Linked Devices</strong>',
      'Tap <strong>Link a Device</strong>',
      'Choose <strong>"Link with phone number"</strong> (not QR)',
      'Enter the code <strong><span id="codeInSteps"></span></strong> shown above',
      '✅ The bot connects automatically!'
    ]
  }
};

// ═══════════════════════════════════════════════════════
//  GESTION DE LA LANGUE / LANGUAGE MANAGEMENT
// ═══════════════════════════════════════════════════════
let currentLang = localStorage.getItem('dentsu_lang') || null;

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('dentsu_lang', lang);

  // Masquer l'overlay de langue
  const overlay = document.getElementById('langOverlay');
  const main = document.getElementById('mainContent');
  if (overlay) overlay.style.display = 'none';
  if (main) main.style.display = 'block';

  // Mettre à jour html lang
  document.getElementById('htmlRoot').lang = lang;

  // Mettre à jour les boutons actifs
  document.getElementById('btnFr')?.classList.toggle('active-lang', lang === 'fr');
  document.getElementById('btnEn')?.classList.toggle('active-lang', lang === 'en');

  // Mettre à jour tous les éléments avec data-fr / data-en
  document.querySelectorAll('[data-fr],[data-en]').forEach(el => {
    const text = el.dataset[lang];
    if (text !== undefined) el.innerHTML = text;
  });

  // Mettre à jour les placeholders des inputs
  document.querySelectorAll('[data-placeholder-fr],[data-placeholder-en]').forEach(el => {
    const ph = el.dataset[`placeholder${lang.charAt(0).toUpperCase() + lang.slice(1)}`];
    if (ph !== undefined) el.placeholder = ph;
  });

  // Mettre à jour les étapes
  renderSteps();

  // Mettre à jour le bouton de couplage
  const btn = document.getElementById('pairBtn');
  if (btn && !btn.disabled) btn.textContent = t('pairBtn');

  // Mettre à jour le bouton copier
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) copyBtn.textContent = t('copyBtn');
}

function t(key) {
  return (TRANSLATIONS[currentLang] || TRANSLATIONS['fr'])[key] || key;
}

function renderSteps() {
  const list = document.getElementById('stepsList');
  if (!list) return;
  const steps = t('steps');
  list.innerHTML = steps.map(s => `<li>${s}</li>`).join('');

  // Re-synchroniser codeInSteps avec codeValue
  const codeInSteps = document.getElementById('codeInSteps');
  const codeValue = document.getElementById('codeValue');
  if (codeInSteps && codeValue) {
    codeInSteps.textContent = codeValue.textContent;
  }
}

// ═══════════════════════════════════════════════════════
//  INITIALISATION
// ═══════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  if (currentLang) {
    setLang(currentLang);
  } else {
    // Afficher l'overlay de sélection de langue
    document.getElementById('langOverlay').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  }

  // ── Formulaire de couplage ──────────────────────────────────────
  const form = document.getElementById('pairForm');
  const numberInput = document.getElementById('number');
  const btn = document.getElementById('pairBtn');
  const resultDiv = document.getElementById('result');
  const codeDisplay = document.getElementById('codeDisplay');
  const codeValue = document.getElementById('codeValue');
  const copyBtn = document.getElementById('copyBtn');
  const stepsDiv = document.getElementById('steps');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const number = numberInput.value.trim().replace(/[^0-9]/g, '');
    if (!number || number.length < 7) {
      showError(t('errorInvalidNumber'));
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${t('pairBtnLoading')}`;
    resultDiv.style.display = 'none';
    codeDisplay.style.display = 'none';
    stepsDiv.style.display = 'none';

    try {
      const res = await fetch('/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number }),
      });
      const data = await res.json();

      if (data.success && data.code) {
        codeValue.textContent = data.code;
        codeDisplay.style.display = 'block';
        stepsDiv.style.display = 'block';
        renderSteps();
        showSuccess(t('successCode'));
      } else if (data.success && !data.code) {
        showSuccess(t('successAlready'));
      } else {
        showError(data.error || t('errorUnknown'));
      }
    } catch (err) {
      showError(t('errorNetwork'));
    }

    btn.disabled = false;
    btn.textContent = t('pairBtn');
  });

  copyBtn?.addEventListener('click', () => {
    const code = codeValue.textContent;
    navigator.clipboard.writeText(code).then(() => {
      copyBtn.textContent = t('copiedBtn');
      setTimeout(() => { copyBtn.textContent = t('copyBtn'); }, 2000);
    });
  });

  // Synchroniser le code dans les étapes
  if (codeValue) {
    const observer = new MutationObserver(() => {
      const codeInSteps = document.getElementById('codeInSteps');
      if (codeInSteps) codeInSteps.textContent = codeValue.textContent;
    });
    observer.observe(codeValue, { childList: true, characterData: true, subtree: true });
  }
});

function showError(msg) {
  const resultDiv = document.getElementById('result');
  resultDiv.className = 'result error';
  resultDiv.textContent = '❌ ' + msg;
  resultDiv.style.display = 'block';
}

function showSuccess(msg) {
  const resultDiv = document.getElementById('result');
  resultDiv.className = 'result success';
  resultDiv.textContent = '✅ ' + msg;
  resultDiv.style.display = 'block';
}
