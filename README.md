# SysInventarios

> Sistema web de gestión de inventarios de equipos electrónicos universitarios con análisis de imágenes por **Gemini AI**, tiempo real con **Firebase**, y despliegue en **Netlify**.

---

## ✨ Funcionalidades

- 🔐 **Autenticación** con Firebase Auth (Email/Contraseña)
- 📦 **Múltiples inventarios** con contraseña individual
- 🤖 **Análisis por IA** (Gemini 1.5 Pro Vision): sube 1-4 fotos del equipo y extrae datos automáticamente
- ⚡ **Tiempo real**: cambios visibles al instante en todos los usuarios conectados (Firestore `onSnapshot`)
- 🖥️ **Gestión completa**: Serial universitario, serial del dispositivo, marca, tipo, especificaciones técnicas, estado (Funcional / No Funcional), notas
- 📱 **Responsive**: funciona en móvil y escritorio

---

## 🚀 Guía de Configuración (Paso a Paso)

### 1. Configurar Firebase

1. Ve a [firebase.google.com](https://firebase.google.com) → **Consola** → **Agregar proyecto**
2. Nombre: `SysInventarios` → Crear
3. En el menú lateral, habilita:
   - **Authentication** → Email/Contraseña → ✅ Habilitar
   - **Firestore Database** → Crear en **modo de prueba**
   - **Storage** → Iniciar en modo de prueba
4. Ve a ⚙️ **Configuración del proyecto** → **Tus apps** → `</>` (Web)
5. Registra la app y **copia** el objeto `firebaseConfig`

#### Configura las reglas de Firestore (Firestore → Reglas)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /inventories/{inventoryId} {
      allow read, write: if request.auth != null;
      match /devices/{deviceId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

#### Configura las reglas de Storage (Storage → Reglas)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /inventories/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 2. Editar `js/firebase-config.js`

Reemplaza los valores `REEMPLAZA_CON_TU_API_KEY` con los de tu proyecto Firebase.

### 3. Obtener API Key de Gemini

1. Ve a [aistudio.google.com](https://aistudio.google.com) → **Get API Key** → **Create API Key**
2. Copia la clave generada

### 4. Crear repositorio en GitHub

```bash
cd SysInventarios
git init
git add .
git commit -m "feat: initial SysInventarios setup"
```

1. Crea un repo en [github.com](https://github.com) → `SysInventarios`

```bash
git remote add origin https://github.com/srgurenm/SysInventarios
git branch -M main
git push -u origin main
```

### 5. Conectar Netlify

1. Ve a [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project** → GitHub
2. Selecciona el repo `SysInventarios`
3. Configuración de build:
   - **Build command**: (vacío)
   - **Publish directory**: `.`
4. **Variables de entorno** (Site Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `GEMINI_API_KEY` | Tu clave de Google AI Studio |

1. Clic en **Deploy site** → ¡Listo! 🎉

---

## 📁 Estructura del Proyecto

```
SysInventarios/
├── index.html              ← Login / Registro
├── app.html                ← Dashboard de inventarios
├── inventory.html          ← Vista de un inventario
├── add-device.html         ← Agregar/editar equipo con IA
├── css/
│   └── main.css            ← Design system completo
├── js/
│   ├── firebase-config.js  ← ⚠️ Configura aquí tus credenciales Firebase
│   ├── auth.js             ← Helpers de autenticación
│   ├── db.js               ← CRUD Firestore
│   ├── storage.js          ← Upload de imágenes
│   ├── gemini.js           ← Integración Gemini Vision
│   └── ui.js               ← Toasts, modales, utilidades
├── netlify/
│   └── functions/
│       └── analyze-image.js ← Proxy seguro para Gemini API
├── netlify.toml            ← Configuración Netlify
└── .env.example            ← Variables de entorno (referencia)
```

---

## 🛠️ Desarrollo Local

Para probar localmente con Netlify Functions:

```bash
npm install -g netlify-cli
netlify dev
```

Abre `http://localhost:8888`

---

## 📊 Modelo de Datos

```
/inventories/{id}
  name, description, passwordHash, deviceCount, createdBy, createdAt, updatedAt

/inventories/{id}/devices/{id}
  universitySerial, deviceSerial, brand, type
  specs: { processor, ram, storage, screen, os, other }
  status: "Funcional" | "No Funcional" | "Desconocido"
  notes, imageUrls[], extractedByAI, createdBy, createdAt, updatedAt
```
