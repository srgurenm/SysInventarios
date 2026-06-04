/**
 * gemini.js — Integración con Gemini Vision via Netlify Function
 * Convierte imágenes a base64 y llama al proxy seguro.
 *
 * Mejoras v2:
 * - Timeout de 50 s con AbortController (previene bucles infinitos)
 * - Detección de solicitud duplicada (cancela la anterior si se llama de nuevo)
 * - Callbacks de progreso para la UI (onProgress(stage, percent))
 * - Información del modelo usado retornada en el resultado
 */

const ANALYZE_TIMEOUT_MS = 50_000; // 50 s — margen sobre el timeout del servidor (40 s × 2 modelos)

/** Controlador de la petición en curso. Permite cancelarla si se lanza una nueva. */
let _activeController = null;

/**
 * Comprime una imagen si es muy grande antes de mandarla a la IA.
 * Esto evita errores de "Payload Too Large" (500/413).
 */
function compressImage(file, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', quality);
      };
    };
  });
}

/**
  * Convierte un File a objeto { mimeType, data (base64) }
  */
async function fileToBase64(file) {
  // Comprimir primero si es una imagen grande
  const blob = file.size > 500 * 1024 ? await compressImage(file) : file;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Limpiar prefijo data:image/jpeg;base64,
      const base64 = reader.result.split(',')[1];
      resolve({ mimeType: 'image/jpeg', data: base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Analiza un array de File objects con Gemini Vision.
 * Retorna los datos extraídos del dispositivo.
 *
 * @param {File[]} files - Entre 1 y 4 imágenes
 * @param {Function} [onProgress] - Callback(stage: string, percent: number)
 * @returns {Promise<object>} Datos extraídos + campo _modelUsed
 */
async function analyzeImagesWithGemini(files, onProgress) {
  if (!files || files.length === 0) throw new Error('Debes seleccionar al menos una imagen.');
  if (files.length > 4) throw new Error('Máximo 4 imágenes permitidas.');

  // Validate file types
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  for (const f of files) {
    if (!allowed.includes(f.type)) {
      throw new Error(`Formato no soportado: ${f.name}. Usa JPG, PNG o WebP.`);
    }
    if (f.size > 8 * 1024 * 1024) {
      throw new Error(`La imagen ${f.name} supera el límite de 8MB.`);
    }
  }

  // Cancelar análisis anterior si existía (previene bucles)
  if (_activeController) {
    console.warn('[gemini.js] Cancelando análisis previo en curso...');
    _activeController.abort();
  }

  _activeController = new AbortController();
  const signal = _activeController.signal;

  // Timeout global del cliente
  const timeoutId = setTimeout(() => {
    if (_activeController) _activeController.abort();
  }, ANALYZE_TIMEOUT_MS);

  const progress = (stage, percent) => {
    if (typeof onProgress === 'function') onProgress(stage, percent);
  };

  try {
    // Etapa 1: Comprimir y codificar
    progress('Comprimiendo imágenes...', 15);
    const images = await Promise.all(files.map(fileToBase64));

    // Etapa 2: Enviar
    progress('Enviando a la IA...', 40);

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`;
    
    const body = {
      contents: [{
        parts: [
          { text: "Analiza la etiqueta en la imagen con precisión. \n1. PRIORIDAD ALTA: Busca y extrae el 'Serial Universitario' (números de inventario). \n2. PRIORIDAD ALTA: Busca y extrae el 'Serial del Fabricante' (busca etiquetas como 'Serial No.', 'S/N', 'Serial Number', 'Service Tag' o similares). \n3. Extrae también: tipoEquipo, notas y caracteristicas técnicas. \nSi no encuentras un valor específico, usa 'No detectado'. \nResponde EXCLUSIVAMENTE en formato JSON plano (sin formato markdown): {\"tipoEquipo\":\"...\",\"serialUniv\":\"...\",\"serialFab\":\"...\",\"notas\":\"...\",\"caracteristicas\":\"...\"}." },
          ...images.map(img => ({
            inline_data: { mime_type: img.mimeType, data: img.data }
          }))
        ]
      }]
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    // Etapa 3: Recibiendo respuesta
    progress('Procesando respuesta...', 75);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error ${response.status} al contactar Gemini.`);
    }

    const result = await response.json();
    const responseText = result.candidates[0].content.parts[0].text;
    
    // Limpiar el JSON de respuesta (Gemini a veces añade bloques ```json)
    const jsonStr = responseText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(jsonStr);

    // Etapa 4: Listo
    progress('¡Análisis completado!', 100);

    // Adjuntar el modelo usado
    data._modelUsed = 'gemini-2.0-flash';

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('El análisis tardó demasiado y fue cancelado. Inténtalo de nuevo.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    _activeController = null;
  }
}

/**
 * Genera preguntas de seguimiento si hay campos faltantes.
 * Retorna un array de strings (preguntas).
 */
function buildFollowUpQuestions(extracted) {
  const questions = extracted.clarificationQuestions || [];
  const missing = extracted.missingFields || [];

  const fieldLabels = {
    universitySerial: 'Serial Universitario',
    deviceSerial: 'Serial del Fabricante',
    brand: 'Marca',
    type: 'Tipo de Dispositivo',
    'specs.processor': 'Procesador',
    'specs.ram': 'Memoria RAM',
    'specs.storage': 'Almacenamiento',
    'specs.screen': 'Pantalla',
    'specs.os': 'Sistema Operativo',
  };

  const extra = missing
    .filter(f => !questions.some(q => q.toLowerCase().includes(fieldLabels[f]?.toLowerCase() || '')))
    .map(f => `¿Puedes indicar el campo "${fieldLabels[f] || f}"?`);

  return [...questions, ...extra];
}

/**
 * Envía una lista de filas de Excel a Gemini para mapearlas al esquema de la app.
 */
async function analyzeBulkExcel(data) {
  if (!data || data.length === 0) throw new Error('No hay datos para procesar.');

  const BULK_TIMEOUT_MS = 60_000; // 60s
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BULK_TIMEOUT_MS);

  try {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.GEMINI_API_KEY}`;
    
    const body = {
      contents: [{
        parts: [
          { text: "Analiza estos datos masivos y mapealos al esquema JSON requerido. Devuelve SOLO el JSON." },
          { text: JSON.stringify(data) }
        ]
      }]
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error ${response.status} en análisis masivo.`);
    }

    const result = await response.json();
    const responseText = result.candidates[0].content.parts[0].text;
    const jsonStr = responseText.replace(/```json|```/g, "").trim();
    
    return JSON.parse(jsonStr);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('El análisis masivo tardó demasiado y fue cancelado. Inténtalo de nuevo.');
    }
    throw err;
  }
}
