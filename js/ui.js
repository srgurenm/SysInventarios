/**
 * ui.js — Utilidades de interfaz de usuario
 * Toast notifications, modals, loading states
 */

// ─── TOAST ────────────────────────────────────────────────
const toastContainer = (() => {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
})();

const TOAST_ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

function showToast(message, type = 'success', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
    <span class="toast-message">${message}</span>
  `;
  toastContainer.appendChild(toast);

  const remove = () => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  const timer = setTimeout(remove, duration);
  toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

// ─── MODAL ────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => {
      m.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
});

// ─── LOADING ──────────────────────────────────────────────
function showLoading(message = 'Cargando...') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `<div class="spinner"></div><p style="color:var(--text-secondary);font-size:0.9rem;">${message}</p>`;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('p').textContent = message;
  }
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.remove();
}

// ─── SIDEBAR (MOBILE) ─────────────────────────────────────
function initSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.querySelector('.sidebar-overlay');
  const hamburger = document.querySelector('.hamburger');
  if (!sidebar || !overlay || !hamburger) return;

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

// ─── CONFIRM DIALOG ────────────────────────────────────────
function confirmDialog(message, title = '¿Estás seguro?') {
  return new Promise(resolve => {
    const id = 'confirm-dialog';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'modal-backdrop';
      el.innerHTML = `
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3 class="modal-title" id="confirm-title"></h3>
          </div>
          <p id="confirm-msg" style="color:var(--text-secondary);line-height:1.6;"></p>
          <div class="modal-footer">
            <button class="btn btn-ghost" id="confirm-cancel">Cancelar</button>
            <button class="btn btn-danger" id="confirm-ok">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(el);
    }
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent   = message;
    openModal(id);

    const ok     = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    const cleanup = (val) => { closeModal(id); resolve(val); };
    ok.onclick     = () => cleanup(true);
    cancel.onclick = () => cleanup(false);
    el.onclick = (e) => { if (e.target === el) cleanup(false); };
  });
}

// ─── DATE FORMAT ──────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60)   return 'hace un momento';
  if (sec < 3600) return `hace ${Math.floor(sec/60)} min`;
  if (sec < 86400)return `hace ${Math.floor(sec/3600)} h`;
  return formatDate(ts);
}

// ─── AUTH GUARD ───────────────────────────────────────────
function requireAuth(redirectTo = 'index.html') {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      if (!user) { window.location.href = redirectTo; }
      else resolve(user);
    });
  });
}

function redirectIfLoggedIn(redirectTo = 'app.html') {
  auth.onAuthStateChanged(user => {
    if (user) window.location.href = redirectTo;
  });
}
