/**
 * gemini.js — Integración con Gemini Vision via Netlify Function
 * Convierte imágenes a base64 y llama al proxy seguro.
 */

/**
 * Convierte un File a objeto { mimeType, data (base64) }
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // strip data:mime;base64,
      resolve({ mimeType: file.type, data: base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Analiza un array de File objects con Gemini Vision.
 * Retorna los datos extraídos del dispositivo.
 *
 * @param {File[]} files - Entre 1 y 4 imágenes
 * @returns {Promise<object>} Datos extraídos
 */
async function analyzeImagesWithGemini(files) {
  if (!files || files.length === 0) throw new Error('Debes seleccionar al menos una imagen.');
  if (files.length > 4) throw new Error('Máximo 4 imágenes permitidas.');

  // Validate file types
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  for (const f of files) {
    if (!allowed.includes(f.type)) {
      throw new Error(`Formato no soportado: ${f.name}. Usa JPG, PNG o WebP.`);
    }
    if (f.size > 8 * 1024 * 1024) { // 8MB per image limit for Gemini
      throw new Error(`La imagen ${f.name} supera el límite de 8MB.`);
    }
  }

  const images = await Promise.all(files.map(fileToBase64));

  const response = await fetch('/api/analyze-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error ${response.status} al contactar Gemini.`);
  }

  return response.json();
}

/**
 * Genera preguntas de seguimiento si hay campos faltantes.
 * Retorna un array de strings (preguntas).
 */
function buildFollowUpQuestions(extracted) {
  const questions = extracted.clarificationQuestions || [];
  const missing   = extracted.missingFields || [];

  const fieldLabels = {
    universitySerial: 'Serial Universitario',
    deviceSerial:     'Serial del Fabricante',
    brand:            'Marca',
    type:             'Tipo de Dispositivo',
    'specs.processor':'Procesador',
    'specs.ram':      'Memoria RAM',
    'specs.storage':  'Almacenamiento',
    'specs.screen':   'Pantalla',
    'specs.os':       'Sistema Operativo',
  };

  const extra = missing
    .filter(f => !questions.some(q => q.toLowerCase().includes(fieldLabels[f]?.toLowerCase() || '')))
    .map(f => `¿Puedes indicar el campo "${fieldLabels[f] || f}"?`);

  return [...questions, ...extra];
}
