import { auth } from '../services/auth';
import { initSpotlightBackground } from '../services/spotlight';

document.addEventListener('DOMContentLoaded', async () => {
  initSpotlightBackground();
  // Check auth session: if logged in, skip login page
  await auth.initAuthGuard(false);

  const form = document.getElementById('form-login') as HTMLFormElement;
  const emailInput = document.getElementById('login-email') as HTMLInputElement;
  const passwordInput = document.getElementById('login-password') as HTMLInputElement;
  const submitBtn = document.getElementById('btn-login-submit') as HTMLButtonElement;
  const errorBox = document.getElementById('auth-error-box');
  const errorText = document.getElementById('auth-error-text');

  function showError(msg: string) {
    if (errorText) errorText.textContent = msg;
    if (errorBox) errorBox.classList.remove('hidden');
  }

  function hideError() {
    if (errorBox) errorBox.classList.add('hidden');
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showError("Please enter your email and password.");
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span> Logging in...';
        }

        const res = await auth.signIn(email, password);

        if (!res.success) {
          showError(res.error || "Email or password is incorrect.");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Log In</span><span class="material-symbols-outlined text-base">arrow_forward</span>';
          }
          return;
        }

        // Success redirect to Home page
        window.location.replace('index.html');

      } catch (err: any) {
        console.error("Login submit error:", err);
        showError("Unable to connect. Please try again.");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Log In</span><span class="material-symbols-outlined text-base">arrow_forward</span>';
        }
      }
    });
  }
});
