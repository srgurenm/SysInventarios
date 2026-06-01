/**
 * index.js — Lógica de la página de Acceso/Login (index.html)
 */

(function () {
  // Redirect if already logged in
  redirectIfLoggedIn('app.html');

  // GOOGLE SIGN-IN
  window.handleGoogleSignIn = async function () {
    const btn = document.getElementById('btn-google');
    btn.disabled = true;
    btn.style.opacity = '0.7';
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      window.location.href = 'app.html';
    } catch (err) {
      const msgs = {
        'auth/popup-closed-by-user': 'Ventana de Google cerrada. Intenta de nuevo.',
        'auth/popup-blocked': 'El navegador bloqueó el popup. Permite ventanas emergentes.',
        'auth/account-exists-with-different-credential': 'Ya existe una cuenta con ese correo.',
      };
      showToast(msgs[err.code] || err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  };

  // TAB SWITCH
  window.switchTab = function (tab) {
    document.getElementById('panel-login').classList.toggle('active', tab === 'login');
    document.getElementById('panel-register').classList.toggle('active', tab === 'register');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  };

  // TOGGLE PASSWORD
  window.togglePw = function (inputId, btn) {
    const input = document.getElementById(inputId);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.textContent = isText ? '👁️' : '🙈';
  };

  // LOGIN
  window.handleLogin = async function () {
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-pw').value;
    if (!email || !pw) { showToast('Completa todos los campos.', 'warning'); return; }

    const btn = document.getElementById('btn-login');
    btn.classList.add('loading'); btn.disabled = true;
    try {
      await auth.signInWithEmailAndPassword(email, pw);
      window.location.href = 'app.html';
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'No existe cuenta con ese correo.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/invalid-email': 'Correo inválido.',
        'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
      };
      showToast(msgs[err.code] || err.message, 'error');
    } finally {
      btn.classList.remove('loading'); btn.disabled = false;
    }
  };

  // REGISTER
  window.handleRegister = async function () {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pw = document.getElementById('reg-pw').value;
    const pw2 = document.getElementById('reg-pw2').value;

    if (!name || !email || !pw || !pw2) { showToast('Completa todos los campos.', 'warning'); return; }
    if (pw !== pw2) { showToast('Las contraseñas no coinciden.', 'warning'); return; }
    if (pw.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres.', 'warning'); return; }

    const btn = document.getElementById('btn-register');
    btn.classList.add('loading'); btn.disabled = true;
    try {
      const { user } = await auth.createUserWithEmailAndPassword(email, pw);
      await user.updateProfile({ displayName: name });
      window.location.href = 'app.html';
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
        'auth/invalid-email': 'Correo inválido.',
        'auth/weak-password': 'Contraseña demasiado débil.',
      };
      showToast(msgs[err.code] || err.message, 'error');
    } finally {
      btn.classList.remove('loading'); btn.disabled = false;
    }
  };

  // FORGOT PASSWORD
  window.handleForgot = async function () {
    const email = document.getElementById('login-email').value.trim();
    if (!email) { showToast('Escribe tu correo arriba primero.', 'warning'); return; }
    try {
      await auth.sendPasswordResetEmail(email);
      showToast('Email de recuperación enviado. Revisa tu bandeja.', 'success');
    } catch (err) {
      showToast('No se pudo enviar el email.', 'error');
    }
  };

  // ENTER KEY EVENT
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const loginPanel = document.getElementById('panel-login');
    if (loginPanel.classList.contains('active')) handleLogin();
    else handleRegister();
  });
})();
