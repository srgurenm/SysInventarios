/**
 * app.js — Lógica de la página del Dashboard (app.html)
 */

(function () {
  let currentUser = null;
  let allInventories = [];
  let pendingInventoryId = null;

  // AUTH GUARD
  requireAuth().then(user => {
    currentUser = user;
    setupUserProfile(user);
    loadInventories();
  });

  // Inicializar sidebar
  initSidebar();

  // Cargar inventarios
  function loadInventories() {
    listenInventories(currentUser.uid, inventories => {
      allInventories = inventories;
      renderInventories(inventories);
      updateStats(inventories);
    });
  }

  function updateStats(inventories) {
    document.getElementById('stat-inv').textContent = inventories.length;
    const total = inventories.reduce((s, i) => s + (i.deviceCount || 0), 0);
    document.getElementById('stat-devices').textContent = total;
  }

  const ICONS = ['📦', '🖥️', '💻', '🖨️', '📱', '⌨️', '🗄️', '📡'];
  function renderInventories(list) {
    const grid = document.getElementById('inv-grid');
    const empty = document.getElementById('empty-state');
    if (list.length === 0) {
      grid.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = list.map((inv, i) => `
      <div class="card-container fade-in" style="animation-delay:${i * 0.05}s; cursor:pointer;"
           onclick="selectInventory('${inv.id}','${escHtml(inv.name)}')">
        <div class="spin spin-blur"></div>
        <div class="backdrop"></div>
        <div class="card-border"></div>
        <div class="card">
          <div class="card-content">
            <div class="title">${escHtml(inv.name)}</div>
            <div class="subtitle" style="margin-top:10px;">
              <span>${escHtml(inv.description || 'Sin descripción')}</span><br>
              <span class="highlight">${inv.deviceCount || 0} Equipos</span>
            </div>
            <div class="subtitle" style="margin-top:10px; font-size:0.7rem;">
               Actualizado: ${timeAgo(inv.updatedAt)}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // BUSCAR
  document.getElementById('search-inv').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderInventories(allInventories.filter(i =>
      i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
    ));
  });

  // CREAR INVENTARIO
  window.handleCreateInventory = async function () {
    const name = document.getElementById('inv-name').value.trim();
    const desc = document.getElementById('inv-desc').value.trim();
    const pw = document.getElementById('inv-pw').value;
    if (!name) { showToast('El nombre es obligatorio.', 'warning'); return; }
    if (pw.length < 4) { showToast('La contraseña debe tener al menos 4 caracteres.', 'warning'); return; }

    const btn = document.getElementById('btn-create-inv');
    btn.classList.add('loading'); btn.disabled = true;
    try {
      await createInventory(name, desc, pw, currentUser.uid);
      closeModal('modal-new-inv');
      document.getElementById('inv-name').value = '';
      document.getElementById('inv-desc').value = '';
      document.getElementById('inv-pw').value = '';
      showToast(`Inventario "${name}" creado exitosamente.`, 'success');
    } catch (e) {
      showToast('Error al crear el inventario: ' + e.message, 'error');
    } finally {
      btn.classList.remove('loading'); btn.disabled = false;
    }
  };

  // SELECCIONAR INVENTARIO (revisión de contraseña)
  window.selectInventory = function (id, name) {
    pendingInventoryId = id;
    document.getElementById('pw-entry-inv-name').textContent = name;
    document.getElementById('entry-pw').value = '';
    document.getElementById('pw-entry-error').style.display = 'none';
    openModal('modal-pw-entry');
    setTimeout(() => document.getElementById('entry-pw').focus(), 300);
  };

  window.handlePasswordEntry = async function () {
    const pw = document.getElementById('entry-pw').value;
    const err = document.getElementById('pw-entry-error');
    const btn = document.getElementById('btn-entry-pw');
    if (!pw) { err.textContent = 'Ingresa la contraseña.'; err.style.display = ''; return; }

    btn.classList.add('loading'); btn.disabled = true;
    try {
      const ok = await verifyInventoryPassword(pendingInventoryId, pw);
      if (ok) {
        sessionStorage.setItem(`inv_access_${pendingInventoryId}`, '1');
        closeModal('modal-pw-entry');
        window.location.href = `inventory.html?id=${pendingInventoryId}`;
      } else {
        err.textContent = 'Contraseña incorrecta. Inténtalo de nuevo.';
        err.style.display = '';
        document.getElementById('entry-pw').value = '';
      }
    } catch (e) {
      err.textContent = 'Error al verificar: ' + e.message;
      err.style.display = '';
    } finally {
      btn.classList.remove('loading'); btn.disabled = false;
    }
  };

  // tecla intro en el modal de contraseña
  document.getElementById('entry-pw')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handlePasswordEntry();
  });
})();
