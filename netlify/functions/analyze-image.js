/**
 * Netlify Serverless Function — Gemini Vision Proxy
 * Keeps the GEMINI_API_KEY secret (server-side only).
 * Endpoint: POST /api/analyze-image
 */

const PROMPT = `Eres un experto en análisis de equipos electrónicos universitarios.
Analiza las imágenes proporcionadas de dispositivos electrónicos y extrae la siguiente información en formato JSON.

Campos a extraer:
- universitySerial: Serial/código propio de la institución (busca stickers o etiquetas con códigos institucionales, inventario, o activos fijos)
- deviceSerial: Serial del fabricante del dispositivo (busca en la parte trasera o etiquetas del fabricante)
- brand: Marca del dispositivo (Dell, HP, Lenovo, Samsung, LG, Apple, Acer, Asus, Toshiba, etc.)
- type: Tipo de dispositivo. Debe ser uno de: "Computador de Escritorio", "Portátil/Laptop", "Pantalla/Monitor", "All-in-One", "Tablet", "Impresora", "Servidor", "Switch/Router", "Proyector", "Otro"
- specs: Especificaciones técnicas (objeto con los campos siguientes, usa null si no es visible):
  - processor: Procesador (ej: "Intel Core i5-8400")
  - ram: Memoria RAM (ej: "8GB DDR4")
  - storage: Almacenamiento (ej: "256GB SSD")
  - screen: Pantalla (ej: '21.5" Full HD')
  - os: Sistema operativo (ej: "Windows 10 Pro")
  - other: Otras especificaciones relevantes
- status: Estado del dispositivo. Usa "Funcional" si parece operativo, "No Funcional" si muestra daños evidentes, "Desconocido" si no se puede determinar.
- notes: Observaciones adicionales visibles (daños, pegatinas especiales, accesorios, etc.)
- missingFields: Lista de campos importantes que NO pudiste determinar con las imágenes (array de strings)
- clarificationQuestions: Preguntas específicas para obtener los datos faltantes (array de strings en español)
- confidence: Nivel de confianza general del análisis del 0 al 100

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional.
Ejemplo de respuesta:
{
  "universitySerial": "UNIV-2024-001234",
  "deviceSerial": "CN123456789",
  "brand": "HP",
  "type": "Computador de Escritorio",
  "specs": {
    "processor": "Intel Core i5-8400",
    "ram": "8GB DDR4",
    "storage": "1TB HDD",
    "screen": null,
    "os": "Windows 10 Pro",
    "other": null
  },
  "status": "Funcional",
  "notes": "Sticker de inventario visible en el panel frontal.",
  "missingFields": ["deviceSerial"],
  "clarificationQuestions": ["¿Puedes proporcionar el número de serial del fabricante ubicado en la parte trasera del equipo?"],
  "confidence": 85
}`;

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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
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
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Gemini API Error:', errData);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Error de Gemini (${response.status}): ${errData.error?.message || 'Error desconocido'}` }),
      };
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Strip markdown and parse JSON
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const extracted = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extracted),
    };
  } catch (err) {
    console.error('Function Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno en la función: ' + err.message }),
    };
  }
};
