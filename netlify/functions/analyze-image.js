/**
 * Netlify Serverless Function — Gemini Vision Proxy
 * Keeps the GEMINI_API_KEY secret (server-side only).
 * Endpoint: POST /api/analyze-image
 *
 * Fallback strategy (all free-tier):
 *   1. gemini-1.5-flash (reliable, high quota)
 *   2. gemini-1.5-pro (higher reasoning)
 */

const GEMINI_MODELS = [
  'gemini-3.5-flash',
];

const API_VERSION = 'v1'; // Forzado a v1 para modelos estables

const REQUEST_TIMEOUT_MS = 40_000; // 40 s per model attempt

const PROMPT = `Eres un experto en análisis de equipos electrónicos universitarios.
Analiza las imágenes proporcionadas de dispositivos electrónicos y extrae la información requerida.

IMPORTANTE: DEBES RESPONDER ÚNICAMENTE CON UN OBJETO JSON VÁLIDO. NO INCLUYAS TEXTO INTRODUCTORIO, EXPLICACIONES, NI FORMATO MARKDOWN.

Instrucciones de llenado:
- universitySerial: Serial/código propio de la institución (busca stickers o etiquetas con códigos institucionales, inventario, o activos fijos). Usa nulo si no lo ves.
- deviceSerial: Serial del fabricante del dispositivo (busca en la parte trasera o etiquetas del fabricante). Usa nulo si no lo ves.
- brand: Marca del dispositivo (Dell, HP, Lenovo, Samsung, LG, Apple, Acer, Asus, Toshiba, etc.). Usa nulo si no la ves.
- model: Modelo específico del equipo si es visible. Usa nulo si no lo ves.
- type: Tipo de dispositivo. DEBE ser exactamente uno de los valores permitidos.
- specs: Especificaciones técnicas visibles, usa nulo si no las ves.
- status: "Funcional" si parece operativo, "No Funcional" si muestra daños evidentes, "Desconocido" si no se puede determinar.
- notes: Observaciones adicionales visibles (daños, pegatinas especiales, accesorios, etc.).
- missingFields: Lista de los nombres de los campos importantes que NO pudiste determinar con las imágenes.
- clarificationQuestions: Preguntas específicas en español para el usuario para obtener los datos faltantes.
- confidence: Nivel de confianza general del análisis del 0 al 100.

El esquema JSON requerido es:
{
  "universitySerial": "string|null",
  "deviceSerial": "string|null",
  "brand": "string|null",
  "model": "string|null",
  "type": "string|null",
  "specs": {
    "processor": "string|null",
    "ram": "string|null",
    "storage": "string|null",
    "screen": "string|null",
    "os": "string|null",
    "other": "string|null"
  },
  "status": "Funcional|No Funcional|Desconocido",
  "notes": "string|null",
  "missingFields": ["string"],
  "clarificationQuestions": ["string"],
  "confidence": 0
}`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    universitySerial: { type: "STRING", nullable: true },
    deviceSerial: { type: "STRING", nullable: true },
    brand: { type: "STRING", nullable: true },
    model: { type: "STRING", nullable: true },
    type: { 
      type: "STRING", 
      enum: ["Computador de Escritorio", "Portátil/Laptop", "Pantalla/Monitor", "All-in-One", "Tablet", "Impresora", "Servidor", "Switch/Router", "Proyector", "Otro"],
      nullable: true
    },
    specs: {
      type: "OBJECT",
      nullable: true,
      properties: {
        processor: { type: "STRING", nullable: true },
        ram: { type: "STRING", nullable: true },
        storage: { type: "STRING", nullable: true },
        screen: { type: "STRING", nullable: true },
        os: { type: "STRING", nullable: true },
        other: { type: "STRING", nullable: true }
      }
    },
    status: { type: "STRING", enum: ["Funcional", "No Funcional", "Desconocido"] },
    notes: { type: "STRING", nullable: true },
    missingFields: { type: "ARRAY", items: { type: "STRING" }, nullable: true },
    clarificationQuestions: { type: "ARRAY", items: { type: "STRING" }, nullable: true },
    confidence: { type: "INTEGER", nullable: true }
  },
  required: ["status"]
};

/**
 * Calls a single Gemini model with a hard timeout.
 * Returns { ok: true, data } or { ok: false, status, message }.
 */
async function callGeminiModel(modelName, parts, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${API_VERSION}/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        ok: false,
        status: response.status,
        message: errData.error?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // LIMPIEZA AGRESIVA
    // 1. Quitar bloques de markdown
    rawText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // 2. Intentar buscar el primer '{' y el último '}' por si acaso trae texto extra
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      rawText = rawText.substring(start, end + 1);
    }

    let extracted;
    try {
      extracted = JSON.parse(rawText);
    } catch (e) {
      console.error('[analyze-image] Error de parseo JSON. Texto crudo:', rawText);
      return { ok: false, status: 500, message: 'La IA devolvió una respuesta con formato inválido. Revisa la consola del servidor.' };
    }

    return { ok: true, data: extracted };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, status: 504, message: `Tiempo de espera agotado para el modelo ${modelName}.` };
    }
    return { ok: false, status: 500, message: err.message };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Gemini API key no configurada en el servidor.' }),
    };
  }

  let images;
  try {
    ({ images } = JSON.parse(event.body));
    if (!images || !images.length) throw new Error('No images provided');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Cuerpo de solicitud inválido.' }) };
  }

  const parts = [
    { text: PROMPT },
    ...images.map((img) => ({
      inline_data: { mime_type: img.mimeType, data: img.data },
    })),
  ];

  let lastError = null;

  for (const modelName of GEMINI_MODELS) {
    console.log(`[analyze-image] Intentando con modelo: ${modelName}`);
    const result = await callGeminiModel(modelName, parts, GEMINI_API_KEY);

    if (result.ok) {
      console.log(`[analyze-image] Éxito con modelo: ${modelName}`);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Model-Used': modelName,
        },
        body: JSON.stringify(result.data),
      };
    }

    // Don't retry on client errors (4xx except 429)
    if (result.status >= 400 && result.status < 500 && result.status !== 429) {
      console.error(`[analyze-image] Error de cliente con ${modelName}: ${result.message}`);
      return {
        statusCode: result.status,
        body: JSON.stringify({ error: result.message }),
      };
    }

    console.warn(`[analyze-image] Modelo ${modelName} falló (${result.status}): ${result.message}. Probando siguiente...`);
    lastError = result;
  }

  // All models failed
  console.error('[analyze-image] Todos los modelos fallaron:', lastError);
  return {
    statusCode: 502,
    body: JSON.stringify({
      error: `Todos los modelos gratuitos de IA (Gemini 2.5 y 1.5) están saturados o fallaron. Último error: ${lastError?.message || 'Desconocido'}. Por favor, inténtalo de nuevo en unos minutos.`,
    }),
  };
};
