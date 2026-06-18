const form = document.getElementById('pairForm');
const numberInput = document.getElementById('number');
const btn = document.getElementById('pairBtn');
const resultDiv = document.getElementById('result');
const codeDisplay = document.getElementById('codeDisplay');
const codeValue = document.getElementById('codeValue');
const copyBtn = document.getElementById('copyBtn');
const stepsDiv = document.getElementById('steps');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const number = numberInput.value.trim().replace(/[^0-9]/g, '');
  if (!number || number.length < 7) {
    showError('Entre un numéro valide avec le code pays. Ex: 242065121108');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Génération du code...';
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
      // Afficher le code
      codeValue.textContent = data.code;
      codeDisplay.style.display = 'block';
      stepsDiv.style.display = 'block';
      showSuccess('Code généré ! Suis les étapes ci-dessous 👇');
    } else if (data.success && !data.code) {
      showSuccess('✅ Déjà connecté !');
    } else {
      showError(data.error || 'Erreur inconnue');
    }
  } catch (err) {
    showError('Erreur réseau. Vérifie ta connexion et réessaie.');
  }

  btn.disabled = false;
  btn.innerHTML = '📲 Obtenir mon code';
});

copyBtn?.addEventListener('click', () => {
  const code = codeValue.textContent;
  navigator.clipboard.writeText(code).then(() => {
    copyBtn.textContent = '✅ Copié !';
    setTimeout(() => { copyBtn.textContent = '📋 Copier'; }, 2000);
  });
});

function showError(msg) {
  resultDiv.className = 'result error';
  resultDiv.textContent = '❌ ' + msg;
  resultDiv.style.display = 'block';
}

function showSuccess(msg) {
  resultDiv.className = 'result success';
  resultDiv.textContent = '✅ ' + msg;
  resultDiv.style.display = 'block';
}
