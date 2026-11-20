import { auth } from '../services/auth';
import { initSpotlightBackground } from '../services/spotlight';

document.addEventListener('DOMContentLoaded', async () => {
  initSpotlightBackground();
  // Guard check: route is protected, redirect to login if unauthenticated
  const user = await auth.initAuthGuard(true);
  if (!user) return;

  const displayName = document.getElementById('profile-display-name');
  const displayEmail = document.getElementById('profile-display-email');
  const memberSince = document.getElementById('profile-member-since');
  const avatarImg = document.getElementById('profile-avatar-img') as HTMLImageElement;
  const fullNameInput = document.getElementById('edit-full-name') as HTMLInputElement;
  const emailInput = document.getElementById('edit-email') as HTMLInputElement;

  const formEdit = document.getElementById('form-edit-profile') as HTMLFormElement;
  const avatarFileInput = document.getElementById('avatar-file-input') as HTMLInputElement;
  const btnSave = document.getElementById('btn-save-profile') as HTMLButtonElement;
  const btnLogout = document.getElementById('btn-logout-profile') as HTMLButtonElement;
  const btnChangePassword = document.getElementById('btn-change-password') as HTMLButtonElement;

  // Toast Helper
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `${type === 'success' ? 'bg-success text-white' : 'bg-error text-white'} px-4 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 pointer-events-auto transition-all`;
    toast.innerHTML = `<span class="material-symbols-outlined text-base">${type === 'success' ? 'check_circle' : 'error'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // Load User Profile Data
  async function loadProfile() {
    const profile = await auth.getUserProfile();
    if (!profile) return;

    if (displayName) displayName.textContent = profile.full_name || 'User';
    if (displayEmail) displayEmail.textContent = profile.email || '';
    if (fullNameInput) fullNameInput.value = profile.full_name || '';
    if (emailInput) emailInput.value = profile.email || '';
    if (memberSince) {
      const date = profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '2026';
      memberSince.textContent = `Member since ${date}`;
    }

    if (avatarImg) {
      avatarImg.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'User')}&background=004AC6&color=fff`;
    }
  }

  // File Upload Handler (Avatar Image)
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', async () => {
      const file = avatarFileInput.files?.[0];
      if (!file) return;

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showToast('Please select a JPG, PNG, or WEBP image file.', 'error');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast('Image file size must be less than 5MB.', 'error');
        return;
      }

      try {
        if (avatarImg) avatarImg.style.opacity = '0.5';
        const res = await auth.uploadAvatar(file);

        if (!res.success || !res.publicUrl) {
          showToast(res.error || 'Failed to upload avatar.', 'error');
          return;
        }

        if (avatarImg) {
          avatarImg.src = res.publicUrl;
          avatarImg.style.opacity = '1';
        }

        showToast('Profile photo updated successfully!', 'success');
        await loadProfile();

      } catch (err: any) {
        console.error("Avatar upload error:", err);
        showToast('Failed to upload avatar.', 'error');
      } finally {
        if (avatarImg) avatarImg.style.opacity = '1';
      }
    });
  }

  // Profile Edit Form Submit Handler
  if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newName = fullNameInput.value.trim();
      if (!newName) return;

      try {
        if (btnSave) {
          btnSave.disabled = true;
          btnSave.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">sync</span> Saving...';
        }

        const res = await auth.updateProfile({ full_name: newName });
        if (!res.success) {
          showToast(res.error || 'Failed to update profile.', 'error');
          return;
        }

        showToast('Profile updated successfully!', 'success');
        await loadProfile();

      } catch (err: any) {
        console.error("Update profile error:", err);
        showToast('Failed to update profile.', 'error');
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = '<span class="material-symbols-outlined text-base">save</span> Save Profile';
        }
      }
    });
  }

  // Change Password Handler
  if (btnChangePassword) {
    btnChangePassword.addEventListener('click', async () => {
      const email = emailInput.value;
      if (!email) return;
      const res = await auth.resetPassword(email);
      if (res.success) {
        showToast('Password reset link sent to your email address.', 'success');
      } else {
        showToast(res.error || 'Failed to send reset link.', 'error');
      }
    });
  }

  // Logout Handler
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await auth.signOut();
    });
  }

  await loadProfile();
});
