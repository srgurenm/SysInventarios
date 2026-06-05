/**
 * gemini.js — Integración con Gemini Vision via API directa
 * Convierte imágenes a base64 y llama a la API de Gemini.
 *
 * Mejoras v3:
 * - Timeout de 50 s con AbortController (previene bucles infinitos)
 * - Detección de solicitud duplicada (cancela la anterior si se llama de nuevo)
 * - Callbacks de progreso para la UI (onProgress(stage, percent))
 * - Modelo centralizado en constante
 * - Manejo robusto de errores en compressImage y respuestas de la API
 * - Uso consistente de getApiKey() en todas las funciones
 */

/** Modelo de Gemini a usar en todas las llamadas */
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_PROMPT_ANALYZE = "Analiza la etiqueta en la imagen con precisión. Extrae los datos y responde EXCLUSIVAMENTE en formato JSON plano (sin formato markdown) con la siguiente estructura: {\"universitySerial\":\"...\",\"deviceSerial\":\"...\",\"brand\":\"...\",\"model\":\"...\",\"type\":\"...\",\"specs\":{\"processor\":\"...\",\"ram\":\"...\",\"storage\":\"...\",\"screen\":\"...\",\"os\":\"...\",\"other\":\"...\"},\"notes\":\"...\",\"status\":\"Funcional\"}. Si no encuentras un valor, usa 'No detectado'.";
const GEMINI_PROMPT_BULK = "Analiza estos datos de inventario y mapéalos al siguiente esquema JSON. Devuelve SOLO un array JSON (sin markdown) donde cada elemento tenga esta estructura: {\"universitySerial\":\"...\",\"deviceSerial\":\"...\",\"brand\":\"...\",\"model\":\"...\",\"type\":\"...\",\"status\":\"Funcional\",\"notes\":\"...\",\"specs\":{\"processor\":\"...\",\"ram\":\"...\",\"storage\":\"...\",\"screen\":\"...\",\"os\":\"...\",\"other\":\"...\"}}. Los tipos válidos son: Computador de Escritorio, Portátil/Laptop, Pantalla/Monitor, All-in-One, Tablet, Impresora, Servidor, Switch/Router, Proyector, Otro. Los estados válidos son: Funcional, No Funcional, Desconocido. Si un campo no tiene datos, usa cadena vacía \"\".";

const ANALYZE_TIMEOUT_MS = 50_000; // 50 s
const BULK_TIMEOUT_MS = 60_000;    // 60 s

/** Controlador de la petición en curso. Permite cancelarla si se lanza una nueva. */
let _activeController = null;

/**
 * Comprime una imagen si es muy grande antes de mandarla a la IA.
 * Esto evita errores de "Payload Too Large" (500/413).
 */
function compressImage(file, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Error cargando imagen'));
      img.src = e.target.result;
      img.onload = () => {
        try {
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
            if (!blob) reject(new Error('Error al comprimir'));
            else resolve(blob);
          }, 'image/jpeg', quality);
        } catch (err) {
          reject(new Error(`Error al comprimir imagen: ${err.message}`));
        }
      };
    };
    reader.readAsDataURL(file);
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
    reader.onerror = () => reject(new Error(`No se pudo codificar la imagen: ${file.name}`));
    reader.readAsDataURL(blob);
  });
}

/**
 * Valida la estructura de respuesta de Gemini antes de intentar parsear.
 * @param {object} result - La respuesta JSON de la API
 * @returns {string} El texto de respuesta
 * @throws {Error} Si la respuesta no tiene la estructura esperada
 */
function extractGeminiResponseText(result) {
  if (!result) {
    throw new Error('La API no devolvió ninguna respuesta.');
  }
  if (!result.candidates || result.candidates.length === 0) {
    const blockReason = result.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`La API bloqueó la solicitud: ${blockReason}. Intenta con otras imágenes.`);
    }
    throw new Error('La API devolvió una respuesta vacía. Intenta de nuevo.');
  }
  const candidate = result.candidates[0];
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`La API terminó con razón: ${candidate.finishReason}. Intenta de nuevo.`);
  }
  if (!candidate.content?.parts?.[0]?.text) {
    throw new Error('La respuesta de la API no contiene texto. Intenta de nuevo.');
  }
  return candidate.content.parts[0].text;
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

    const key = await getApiKey();
    if (!key) throw new Error("API Key de Gemini necesaria para continuar.");
    
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

    
    const body = {
      contents: [{
        parts: [
          { text: GEMINI_PROMPT_ANALYZE },
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
    const responseText = extractGeminiResponseText(result);
    
    // Limpiar el JSON de respuesta (Gemini a veces añade bloques ```json)
    const jsonStr = responseText.replace(/```json|```/g, "").trim();
    
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (parseErr) {
      throw new Error('La IA devolvió una respuesta que no es JSON válido. Intenta de nuevo.');
    }

    // Etapa 4: Listo
    progress('¡Análisis completado!', 100);

    // Adjuntar el modelo usado
    data._modelUsed = GEMINI_MODEL;
    // Asumir 100% de confianza si el análisis fue exitoso
    data.confidence = 100;

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BULK_TIMEOUT_MS);

  try {
    const key = await getApiKey();
    if (!key) throw new Error("API Key de Gemini necesaria para continuar.");

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    
    const body = {
      contents: [{
        parts: [
          { text: GEMINI_PROMPT_BULK },
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

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error ${response.status} en análisis masivo.`);
    }

    const result = await response.json();
    const responseText = extractGeminiResponseText(result);
    const jsonStr = responseText.replace(/```json|```/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      throw new Error('La IA devolvió una respuesta que no es JSON válido. Intenta de nuevo.');
    }

    return parsed;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('El análisis masivo tardó demasiado y fue cancelado. Inténtalo de nuevo.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
