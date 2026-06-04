function showApiKeyModal() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.id = 'api-key-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Configuración necesaria para IA</h3>
        <p>1. Obtén tu clave aquí: <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a></p>
        <p>2. <b>IMPORTANTE:</b> En la consola de Google Cloud, edita la clave y añade la restricción de sitio web para: <b>https://srgurenm.github.io/*</b></p>
        <input type="text" id="temp-api-key" placeholder="Pega tu API Key aquí...">
        <button class="modal-btn" id="save-key">Guardar y Continuar</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('save-key').onclick = () => {
      const key = document.getElementById('temp-api-key').value;
      document.body.removeChild(modal);
      resolve(key.trim());
    };
  });
}

async function getApiKey() {
  let key = localStorage.getItem('gemini_api_key');
  if (!key) {
    key = await showApiKeyModal();
    if (key) {
      localStorage.setItem('gemini_api_key', key);
    }
  }
  return key;
}
