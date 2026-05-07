/**
 * firebase-config.js
 * ---------------------------------------------------------
 * INSTRUCCIONES DE CONFIGURACIÓN:
 * 1. Ve a Firebase Console > Configuración del proyecto > Tus apps > Web
 * 2. Copia los valores de tu firebaseConfig
 * 3. Reemplaza los valores de PLACEHOLDER abajo
 * 4. En Netlify: agrega las mismas variables como ENV VARS
 *    (opcional, si quieres inyectarlas por CI/CD)
 *
 * NOTA DE SEGURIDAD: La config de Firebase puede ser pública.
 * La seguridad real está en las Firestore Security Rules.
 * ---------------------------------------------------------
 */

const firebaseConfig = {
  apiKey:            "AIzaSyA93OGMhXmfSkIdnx3Eai8yFbuJiW0bKkc",
  authDomain:        "sysinventarios-beaa1.firebaseapp.com",
  projectId:         "sysinventarios-beaa1",
  storageBucket:     "sysinventarios-beaa1.firebasestorage.app",
  messagingSenderId: "531940530426",
  appId:             "1:531940530426:web:dd1595196bf3ae10efd143",
  measurementId:     "G-1C05WMHNVK"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export service references (used across all pages)
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence for Firestore
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence: múltiples pestañas abiertas. Usando sin persistencia.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence no soportada en este navegador.');
  }
});
