/**
 * auth.js — Helpers de autenticación Firebase
 */

async function loginUser(email, password) {
  try {
    return await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    throw error;
  }
}

async function registerUser(email, password, displayName) {
  try {
    const { user } = await auth.createUserWithEmailAndPassword(email, password);
    await user.updateProfile({ displayName });
    return user;
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    throw error;
  }
}

async function logoutUser() {
  try {
    return await auth.signOut();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    throw error;
  }
}

async function sendPasswordReset(email) {
  try {
    return await auth.sendPasswordResetEmail(email);
  } catch (error) {
    console.error('Error al enviar restablecimiento de contraseña:', error);
    throw error;
  }
}

function getCurrentUser() {
  return auth ? auth.currentUser : null;
}
