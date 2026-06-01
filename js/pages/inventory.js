/**
 * inventory.js — Lógica de la página de detalles de Inventario (inventory.html)
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const INV_ID = urlParams.get('id');

  if (!INV_ID) {
    location.href = 'app.html';
    return;
  }

  let currentUser = null;
  let currentInv = null;
  let allDevices = [];

  // AUTH + ACCESS GUARD
  requireAuth().then(user => {
    currentUser = user;
    setupUserProfile(user);

    // comprobar acceso inventario
    const hasAccess = sessionStorage.getItem(`inv_access_${INV_ID}`);
    if (!hasAccess) {
      showToast('Acceso denegado. Volviendo al dashboard.', 'warning');
      setTimeout(() => location.href = 'app.html', 1500);
      return;
    }

    // Load inventory info
    getInventory(INV_ID).then(inv => {
      currentInv = inv;
      document.title = `${inv.name} — SysInventarios`;
      document.getElementById('page-inv-title').textContent = inv.name;
      document.getElementById('page-inv-desc').textContent = inv.description || '';
      document.getElementById('sidebar-inv-name').querySelector('span.icon').nextSibling.textContent = ` ${inv.name}`;
      document.getElementById('edit-inv-name').value = inv.name;
      document.getElementById('edit-inv-desc').value = inv.description || '';

      // Link add device buttons
      const url = `add-device.html?inv=${INV_ID}`;
      document.getElementById('btn-add-device').href = url;
      document.getElementById('btn-add-device-empty').href = url;
      document.getElementById('fab-add-device').href = url;
    });

    // Start real-time listener
    listenDevices(INV_ID, devices => {
      allDevices = devices;
      applyFilters();
      updateHeaderStats(devices);
    });
  });

  initSidebar();

  // Poblar selects de tipo de dispositivo
  populateTypeSelect(document.getElementById('filter-type'), { includeAll: true });
  populateTypeSelect(document.getElementById('ed-type'));

  // STATS
  function updateHeaderStats(devices) {
    document.getElementById('hdr-count').textContent = devices.length;
    document.getElementById('hdr-func').textContent = devices.filter(d => d.status === 'Funcional').length;
    document.getElementById('hdr-nofunc').textContent = devices.filter(d => d.status === 'No Funcional').length;
  }

  // FILTERS
  document.getElementById('search-devices').addEventListener('input', applyFilters);
  document.getElementById('filter-type').addEventListener('change', applyFilters);
  document.getElementById('filter-status').addEventListener('change', applyFilters);

  function applyFilters() {
    const q = document.getElementById('search-devices').value.toLowerCase();
    const type = document.getElementById('filter-type').value;
    const status = document.getElementById('filter-status').value;
    const filtered = allDevices.filter(d => {
      const matchQ = !q || [d.universitySerial, d.deviceSerial, d.brand, d.type]
        .some(v => (v || '').toLowerCase().includes(q));
      const matchT = !type || d.type === type;
      const matchS = !status || d.status === status;
      return matchQ && matchT && matchS;
    });
    renderDevices(filtered);
  }

  // RENDER TABLE
  const STATUS_CLASS = { 'Funcional': 'badge-success', 'No Funcional': 'badge-danger', 'Desconocido': 'badge-warning' };

  function renderDevices(devices) {
    const tbody = document.getElementById('devices-tbody');
    const empty = document.getElementById('empty-devices');
    if (devices.length === 0) {
      tbody.innerHTML = '';
      if (allDevices.length === 0) { empty.style.display = ''; }
      else {
        empty.style.display = 'none';
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">Sin resultados para los filtros aplicados.</td></tr>`;
      }
      return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = devices.map(d => `
      <tr data-id="${escHtml(d.id)}" style="cursor:pointer" title="Click para ver detalles">
        <td><span class="type-icon">${TYPE_ICONS[d.type] || '📦'}</span> <span class="text-sm">${escHtml(d.type || '—')}</span></td>
        <td>
          <strong>${escHtml(d.brand || '—')}</strong>
          <div class="text-xs text-muted">${escHtml(d.model || '—')}</div>
        </td>
        <td>
          <div class="flex items-center gap-xs">
            <code style="font-size:0.8rem;color:var(--indigo-light)">${escHtml(d.universitySerial || '—')}</code>
            ${d.universitySerial ? `<button class="btn btn-ghost btn-icon btn-xs copy-serial-btn" data-serial="${escHtml(d.universitySerial)}" title="Copiar serial universitario">📋</button>` : ''}
          </div>
        </td>
        <td class="td-muted">
          <div class="flex items-center gap-xs">
            <span>${escHtml(d.deviceSerial || '—')}</span>
            ${d.deviceSerial ? `<button class="btn btn-ghost btn-icon btn-xs copy-serial-btn" data-serial="${escHtml(d.deviceSerial)}" title="Copiar serial dispositivo">📋</button>` : ''}
          </div>
        </td>
        <td><span class="badge ${STATUS_CLASS[d.status] || 'badge-default'}">${escHtml(d.status || 'Desconocido')}</span></td>
        <td class="td-muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(d.notes || '')}">
          ${d.notes ? escHtml(d.notes.slice(0, 60)) + (d.notes.length > 60 ? '…' : '') : '—'}
        </td>
        <td class="td-muted">${timeAgo(d.createdAt)}</td>
        <td class="actions-cell">
          <div class="flex gap-xs">
            <button class="btn btn-ghost btn-icon btn-sm view-btn"   data-id="${escHtml(d.id)}" title="Ver detalles">👁️</button>
            <button class="btn btn-primary btn-icon btn-sm edit-btn" data-id="${escHtml(d.id)}" title="Editar">✏️</button>
            <button class="btn btn-danger  btn-icon btn-sm del-btn"  data-id="${escHtml(d.id)}" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Event delegation para la tabla
  document.getElementById('devices-tbody').addEventListener('click', e => {
    const copyBtn = e.target.closest('.copy-serial-btn');
    if (copyBtn) {
      e.stopPropagation();
      copyToClipboard(copyBtn.dataset.serial);
      return;
    }
    const viewBtn = e.target.closest('.view-btn');
    if (viewBtn) { e.stopPropagation(); viewDevice(viewBtn.dataset.id); return; }
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) { e.stopPropagation(); openEditModal(editBtn.dataset.id); return; }
    const delBtn = e.target.closest('.del-btn');
    if (delBtn) { e.stopPropagation(); confirmDeleteDevice(delBtn.dataset.id); return; }
    const row = e.target.closest('tr[data-id]');
    if (row && !e.target.closest('.actions-cell')) viewDevice(row.dataset.id);
  });

  // VIEW DEVICE
  function viewDevice(id) {
    const d = allDevices.find(x => x.id === id);
    if (!d) return;
    document.getElementById('view-device-title').textContent = `${d.brand || ''} ${d.type || ''}`.trim() || 'Detalles';
    document.getElementById('view-device-body').innerHTML = `
      <div class="flex flex-col gap-md">
        <div class="flex gap-md flex-wrap">
          <div style="flex:1;min-width:200px">
            <div class="form-label">Serial Universitario</div>
            <div class="flex items-center gap-sm" style="margin-top:4px">
              <div style="font-weight:600;color:var(--indigo-light)">${escHtml(d.universitySerial || '—')}</div>
              ${d.universitySerial ? `<button class="btn btn-ghost btn-icon btn-sm copy-serial-btn" data-serial="${escHtml(d.universitySerial)}">📋</button>` : ''}
            </div>
          </div>
          <div style="flex:1;min-width:200px">
            <div class="form-label">Serial del Dispositivo</div>
            <div class="flex items-center gap-sm" style="margin-top:4px">
              <div style="font-weight:600">${escHtml(d.deviceSerial || '—')}</div>
              ${d.deviceSerial ? `<button class="btn btn-ghost btn-icon btn-sm copy-serial-btn" data-serial="${escHtml(d.deviceSerial)}">📋</button>` : ''}
            </div>
          </div>
        </div>
        <div class="flex gap-md flex-wrap">
          <div style="flex:1"><div class="form-label">Marca</div><div style="margin-top:4px">${escHtml(d.brand || '—')}</div></div>
          <div style="flex:1"><div class="form-label">Modelo</div><div style="margin-top:4px">${escHtml(d.model || '—')}</div></div>
          <div style="flex:1"><div class="form-label">Tipo</div><div style="margin-top:4px">${escHtml(d.type || '—')}</div></div>
          <div style="flex:1"><div class="form-label">Estado</div>
            <div style="margin-top:4px"><span class="badge ${STATUS_CLASS[d.status] || 'badge-default'}">${escHtml(d.status || 'Desconocido')}</span></div>
          </div>
        </div>
        ${d.specs ? `
        <div class="divider"></div>
        <div class="form-label" style="margin-bottom:8px">Especificaciones Técnicas</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${[['Procesador', d.specs.processor], ['RAM', d.specs.ram], ['Almacenamiento', d.specs.storage], ['Pantalla', d.specs.screen], ['Sistema Operativo', d.specs.os], ['Otros', d.specs.other]].filter(([, v]) => v).map(([k, v]) => `
          <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:10px 14px">
            <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">${k}</div>
            <div style="font-size:0.875rem;margin-top:3px">${escHtml(v)}</div>
          </div>`).join('')}
        </div>` : ''}
        ${d.notes ? `<div class="form-group"><div class="form-label">Notas</div><div style="color:var(--text-secondary);margin-top:4px;line-height:1.6">${escHtml(d.notes)}</div></div>` : ''}
        <div class="flex gap-md text-xs text-muted" style="margin-top:10px; flex-wrap:wrap;">
          <span>Creado: ${formatDate(d.createdAt)}</span>
          <span>Actualizado: ${formatDate(d.updatedAt)}</span>
          ${d.createdByEmail ? `<span>Agregado por: <strong>${escHtml(d.createdByEmail)}</strong></span>` : ''}
          ${d.extractedByAI ? '<span class="ai-badge">✨ Extraído por IA</span>' : ''}
        </div>
      </div>
    `;
    document.getElementById('btn-delete-device').onclick = () => confirmDeleteDevice(id);
    document.getElementById('btn-edit-device').onclick = () => {
      closeModal('modal-view-device');
      location.href = `add-device.html?inv=${INV_ID}&edit=${id}`;
    };
    
    // Event delegation para los botones de copiar dentro del modal de detalle
    const detailsBody = document.getElementById('view-device-body');
    // Eliminar listeners antiguos si los hay clonando el nodo
    const newBody = detailsBody.cloneNode(true);
    detailsBody.parentNode.replaceChild(newBody, detailsBody);
    
    newBody.addEventListener('click', e => {
      const btn = e.target.closest('.copy-serial-btn');
      if (btn) copyToClipboard(btn.dataset.serial);
    });
    
    openModal('modal-view-device');
  }

  // DELETE DEVICE
  async function confirmDeleteDevice(id) {
    closeModal('modal-view-device');
    const ok = await confirmDialog('¿Eliminar este equipo del inventario? Esta acción no se puede deshacer.', 'Eliminar Equipo');
    if (!ok) return;
    try {
      await deleteDevice(INV_ID, id);
      showToast('Equipo eliminado.', 'success');
    } catch (e) {
      showToast('Error al eliminar: ' + e.message, 'error');
    }
  }

  // EDIT INVENTORY
  window.handleSaveInventory = async function () {
    const name = document.getElementById('edit-inv-name').value.trim();
    const desc = document.getElementById('edit-inv-desc').value.trim();
    if (!name) { showToast('El nombre es requerido.', 'warning'); return; }
    const btn = document.getElementById('btn-save-inv');
    btn.classList.add('loading'); btn.disabled = true;
    try {
      await updateInventory(INV_ID, { name, description: desc });
      document.getElementById('page-inv-title').textContent = name;
      closeModal('modal-edit-inv');
      showToast('Inventario actualizado.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  };

  window.handleDeleteInventory = async function () {
    closeModal('modal-edit-inv');
    const ok = await confirmDialog('¿Eliminar ESTE INVENTARIO y todos sus equipos? Esta acción es PERMANENTE.', '⚠️ Eliminar Inventario');
    if (!ok) return;
    try {
      await deleteInventory(INV_ID);
      sessionStorage.removeItem(`inv_access_${INV_ID}`);
      showToast('Inventario eliminado.', 'success');
      setTimeout(() => location.href = 'app.html', 1000);
    } catch (e) { showToast(e.message, 'error'); }
  };

  // EDIT DEVICE MODAL
  let editingDeviceId = null;

  window.openEditModal = function (id) {
    const d = allDevices.find(x => x.id === id);
    if (!d) return;
    editingDeviceId = id;
    document.getElementById('ed-univ-serial').value = d.universitySerial || '';
    document.getElementById('ed-dev-serial').value = d.deviceSerial || '';
    document.getElementById('ed-brand').value = d.brand || '';
    document.getElementById('ed-model').value = d.model || '';
    document.getElementById('ed-type').value = d.type || '';
    document.getElementById('ed-proc').value = d.specs?.processor || '';
    document.getElementById('ed-ram').value = d.specs?.ram || '';
    document.getElementById('ed-storage').value = d.specs?.storage || '';
    document.getElementById('ed-screen').value = d.specs?.screen || '';
    document.getElementById('ed-os').value = d.specs?.os || '';
    document.getElementById('ed-other').value = d.specs?.other || '';
    document.getElementById('ed-notes').value = d.notes || '';
    const statusMap = { 'Funcional': 'eds-func', 'No Funcional': 'eds-nofunc', 'Desconocido': 'eds-unknown' };
    const radioId = statusMap[d.status] || 'eds-unknown';
    document.getElementById(radioId).checked = true;
    updateSpecVisibility(d.type, 'ed-');
    openModal('modal-edit-device');
  };

  window.handleSaveDevice = async function () {
    const univSerial = document.getElementById('ed-univ-serial').value.trim();
    const devSerial = document.getElementById('ed-dev-serial').value.trim();
    const brand = document.getElementById('ed-brand').value.trim();
    const model = document.getElementById('ed-model').value.trim();
    const type = document.getElementById('ed-type').value;
    const status = document.querySelector('input[name="ed-status"]:checked')?.value || 'Desconocido';
    const notes = document.getElementById('ed-notes').value.trim();

    if (!univSerial || !brand || !type) {
      showToast('Completa los campos obligatorios.', 'warning'); return;
    }
    const btn = document.getElementById('btn-save-device');
    btn.classList.add('loading'); btn.disabled = true;
    try {
      const dup = await checkDuplicateSerial(INV_ID, univSerial, devSerial, editingDeviceId);
      if (dup) {
        showToast(`Error: El serial ${dup.type} ya está registrado.`, 'error');
        btn.classList.remove('loading'); btn.disabled = false;
        return;
      }

      const getVisibleVal = (id) => {
        const el = document.getElementById(id);
        const group = el.closest('.form-group');
        return (group && group.style.display !== 'none') ? el.value.trim() || null : null;
      };

      await updateDevice(INV_ID, editingDeviceId, {
        universitySerial: univSerial, deviceSerial: devSerial,
        brand, model, type, status, notes,
        specs: {
          processor: getVisibleVal('ed-proc'),
          ram: getVisibleVal('ed-ram'),
          storage: getVisibleVal('ed-storage'),
          screen: getVisibleVal('ed-screen'),
          os: getVisibleVal('ed-os'),
          other: getVisibleVal('ed-other'),
        },
      });
      closeModal('modal-edit-device');
      showToast('Equipo actualizado correctamente.', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  };

  // EXPORT TO EXCEL
  window.exportToExcel = function () {
    if (allDevices.length === 0) { showToast('No hay equipos para exportar.', 'warning'); return; }
    const invName = currentInv?.name || 'Inventario';
    const rows = allDevices.map(d => ({
      'Serial Universitario': d.universitySerial || '',
      'Serial Dispositivo': d.deviceSerial || '',
      'Marca': d.brand || '',
      'Modelo': d.model || '',
      'Tipo': d.type || '',
      'Estado': d.status || '',
      'Procesador': d.specs?.processor || '',
      'RAM': d.specs?.ram || '',
      'Almacenamiento': d.specs?.storage || '',
      'Pantalla': d.specs?.screen || '',
      'Sistema Operativo': d.specs?.os || '',
      'Otras Specs': d.specs?.other || '',
      'Notas': d.notes || '',
      'Agregado por': d.createdByEmail || '—',
      'Extraído por IA': d.extractedByAI ? 'Sí' : 'No',
      'Fecha Registro': d.createdAt ? formatDate(d.createdAt) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [20, 20, 14, 22, 14, 22, 12, 16, 14, 20, 16, 30, 14, 16].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, invName.slice(0, 31));
    const fileName = `${invName.replace(/[^a-zA-Z0-9 ]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast(`Excel exportado: ${fileName}`, 'success');
  };

  // DUPLICATE DETECTION (MODAL)
  let edDupTimeout = null;
  window.handleEditSerialInput = function () {
    clearTimeout(edDupTimeout);
    edDupTimeout = setTimeout(async () => {
      const univ = document.getElementById('ed-univ-serial').value.trim();
      const dev = document.getElementById('ed-dev-serial').value.trim();
      const dup = await checkDuplicateSerial(INV_ID, univ, dev, editingDeviceId);

      document.getElementById('ed-dup-univ-msg').style.display = (dup && dup.type === 'universitario') ? 'block' : 'none';
      document.getElementById('ed-dup-dev-msg').style.display = (dup && dup.type === 'fabricante') ? 'block' : 'none';
      document.getElementById('ed-univ-serial').style.borderColor = (dup && dup.type === 'universitario') ? 'var(--danger)' : '';
      document.getElementById('ed-dev-serial').style.borderColor = (dup && dup.type === 'fabricante') ? 'var(--danger)' : '';
    }, 500);
  };

  // BULK IMPORT LOGIC
  let rawExcelData = [];
  let mappedDevices = [];

  window.handleExcelFile = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('excel-file-name').textContent = file.name;
    document.getElementById('bulk-error-banner').style.display = 'none';
    document.getElementById('btn-bulk-analyze').innerHTML = '✨ Analizar con IA';

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);

      rawExcelData = jsonData;
      if (rawExcelData.length > 0) {
        document.getElementById('btn-bulk-analyze').style.display = 'inline-flex';
        if (rawExcelData.length > 50) {
          showToast('El archivo contiene más de 50 equipos. Solo se procesarán los primeros 50.', 'warning', 6000);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  window.handleBulkAnalyze = async function () {
    if (rawExcelData.length === 0) return;

    document.getElementById('bulk-error-banner').style.display = 'none';
    const btn = document.getElementById('btn-bulk-analyze');
    btn.classList.add('loading'); btn.disabled = true;
    showLoading('Gemini está analizando y mapeando tus datos...');

    try {
      const dataToProcess = rawExcelData.slice(0, 50);
      mappedDevices = await analyzeBulkExcel(dataToProcess);

      renderBulkPreview(mappedDevices);
      document.getElementById('import-step-1').style.display = 'none';
      document.getElementById('import-step-2').style.display = 'block';
      document.getElementById('btn-bulk-analyze').style.display = 'none';
      document.getElementById('btn-bulk-save').style.display = 'inline-flex';
      document.getElementById('import-count-badge').textContent = `${mappedDevices.length} equipos`;

      hideLoading();
      showToast('Análisis completado. Verifica los datos.', 'success');
    } catch (err) {
      hideLoading();
      document.getElementById('bulk-error-msg').textContent = err.message;
      document.getElementById('bulk-error-banner').style.display = 'block';
      btn.innerHTML = '🔄 Reintentar Análisis';
      showToast('Error en el análisis. Inténtalo de nuevo.', 'error');
    } finally {
      btn.classList.remove('loading'); btn.disabled = false;
    }
  };

  function renderBulkPreview(devices) {
    const tbody = document.getElementById('import-preview-body');
    tbody.innerHTML = devices.map(d => `
      <tr>
        <td>${escHtml(d.brand || '—')}</td>
        <td>${escHtml(d.type || '—')}</td>
        <td><code>${escHtml(d.universitySerial || '—')}</code></td>
        <td>${escHtml(d.deviceSerial || '—')}</td>
        <td><span class="badge ${STATUS_CLASS[d.status]}">${d.status}</span></td>
      </tr>
    `).join('');
  }

  window.handleBulkSave = async function () {
    const btn = document.getElementById('btn-bulk-save');
    btn.classList.add('loading'); btn.disabled = true;
    showLoading(`Guardando ${mappedDevices.length} equipos...`);

    try {
      await bulkAddDevices(INV_ID, mappedDevices, currentUser.uid, currentUser.email);
      hideLoading();
      showToast('¡Importación exitosa!', 'success');
      closeModal('modal-import-excel');
      rawExcelData = []; mappedDevices = [];
      document.getElementById('import-step-1').style.display = 'block';
      document.getElementById('import-step-2').style.display = 'none';
      document.getElementById('btn-bulk-save').style.display = 'none';
    } catch (err) {
      hideLoading();
      showToast('Error al guardar: ' + err.message, 'error');
      btn.classList.remove('loading'); btn.disabled = false;
    }
  };
})();
