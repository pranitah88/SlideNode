import { auth } from './auth';
import { initSpotlightBackground } from './spotlight';

export async function initNavbarControls() {
  initSpotlightBackground();
  const container = document.getElementById('global-navbar-controls');
  if (!container) return;

  const defaultAvatar = `https://ui-avatars.com/api/?name=User&background=004AC6&color=fff`;

  container.innerHTML = `
    <!-- Help & Support Button (?) -->
    <button id="nav-btn-help" class="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-full transition-colors relative" title="Help & Support">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>
    </button>

    <!-- Profile Avatar Dropdown Target -->
    <div class="relative">
      <button id="nav-btn-profile" class="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant cursor-pointer hover:opacity-80 transition-opacity focus:outline-none">
        <img id="nav-avatar-img" src="${defaultAvatar}" class="w-full h-full object-cover" alt="User avatar">
      </button>

      <!-- Profile Dropdown Popover -->
      <div id="nav-profile-popover" class="hidden absolute right-0 mt-2 w-64 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xl z-50 p-2 text-sm text-on-surface">
        <div class="p-3 border-b border-outline-variant/60">
          <p id="nav-user-name" class="font-bold text-on-surface truncate">User</p>
          <p id="nav-user-email" class="text-xs text-on-surface-variant truncate">user@company.com</p>
        </div>
        <div class="py-1">
          <a href="profile.html" class="flex items-center px-3 py-2 rounded-xl text-xs font-medium text-on-surface hover:bg-primary-fixed hover:text-primary transition-colors">Edit Profile</a>
        </div>
        <div class="pt-1 border-t border-outline-variant/60">
          <button id="nav-btn-logout" class="w-full text-left flex items-center px-3 py-2 rounded-xl text-xs font-medium text-error hover:bg-error/10 transition-colors">Log Out</button>
        </div>
      </div>
    </div>
  `;

  // Asynchronously populate profile details
  auth.getUserProfile().then(profile => {
    if (!profile) return;
    const nameEl = document.getElementById('nav-user-name');
    const emailEl = document.getElementById('nav-user-email');
    const imgEl = document.getElementById('nav-avatar-img') as HTMLImageElement;
    if (nameEl) nameEl.textContent = profile.full_name || 'User';
    if (emailEl) emailEl.textContent = profile.email || 'user@company.com';
    if (imgEl && profile.avatar_url) imgEl.src = profile.avatar_url;
  }).catch(e => console.warn('[NAVBAR] Profile fetch warning:', e));

  // Profile Popover Toggle
  const btnProfile = document.getElementById('nav-btn-profile');
  const popoverProfile = document.getElementById('nav-profile-popover');
  const btnLogout = document.getElementById('nav-btn-logout');

  if (btnProfile && popoverProfile) {
    btnProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      popoverProfile.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!popoverProfile.contains(e.target as Node) && e.target !== btnProfile) {
        popoverProfile.classList.add('hidden');
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await auth.signOut();
    });
  }

  // Help Modal Setup
  const btnHelp = document.getElementById('nav-btn-help');
  if (btnHelp) {
    btnHelp.addEventListener('click', () => openHelpModal());
  }
}

// Help & Support Modal Handler
function openHelpModal() {
  let modal = document.getElementById('help-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'help-modal';
    modal.className = 'fixed inset-0 bg-on-surface/60 backdrop-blur-md z-50 flex items-center justify-center p-6';
    modal.innerHTML = `
      <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        <div class="flex justify-between items-center border-b border-outline-variant/60 pb-3">
          <h3 class="font-display text-xl font-bold text-on-surface flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-primary"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg> Help & Support
          </h3>
          <button id="btn-close-help" class="text-on-surface-variant hover:text-on-surface p-1 rounded-lg cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div class="space-y-4 text-xs text-on-surface-variant max-h-96 overflow-y-auto pr-1">
          <div>
            <h4 class="font-bold text-on-surface text-sm mb-1 text-primary">1. Getting Started</h4>
            <p>Upload meeting audio files (.mp3, .wav, .m4a, .webm), let Google Gemini transcribe the conversation, and receive an instant presentation deck with speaker breakdowns and action items.</p>
          </div>
          <div>
            <h4 class="font-bold text-on-surface text-sm mb-1 text-primary">2. PPT Deck Generation & AI Edits</h4>
            <p>Slides are rendered in professional consulting style. Use the "Modify Presentation" tab to type custom prompts (e.g. "Add SWOT analysis", "Add financial summary slide").</p>
          </div>
          <div>
            <h4 class="font-bold text-on-surface text-sm mb-1 text-primary">3. Exports & Downloads</h4>
            <p>Download your presentation as a native Microsoft PowerPoint (.pptx) file or export the full verbatim meeting transcript as a Word (.docx) document.</p>
          </div>
          <div>
            <h4 class="font-bold text-on-surface text-sm mb-1 text-primary">4. Account & Version Control</h4>
            <p>Manage your profile, full name, and restore any previous version using the Version History manager in the dashboard.</p>
          </div>
        </div>

        <div class="pt-3 border-t border-outline-variant/60 flex justify-between items-center">
          <a href="mailto:support@slidenode.ai" class="bg-primary text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-primary-container transition-all flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Contact Support
          </a>
          <button id="btn-close-help-footer" class="bg-surface-container-low hover:bg-surface-container border border-outline-variant text-on-surface px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
            Close
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn1 = document.getElementById('btn-close-help');
    const closeBtn2 = document.getElementById('btn-close-help-footer');
    if (closeBtn1) closeBtn1.addEventListener('click', () => modal?.remove());
    if (closeBtn2) closeBtn2.addEventListener('click', () => modal?.remove());
  }
}
