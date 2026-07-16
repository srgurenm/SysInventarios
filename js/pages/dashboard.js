/**
 * dashboard.js — Lógica para el Dashboard General
 */
(function () {
  requireAuth().then(user => {
    setupUserProfile(user);
    initSidebar();
    loadGlobalStats(user.uid);
  });

  async function loadGlobalStats(uid) {
    // Escuchar todos los inventarios del usuario
    listenInventories(uid, inventories => {
      renderDashboard(inventories);
    });
  }

  function renderDashboard(inventories) {
    const totalInventories = inventories.length;
    const totalDevices = inventories.reduce((s, i) => s + (i.deviceCount || 0), 0);
    const functionalDevices = inventories.reduce((s, i) => s + (i.funcCount || 0), 0); // Asumiendo que esta propiedad existe

    const container = document.getElementById('dashboard-content');
    container.innerHTML = `
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
    `;
  }
})();
