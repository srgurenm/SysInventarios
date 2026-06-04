/**
 * add-device.js — Lógica de la página de registro/edición de equipo (add-device.html)
 */

(function () {
  const params = new URLSearchParams(window.location.search);
  const INV_ID = params.get('inv');
  const EDIT_ID = params.get('edit');

  if (!INV_ID) {
    location.href = 'app.html';
    return;
  }

  let currentUser = null;
  let selectedFiles = [];
  let aiExtracted = false;

  // INIT
  requireAuth().then(user => {
    currentUser = user;
    setupUserProfile(user);

    if (!sessionStorage.getItem(`inv_access_${INV_ID}`)) {
      showToast('Acceso denegado.', 'warning');
      setTimeout(() => location.href = 'app.html', 1200);
      return;
    }

    const backUrl = `inventory.html?id=${INV_ID}`;
    document.getElementById('back-link').href = backUrl;
    document.getElementById('cancel-link').href = backUrl;

    if (EDIT_ID) {
      document.getElementById('page-title').textContent = 'Editar Equipo';
      loadEditDevice();
    } else {
      // Inicializar visibilidad en limpio
      updateSpecVisibility('', 'f-');
    }
  });

  initSidebar();

  // Poblar select de tipo de dispositivo
  populateTypeSelect(document.getElementById('f-type'), { includePlaceholder: true });

  // Cargar datos del dispositivo
  async function loadEditDevice() {
    try {
      const d = await getDevice(INV_ID, EDIT_ID);
      fillForm(d, false);
    } catch (e) { showToast('Error cargando dispositivo: ' + e.message, 'error'); }
  }

  // Subir imágenes
  const fileInput = document.getElementById('file-input');
  const uploadZone = document.getElementById('upload-zone');

  fileInput.addEventListener('change', e => handleFiles(e.target.files));

  // arrastra
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault(); uploadZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  function handleFiles(files) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const valid = [...files].filter(f => allowed.includes(f.type));
    const combined = [...selectedFiles, ...valid].slice(0, 4);
    selectedFiles = combined;
    renderPreviews();
  }

  function renderPreviews() {
    const container = document.getElementById('img-previews');
    container.innerHTML = selectedFiles.map((f, i) => {
      const url = URL.createObjectURL(f);
      return `<div class="img-thumb">
        <img src="${url}" alt="Imagen ${i + 1}">
        <button class="remove-btn" onclick="removeImage(${i})">✕</button>
      </div>`;
    }).join('');

    const n = selectedFiles.length;
    document.getElementById('img-count-label').textContent = n > 0 ? `${n}/4 imagen(es) seleccionada(s)` : '';
    document.getElementById('btn-analyze').disabled = n === 0;
  }

  window.removeImage = function (i) {
    selectedFiles.splice(i, 1);
    renderPreviews();
  };

  window.clearImages = function () {
    selectedFiles = [];
    fileInput.value = '';
    renderPreviews();
    document.getElementById('ai-panel').style.display = 'none';
    document.getElementById('questions-banner').style.display = 'none';
  };

  // ── Análisis con IA ──────────────────────────────────────────────────

  function showAnalysisProgress() {
    document.getElementById('ai-progress-wrapper').classList.add('visible');
    hideAnalysisError();
    updateProgress('Iniciando análisis...', 5);
  }

  function updateProgress(stage, percent) {
    const stageEl   = document.getElementById('ai-progress-stage');
    const percentEl = document.getElementById('ai-progress-percent');
    const fillEl    = document.getElementById('ai-progress-fill');
    const hintEl    = document.getElementById('ai-progress-hint');

    stageEl.textContent   = stage;
    percentEl.textContent = percent + '%';
    fillEl.style.width    = percent + '%';

    const isDone = percent >= 100;
    fillEl.classList.toggle('done', isDone);
    stageEl.classList.toggle('done', isDone);

    if (percent >= 40 && percent < 90) {
      hintEl.textContent = 'La IA está analizando el contenido de las imágenes...';
    } else if (percent >= 90) {
      hintEl.textContent = isDone ? '✅ ¡Listo! Datos extraídos correctamente.' : 'Procesando datos extraídos...';
    } else {
      hintEl.textContent = 'Esto puede tomar entre 10 y 40 segundos según la cantidad de imágenes.';
    }
  }

  function hideAnalysisProgress() {
    setTimeout(() => {
      document.getElementById('ai-progress-wrapper').classList.remove('visible');
    }, 1200);
  }

  function showAnalysisError(message) {
    document.getElementById('ai-error-message').textContent = message;
    document.getElementById('ai-error-banner').classList.add('visible');
    document.getElementById('ai-progress-wrapper').classList.remove('visible');
  }

  function hideAnalysisError() {
    document.getElementById('ai-error-banner').classList.remove('visible');
  }

  window.handleAnalyze = async function () {
    if (selectedFiles.length === 0) { showToast('Selecciona al menos una imagen.', 'warning'); return; }

    const btn      = document.getElementById('btn-analyze');
    const retryBtn = document.getElementById('btn-retry');

    btn.disabled = true;
    btn.classList.add('loading');
    if (retryBtn) retryBtn.disabled = true;

    showAnalysisProgress();

    try {
      const result = await analyzeImagesWithGemini(selectedFiles, (stage, percent) => {
        updateProgress(stage, percent);
      });

      fillForm(result, true);
      showAIPanel(result);
      showQuestions(result);
      aiExtracted = true;

      const modelLabel = result._modelUsed && result._modelUsed !== 'gemini-2.5-flash'
        ? ` (via ${result._modelUsed})`
        : '';
      showToast(`¡Análisis completado${modelLabel}! Verifica los datos extraídos.`, 'success');
      hideAnalysisProgress();

    } catch (e) {
      showAnalysisError(e.message);
      showToast('El análisis falló. Puedes reintentarlo sin perder las fotos.', 'error', 6000);
    } finally {
      btn.classList.remove('loading');
      btn.disabled = selectedFiles.length === 0;
      if (retryBtn) retryBtn.disabled = false;
    }
  };

  function fillForm(data, fromAI) {
    const ai = fromAI ? '✨' : '';
    const setVal = (id, val, lblId) => {
      if (val) {
        document.getElementById(id).value = val;
        if (fromAI) document.getElementById(id).classList.add('ai-filled');
        if (lblId) document.getElementById(lblId).textContent = fromAI && val ? ai : '';
      }
    };

    setVal('f-univ-serial', data.universitySerial, 'lbl-univ-serial');
    setVal('f-dev-serial', data.deviceSerial, 'lbl-dev-serial');
    setVal('f-brand', data.brand, 'lbl-brand');
    setVal('f-model', data.model, 'lbl-model');

    if (data.type) {
      const sel = document.getElementById('f-type');
      for (const opt of sel.options) {
        if (opt.value === data.type) { sel.value = data.type; break; }
      }
      if (fromAI) document.getElementById('lbl-type').textContent = ai;
    }

    if (data.specs) {
      setVal('f-proc', data.specs.processor, 'lbl-proc');
      setVal('f-ram', data.specs.ram, 'lbl-ram');
      setVal('f-storage', data.specs.storage, 'lbl-stor');
      setVal('f-screen', data.specs.screen, 'lbl-scr');
      setVal('f-os', data.specs.os, 'lbl-os');
      setVal('f-other', data.specs.other, 'lbl-other');
    }

    if (data.notes) setVal('f-notes', data.notes, 'lbl-notes');

    if (data.status) {
      const statusMap = { 'Funcional': 's-func', 'No Funcional': 's-nofunc', 'Desconocido': 's-unknown' };
      const radioId = statusMap[data.status];
      if (radioId) document.getElementById(radioId).checked = true;
    }

    if (data.type) {
      updateSpecVisibility(data.type, 'f-');
    }
  }

  function showAIPanel(result) {
    const panel = document.getElementById('ai-panel');
    const conf = result.confidence || 0;
    document.getElementById('conf-fill').style.width = conf + '%';
    document.getElementById('ai-confidence-label').textContent = `Confianza: ${conf}%`;
    panel.style.display = '';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showQuestions(result) {
    const questions = buildFollowUpQuestions(result);
    const banner = document.getElementById('questions-banner');
    const list = document.getElementById('questions-list');
    if (questions.length === 0) { banner.style.display = 'none'; return; }
    list.innerHTML = questions.map(q => `<li>${escHtml(q)}</li>`).join('');
    banner.style.display = '';
  }

    // Guardar dispositivo
    window.handleSave = async function () {
      const univSerial = document.getElementById('f-univ-serial').value.trim();
      const devSerial = document.getElementById('f-dev-serial').value.trim();
      const brand = document.getElementById('f-brand').value.trim();
      const model = document.getElementById('f-model').value.trim();
      const type = document.getElementById('f-type').value;
      const status = document.querySelector('input[name="status"]:checked')?.value || 'Desconocido';
      const notes = document.getElementById('f-notes').value.trim();

      // Validación corregida: Ahora solo valida campos reales de la interfaz
      if (!univSerial || !brand || !type) {
        showToast('Completa los campos obligatorios (Serial Univ., Marca, Tipo).', 'warning');
        return;
      }


    const getVisibleVal = (id) => {
      const el = document.getElementById(id);
      const group = el.closest('.form-group');
      return (group && group.style.display !== 'none') ? el.value.trim() || null : null;
    };

    const deviceData = {
      universitySerial: univSerial,
      deviceSerial: devSerial,
      brand, model, type, status, notes,
      specs: {
        processor: getVisibleVal('f-proc'),
        ram: getVisibleVal('f-ram'),
        storage: getVisibleVal('f-storage'),
        screen: getVisibleVal('f-screen'),
        os: getVisibleVal('f-os'),
        other: getVisibleVal('f-other'),
      },
      extractedByAI: aiExtracted
    };

    const btn = document.getElementById('btn-save');
    btn.classList.add('loading'); btn.disabled = true;
    showLoading(EDIT_ID ? 'Actualizando equipo...' : 'Guardando equipo...');

    try {
      const dup = await checkDuplicateSerial(INV_ID, univSerial, devSerial, EDIT_ID);
      if (dup) {
        hideLoading();
        showToast(`Error: El serial ${dup.type} ya existe.`, 'error');
        btn.classList.remove('loading'); btn.disabled = false;
        return;
      }

      if (EDIT_ID) {
        await updateDevice(INV_ID, EDIT_ID, deviceData);
      } else {
        await addDevice(INV_ID, deviceData, currentUser.uid, currentUser.email);
      }

      hideLoading();
      showToast(EDIT_ID ? 'Equipo actualizado.' : 'Equipo agregado al inventario.', 'success');
      setTimeout(() => { location.href = `inventory.html?id=${INV_ID}`; }, 1000);
    } catch (e) {
      hideLoading();
      showToast('Error al guardar: ' + e.message, 'error');
      btn.classList.remove('loading'); btn.disabled = false;
    }
  };

  // Detección de duplicados
  let dupTimeout = null;
  window.handleSerialInput = function () {
    clearTimeout(dupTimeout);
    dupTimeout = setTimeout(async () => {
      const univ = document.getElementById('f-univ-serial').value.trim();
      const dev = document.getElementById('f-dev-serial').value.trim();

      const dup = await checkDuplicateSerial(INV_ID, univ, dev, EDIT_ID);

      const univMsg = document.getElementById('dup-univ-msg');
      const devMsg = document.getElementById('dup-dev-msg');
      const univInp = document.getElementById('f-univ-serial');
      const devInp = document.getElementById('f-dev-serial');

      univMsg.style.display = (dup && dup.type === 'universitario') ? 'flex' : 'none';
      devMsg.style.display = (dup && dup.type === 'fabricante') ? 'flex' : 'none';

      univInp.classList.toggle('is-invalid', dup && dup.type === 'universitario');
      devInp.classList.toggle('is-invalid', dup && dup.type === 'fabricante');
    }, 500);
  };

  // Atajos de teclado
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  });
})();
