import { auth } from '../services/auth';
import { initSpotlightBackground } from '../services/spotlight';

document.addEventListener('DOMContentLoaded', async () => {
  initSpotlightBackground();
  // Guard check: if already logged in, redirect to dashboard
  await auth.initAuthGuard(false);

  const form = document.getElementById('form-signup') as HTMLFormElement;
  const fullNameInput = document.getElementById('signup-fullname') as HTMLInputElement;
  const emailInput = document.getElementById('signup-email') as HTMLInputElement;
  const passwordInput = document.getElementById('signup-password') as HTMLInputElement;
  const confirmPasswordInput = document.getElementById('signup-confirm-password') as HTMLInputElement;
  const submitBtn = document.getElementById('btn-signup-submit') as HTMLButtonElement;
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

      const fullName = fullNameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (!fullName || !email || !password || !confirmPassword) {
        showError("Please complete all required fields.");
        return;
      }

      if (password.length < 8) {
        showError("Password must be at least 8 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        showError("Passwords do not match. Please re-enter.");
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span> Creating Account...';
        }

        const res = await auth.signUp(email, password, fullName);

        if (!res.success) {
          showError(res.error || "Failed to create account. Please try again.");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Create Account</span><span class="material-symbols-outlined text-base">arrow_forward</span>';
          }
          return;
        }

        // Account created & profile persisted — redirect to Home page
        window.location.replace('index.html');

      } catch (err: any) {
        console.error("Signup submit error:", err);
        showError("Unable to connect. Please try again.");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Create Account</span><span class="material-symbols-outlined text-base">arrow_forward</span>';
        }
      }
    });
  }
});
