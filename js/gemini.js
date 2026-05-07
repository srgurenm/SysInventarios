/**
 * gemini.js — Integración con Gemini Vision via Netlify Function
 * Convierte imágenes a base64 y llama al proxy seguro.
 */

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
  const blob = file.size > 800 * 1024 ? await compressImage(file) : file;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
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
