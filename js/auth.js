/**
 * auth.js — Helpers de autenticación Firebase
 */

async function loginUser(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

async function registerUser(email, password, displayName) {
  const { user } = await auth.createUserWithEmailAndPassword(email, password);
  await user.updateProfile({ displayName });
  return user;
}

async function logoutUser() {
  return auth.signOut();
}

async function sendPasswordReset(email) {
  return auth.sendPasswordResetEmail(email);
}

function getCurrentUser() {
  return auth.currentUser;
}
