# SysInventarios

> Sistema web de gestión de inventarios de equipos electrónicos universitarios con análisis de imágenes por **Gemini AI**, tiempo real con **Firebase**, y despliegue en **Netlify**.


## ✨ Funcionalidades

- 🔐 **Autenticación** con Firebase Auth (Email/Contraseña)
- 📦 **Múltiples inventarios** con contraseña individual
- 🤖 **Análisis por IA** (Gemini 1.5 Pro Vision): sube 1-4 fotos del equipo y extrae datos automáticamente
- ⚡ **Tiempo real**: cambios visibles al instante en todos los usuarios conectados (Firestore `onSnapshot`)
- 🖥️ **Gestión completa**: Serial universitario, serial del dispositivo, marca, tipo, especificaciones técnicas, estado (Funcional / No Funcional), notas
- 📱 **Responsive**: funciona en móvil y escritorio
