/**
 * ui.js — Utilidades de interfaz de usuario
 * Toast notifications, modals, loading states, shared helpers
 */

// TOAST
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

// MODAL
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

// LOADING
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

// SIDEBAR (MOBILE)
function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
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

// CONFIRM DIALOG
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
    document.getElementById('confirm-msg').textContent = message;
    openModal(id);

    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    const cleanup = (val) => { closeModal(id); resolve(val); };
    ok.onclick = () => cleanup(true);
    cancel.onclick = () => cleanup(false);
    el.onclick = (e) => { if (e.target === el) cleanup(false); };
  });
}

// DATE FORMAT
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'hace un momento';
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`;
  return formatDate(ts);
}

// AUTH GUARD
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

/**
 * Populates the sidebar user profile elements with the authenticated user's data.
 * Centralizes repeated user-profile injection logic (DRY).
 * @param {firebase.User} user - The currently authenticated Firebase user.
 */
function setupUserProfile(user) {
  const nameEl   = document.getElementById('user-name');
  const emailEl  = document.getElementById('user-email');
  const avatarEl = document.getElementById('user-avatar');
  if (nameEl)   nameEl.textContent   = user.displayName || 'Usuario';
  if (emailEl)  emailEl.textContent  = user.email;
  if (avatarEl) avatarEl.textContent = (user.displayName || user.email).charAt(0).toUpperCase();
}

// SHARED HELPERS

/**
 * Escapa caracteres HTML para evitar XSS al insertar texto en el DOM.
 * @param {string} s - Cadena a escapar.
 * @returns {string}
 */
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

/**
 * Cierra la sesión de Firebase y redirige al login.
 */
async function handleLogout() {
  await auth.signOut();
  window.location.href = 'index.html';
}

/**
 * Copia texto al portapapeles y muestra un toast de confirmación.
 * @param {string} text - Texto a copiar.
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiado al portapapeles', 'success', 2000);
  }).catch(() => {
    showToast('No se pudo copiar', 'error', 2000);
  });
}

// =========================================================================
// RENDER COMPONENTES COMUNES (DRY)
// =========================================================================

/**
 * Retorna el HTML de la barra lateral (Sidebar) para inyectarlo en el DOM.
 * @param {string} activeLink - 'app', 'inventory', o 'add-device'
 */
function renderSidebarHTML(activeLink = 'app') {
  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-icon">🖥️</div>
        <div>
          <div class="sidebar-brand-name">SysInventarios</div>
          <div class="sidebar-brand-sub">Panel de Control</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-section-title">Navegación</div>
        <a href="app.html" class="sidebar-link ${activeLink === 'app' ? 'active' : ''}">
          <span class="icon">📦</span> Mis Inventarios
        </a>
        
        ${(activeLink === 'inventory' || activeLink === 'add-device') ? `
          <a href="#" class="sidebar-link ${activeLink === 'inventory' ? 'active' : ''}" id="sidebar-inv-name">
            <span class="icon">📋</span> Inventario
          </a>
        ` : ''}

        <a href="logs.html" class="sidebar-link ${activeLink === 'logs' ? 'active' : ''}">
          <span class="icon">⚙️</span> Registro de Errores
        </a>
        
        <div class="sidebar-section-title" style="margin-top:16px">Cuenta</div>
        <button class="sidebar-link" onclick="handleLogout()"><span class="icon">🚪</span> Cerrar Sesión</button>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar" id="user-avatar">?</div>
          <div>
            <div class="user-name" id="user-name">Cargando...</div>
            <div class="user-email" id="user-email"></div>
          </div>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
  `;
}

// =========================================================================
// MANEJO DE ERRORES GLOBALES (Error Boundary)
// =========================================================================

window.addEventListener('error', (event) => {
  // Ignoramos errores de extensiones externas que puedan inyectar scripts
  if (event.filename && !event.filename.includes(window.location.hostname) && window.location.hostname !== '') {
    return;
  }
  
  const errorMessage = event.error?.message || event.message || 'Error Desconocido';
  console.error("Global JS Error Capturado:", errorMessage);
  showToast("Error inesperado en la interfaz. Recarga la página si el problema persiste.", 'error', 5000);

  // Registrar en DB (si la función existe)
  if (typeof logSystemError === 'function') {
    logSystemError({
      type: 'Client Error',
      message: errorMessage,
      filename: event.filename || 'Desconocido',
      lineno: event.lineno || null,
      colno: event.colno || null,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userEmail: (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.email : 'Anónimo'
    });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || event.reason || "Error de red o comunicación.";
  console.error("Promesa rechazada globalmente:", msg);
  showToast(`Error en la operación: ${msg}`, 'error', 5000);

  // Registrar en DB (si la función existe)
  if (typeof logSystemError === 'function') {
    logSystemError({
      type: 'Unhandled Promise Rejection',
      message: String(msg),
      stack: event.reason?.stack || null,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userEmail: (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.email : 'Anónimo'
    });
  }
});
