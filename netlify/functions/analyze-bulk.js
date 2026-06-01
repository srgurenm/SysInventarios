/**
 * Netlify Serverless Function — Gemini Bulk Data Mapper
 * Analyzes messy Excel data and maps it to the SysInventarios schema.
 * Endpoint: POST /api/analyze-bulk
 *
 * Fallback strategy:
 *   1. gemini-2.5-flash
 *   2. gemini-1.5-flash
 */

const GEMINI_MODELS = [
  'gemini-3.5-flash',
];

const API_VERSION = 'v1';

const REQUEST_TIMEOUT_MS = 45_000; // 45 s per model attempt

const BULK_PROMPT = `Eres un experto en migración de datos de inventario.
Analiza la siguiente lista de objetos (filas de un archivo Excel) y mapea sus campos a nuestra estructura interna de forma inteligente.

Instrucciones:
1. Si una fila tiene nombres de columnas extraños (ej: "S/N" -> deviceSerial, "Marca de equipo" -> brand), haz el mapeo inteligente.
2. Si faltan datos, usa nulo (null).
3. Normaliza los tipos de dispositivo estrictamente a los valores permitidos del esquema.
4. Si el estado no es claro, usa "Desconocido".
5. Si encuentras datos técnicos en columnas genéricas, ponlos en el objeto "specs" según correspondan.`;

const ROW_SCHEMA = {
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
    notes: { type: "STRING", nullable: true }
  },
  required: ["status"]
};

const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: ROW_SCHEMA
};

async function callGeminiBulk(modelName, parts, apiKey) {
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
            temperature: 0, // Deterministic
            maxOutputTokens: 8192,
            response_mime_type: "application/json",
            response_schema: RESPONSE_SCHEMA
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { ok: false, status: response.status, message: errData.error?.message || `HTTP ${response.status}` };
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    let normalized;
    try {
      normalized = JSON.parse(rawText);
    } catch {
      return { ok: false, status: 500, message: 'La IA devolvió JSON inválido.' };
    }

    return { ok: true, data: normalized };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, status: 504, message: `Tiempo de espera agotado para ${modelName}.` };
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
    return { statusCode: 500, body: JSON.stringify({ error: 'API Key no configurada.' }) };
  }

  let data;
  try {
    const body = JSON.parse(event.body);
    data = body.data;
    if (!data || !Array.isArray(data)) throw new Error('Data must be an array');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Cuerpo inválido.' }) };
  }

  const rowsToProcess = data.slice(0, 50);

  const parts = [
    { text: BULK_PROMPT },
    { text: `Datos crudos a procesar:\n${JSON.stringify(rowsToProcess)}` }
  ];

  let lastError = null;

  for (const modelName of GEMINI_MODELS) {
    console.log(`[analyze-bulk] Intentando con: ${modelName}`);
    const result = await callGeminiBulk(modelName, parts, GEMINI_API_KEY);

    if (result.ok) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Model-Used': modelName
        },
        body: JSON.stringify(result.data),
      };
    }

    if (result.status >= 400 && result.status < 500 && result.status !== 429) {
      return { statusCode: result.status, body: JSON.stringify({ error: result.message }) };
    }

    console.warn(`[analyze-bulk] ${modelName} falló: ${result.message}`);
    lastError = result;
  }

  return {
    statusCode: 502,
    body: JSON.stringify({
      error: `Todos los modelos gratuitos de IA están saturados. Último error: ${lastError?.message}. Por favor, reintenta en unos minutos.`
    }),
  };
};
