const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testText() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

  try {
    const result = await model.generateContent("Hola, esto es una prueba de texto.");
    console.log("Respuesta de la IA:", result.response.text());
  } catch (error) {
    console.error("Error en prueba de texto:", error);
  }
}

testText();
