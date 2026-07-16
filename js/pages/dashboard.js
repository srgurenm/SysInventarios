/**
 * dashboard.js — Lógica para el Dashboard General
 */
(function () {
  requireAuth().then(user => {
    setupUserProfile(user);
    initSidebar();
    loadGlobalStats(user.uid);
    loadLogs();
  });

  async function loadGlobalStats(uid) {
    listenInventories(uid, inventories => {
      renderDashboard(inventories);
    });
  }

  function loadLogs() {
    listenSystemLogs(logs => {
      renderLogs(logs);
    });
  }

  function renderDashboard(inventories) {
    const totalInventories = inventories.length;
    const totalDevices = inventories.reduce((s, i) => s + (i.deviceCount || 0), 0);
    const functionalDevices = inventories.reduce((s, i) => s + (i.funcCount || 0), 0);

    const container = document.getElementById('dashboard-content');
    
    // Contenedor de estadísticas
    let html = `
      <div class="stats-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
        <h3>Métricas Globales</h3>
        <button class="btn btn-secondary btn-sm" onclick="syncAllStats()">🔄 Sincronizar Estadísticas</button>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalInventories}</div>
          <div class="stat-label">Inventarios Totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalDevices}</div>
          <div class="stat-label">Equipos Totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${functionalDevices}</div>
          <div class="stat-label">Equipos Funcionales</div>
        </div>
      </div>
      
      <div class="logs-section">
        <h3>Log de Actividad Reciente</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Mensaje</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody id="logs-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // Make global for button onclick
    window.allInventoriesForSync = inventories;
  }

  window.syncAllStats = async function() {
      showLoading("Sincronizando estadísticas...");
      try {
          await Promise.all(allInventoriesForSync.map(inv => recalculateStats(inv.id)));
          showToast("Estadísticas sincronizadas exitosamente", "success");
      } catch (e) {
          showToast("Error al sincronizar: " + e.message, "error");
      } finally {
          hideLoading();
      }
  }

  function renderLogs(logs) {
    const tbody = document.getElementById('logs-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = logs.slice(0, 10).map(log => `
      <tr>
        <td>${escHtml(log.type || 'Sistema')}</td>
        <td>${escHtml(log.message || log.action || '—')}</td>
        <td class="text-muted">${formatDate(log.createdAt)}</td>
      </tr>
    `).join('');
  }
})();
