// ═══════════════════════════════════════
//  DENTSU MD V7 - Frontend JS
//  by Natsu Tech
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  animateStats();
  setupPairForm();
  updateSessionCount();
  setInterval(updateSessionCount, 30000);
});

// ── Particles ──────────────────────────
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (8 + Math.random() * 12) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    p.style.width = (2 + Math.random() * 4) + 'px';
    p.style.height = p.style.width;
    container.appendChild(p);
  }
}

// ── Stats counter animation ────────────
function animateStats() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target);
      let current = 0;
      const step = target / 50;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = Math.floor(current) + (el.dataset.target === '200' ? '+' : '');
        if (current >= target) clearInterval(timer);
      }, 30);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-num').forEach(el => observer.observe(el));
}

// ── Pair Form ──────────────────────────
function setupPairForm() {
  const form = document.getElementById('pairForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = document.getElementById('phoneNumber').value.trim();
    const btn = document.getElementById('pairBtn');
    const resultBox = document.getElementById('resultBox');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    if (!number || number.replace(/[^0-9]/g, '').length < 8) {
      showResult(resultBox, false, null, '❌ Entre un numéro valide avec indicatif pays (ex: 242065121108)');
      return;
    }

    // Loading state
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    resultBox.style.display = 'none';

    try {
      const res = await fetch('/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: number.replace(/[^0-9]/g, '') })
      });
      const data = await res.json();

      if (data.success && data.code) {
        showResult(resultBox, true, data.code, data.message);
      } else if (data.success && !data.code) {
        showResult(resultBox, true, null, '✅ ' + data.message);
      } else {
        showResult(resultBox, false, null, '❌ ' + (data.error || 'Erreur inconnue'));
      }
    } catch (err) {
      showResult(resultBox, false, null, '❌ Erreur de connexion. Réessaie!');
    } finally {
      btn.disabled = false;
      btnText.style.display = 'flex';
      btnLoader.style.display = 'none';
    }
  });
}

function showResult(box, success, code, message) {
  box.style.display = 'block';
  box.className = success ? 'result-success' : 'result-error';

  if (success && code) {
    box.innerHTML = `
      <div style="margin-bottom:8px;font-weight:700;font-size:15px;">
        ✅ Ton code de jumelage
      </div>
      <div class="pair-code">${code}</div>
      <div class="result-msg">
        📱 <strong>Comment utiliser ce code:</strong><br>
        1. Ouvre WhatsApp sur ton téléphone<br>
        2. Menu → Appareils liés → Lier un appareil<br>
        3. Choisis "Lier avec un numéro de téléphone"<br>
        4. Entre le code ci-dessus<br><br>
        ⏰ Le code expire dans <strong id="countdown">300</strong> secondes
      </div>
      <button onclick="copyCode('${code}')" style="margin-top:14px;background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.4);color:#25D366;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;font-family:inherit;font-size:13px;">
        📋 Copier le code
      </button>
    `;
    startCountdown();
  } else {
    box.innerHTML = `<div class="result-msg">${message}</div>`;
  }

  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copyCode(code) {
  navigator.clipboard?.writeText(code).then(() => {
    const btn = event.target;
    btn.textContent = '✅ Copié!';
    setTimeout(() => btn.textContent = '📋 Copier le code', 2000);
  });
}

let countdownTimer;
function startCountdown() {
  clearInterval(countdownTimer);
  let secs = 300;
  countdownTimer = setInterval(() => {
    secs--;
    const el = document.getElementById('countdown');
    if (el) el.textContent = secs;
    if (secs <= 0) {
      clearInterval(countdownTimer);
      const box = document.getElementById('resultBox');
      if (box) showResult(box, false, null, '⏰ Le code a expiré. Soumets à nouveau ton numéro.');
    }
  }, 1000);
}

// ── Session count ──────────────────────
async function updateSessionCount() {
  try {
    const res = await fetch('/status');
    const data = await res.json();
    const el = document.getElementById('sessionCount');
    if (el) el.textContent = data.count;
  } catch(e) {}
}
