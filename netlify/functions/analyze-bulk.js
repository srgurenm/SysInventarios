/**
 * Netlify Serverless Function — Gemini Bulk Data Mapper
 * Analyzes messy Excel data and maps it to the SysInventarios schema.
 * Endpoint: POST /api/analyze-bulk
 */

const BULK_PROMPT = `Eres un experto en migración de datos de inventario.
Analiza la siguiente lista de objetos (filas de un archivo Excel) y mapea sus campos a nuestra estructura interna de forma inteligente.

Nuestra estructura objetivo (Schema):
- universitySerial: Serial institucional / placa de inventario.
- deviceSerial: Serial del fabricante (S/N, Serial Number).
- brand: Marca (HP, Dell, Lenovo, LG, etc.).
- model: Modelo comercial (ej: "Latitude 3420", "MacBook Pro", "ThinkCentre M70", etc.).
- type: Tipo de dispositivo. DEBE ser uno de: "Computador de Escritorio", "Portátil/Laptop", "Pantalla/Monitor", "All-in-One", "Tablet", "Impresora", "Servidor", "Switch/Router", "Proyector", "Otro".
- specs: Objeto con (processor, ram, storage, screen, os, other).
- status: "Funcional", "No Funcional" o "Desconocido".
- notes: Observaciones.

Instrucciones:
1. Si una fila tiene nombres de columnas extraños (ej: "S/N" -> deviceSerial, "Marca de equipo" -> brand), haz el mapeo inteligente.
2. Si faltan datos, usa null.
3. Normaliza los tipos de dispositivo a los valores permitidos.
4. Si el estado no es claro, usa "Desconocido".
5. Si encuentras datos técnicos, ponlos en el objeto "specs".

Entrada: Una lista JSON de objetos crudos.
Salida: Una lista JSON de objetos normalizados con la estructura anterior.

Responde ÚNICAMENTE con un array JSON válido, sin markdown ni texto explicativo.`;

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

  // Gemini handles large text well, but let's chunk if it's too much (limit to first 50 rows for safety in free tier)
  const rowsToProcess = data.slice(0, 50);

  const parts = [
    { text: BULK_PROMPT },
    { text: `Aquí están los datos a procesar:\n${JSON.stringify(rowsToProcess, null, 2)}` }
  ];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0, // Deterministic
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { statusCode: response.status, body: JSON.stringify({ error: err.error?.message || 'Error de Gemini' }) };
    }

    const resData = await response.json();
    const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const normalized = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
