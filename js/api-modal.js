/* CSS para el modal de API Key */
const style = document.createElement('style');
style.textContent = `
  #api-key-modal {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  }
  .modal-content {
    background: #1a1a2e; color: #fff; padding: 25px; border-radius: 12px;
    max-width: 500px; width: 90%; font-family: sans-serif;
  }
  .modal-content a { color: #4e8cf9; }
  .modal-content input {
    width: 100%; padding: 10px; margin: 15px 0; border-radius: 5px; border: 1px solid #444;
    background: #16213e; color: white;
  }
  .modal-btn {
    padding: 10px 20px; border-radius: 5px; border: none; cursor: pointer;
    background: #6c63ff; color: white;
  }
`;
document.head.appendChild(style);

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
