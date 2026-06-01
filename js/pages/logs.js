/**
 * logs.js — Lógica de la página del Panel de Errores (logs.html)
 */

(function () {
  let currentUser = null;

  requireAuth().then(user => {
    currentUser = user;
    setupUserProfile(user);

    // Iniciar escucha de la base de datos para los errores
    listenSystemLogs(renderLogs);
  });

  initSidebar();

  function renderLogs(logs) {
    const container = document.getElementById('logs-container');
    const empty = document.getElementById('empty-logs');

    if (logs.length === 0) {
      container.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = logs.map(log => `
      <div class="log-row fade-in">
        <div class="log-header">
          <div class="log-type">🚨 ${escHtml(log.type || 'Error General')}</div>
          <div class="log-date">${formatDate(log.createdAt)} ${log.createdAt ? new Date(log.createdAt.toDate()).toLocaleTimeString() : ''}</div>
        </div>
        <div class="log-msg">${escHtml(log.message || 'Sin detalles disponibles')}</div>
        <div class="log-meta">
          <div><strong>Usuario:</strong> ${escHtml(log.userEmail || 'Anónimo')}</div>
          <div><strong>Página:</strong> <a href="${escHtml(log.url)}" target="_blank" style="color:var(--indigo-light)">${escHtml(log.url ? log.url.split('/').pop() : 'Desconocida')}</a></div>
          ${log.filename ? `<div><strong>Archivo:</strong> ${escHtml(log.filename.split('/').pop())}:${log.lineno}</div>` : ''}
        </div>
        ${log.stack ? `<details style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;"><summary style="cursor:pointer">Ver Trazabilidad (Stacktrace)</summary><pre style="margin-top:8px; overflow-x:auto; background:var(--bg-tertiary); padding:8px; border-radius:4px;">${escHtml(log.stack)}</pre></details>` : ''}
        <div class="log-actions">
          <button class="btn btn-ghost btn-sm" onclick="handleDeleteLog('${log.id}')">✓ Marcar como Resuelto</button>
        </div>
      </div>
    `).join('');
  }

  window.handleDeleteLog = async function (id) {
    const confirm = await confirmDialog('¿Estás seguro de marcar este error como resuelto? Se eliminará del registro permanentemente.', 'Resolver Error');
    if (confirm) {
      try {
        await deleteSystemLog(id);
        showToast('Registro eliminado correctamente', 'success');
      } catch(e) {
        showToast('Error al eliminar: ' + e.message, 'error');
      }
    }
  };
})();
