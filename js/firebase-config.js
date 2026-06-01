/**
 * firebase-config.js
 * INSTRUCCIONES DE CONFIGURACIÓN:
 * 1. Ve a Firebase Console > Configuración del proyecto > Tus apps > Web
 * 2. Copia los valores de tu firebaseConfig
 * 3. Reemplaza los valores de PLACEHOLDER abajo
 * 4. En Netlify: agrega las mismas variables como ENV VARS
 *    (opcional, si quieres inyectarlas por CI/CD)
 *
 * NOTA DE SEGURIDAD: La config de Firebase puede ser pública.
 * La seguridad real está en las Firestore Security Rules.
 */

// Initialize Firebase
if (!window.FIREBASE_CONFIG) {
  console.error('ERROR CRÍTICO: FIREBASE_CONFIG no definido. Asegúrate de configurar las variables de entorno.');
} else {
  firebase.initializeApp(window.FIREBASE_CONFIG);
}

// Export service references (used across all pages)
const auth    = window.FIREBASE_CONFIG ? firebase.auth() : null;
const db      = window.FIREBASE_CONFIG ? firebase.firestore() : null;

// Enable offline persistence for Firestore
if (db) {
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence: múltiples pestañas abiertas. Usando sin persistencia.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence no soportada en este navegador.');
    }
  });
}
