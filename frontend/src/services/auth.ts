
import { supabase } from './supabase';
import { fetchOnChainBalances, refreshWalletBalances } from './algorand';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserWallet {
  id?: string;
  user_id: string;
  address: string;
  network: string;
  algo_balance?: string;
  usdc_balance?: string;
}

// Helper for minimal loading overlay during initial auth check
function showAuthLoadingOverlay() {
  if (typeof document === 'undefined') return;
  let overlay = document.getElementById('auth-loading-overlay');
  if (!overlay && document.body) {
    overlay = document.createElement('div');
    overlay.id = 'auth-loading-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:#f8f9fa;z-index:99999;display:flex;align-items:center;justify-content:center;transition:opacity 0.2s ease;';
    overlay.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;font-family:Inter,sans-serif;">
        <div style="width:32px;height:32px;border:3px solid #004ac6;border-top-color:transparent;border-radius:50%;animation:authSpin 0.8s linear infinite;"></div>
        <span style="font-size:13px;font-weight:600;color:#004ac6;">Loading SlideNode...</span>
      </div>
      <style>@keyframes authSpin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);
  }
}

function hideAuthLoadingOverlay() {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('auth-loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 200);
  }
}

export const auth = {
  // Get authorization headers containing Bearer session token
  getAuthHeaders: async (): Promise<Record<string, string>> => {
    const session = await auth.getSession();
    if (session?.access_token) {
      return { 'Authorization': `Bearer ${session.access_token}` };
    }
    return {};
  },

  // Sign up new user with email, password, and full name
  signUp: async (email: string, password: string, fullName: string): Promise<{ success: boolean; user?: any; error?: string }> => {
    try {
      // 1. Attempt client-side Supabase signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (!error && data?.user) {
        const user = data.user;
        const initialsAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=004AC6&color=fff`;
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: fullName,
          email: email,
          avatar_url: initialsAvatar,
          updated_at: new Date().toISOString()
        });

        await supabase.from('wallets').upsert({
          user_id: user.id,
          address: 'NOT_SET',
          network: 'Algorand Testnet',
          updated_at: new Date().toISOString()
        });

        if (data.session) {
          localStorage.setItem('slidenode_session', JSON.stringify(data.session));
          return { success: true, user };
        }

        // If client signUp succeeded but session is missing, attempt auto sign-in
        const signInRes = await supabase.auth.signInWithPassword({ email, password });
        if (signInRes.data?.session) {
          localStorage.setItem('slidenode_session', JSON.stringify(signInRes.data.session));
          return { success: true, user: signInRes.data.user };
        }
      }

      // If already registered error, return clean message
      if (error && (error.message.includes('already registered') || error.message.includes('already exists'))) {
        return { success: false, error: 'An account with this email already exists.' };
      }

      return await auth.signUpBackendFallback(email, password, fullName);

    } catch (err: any) {
      console.error("signUp exception:", err);
      return { success: false, error: 'Unable to connect. Please check your internet connection.' };
    }
  },

  signUpBackendFallback: async (email: string, password: string, fullName: string) => {
    console.warn("Using backend auth API for guaranteed account creation...");
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName })
    });

    const resData = await response.json();
    if (!resData.success) {
      return { success: false, error: resData.error || 'Unable to create account. Please try again.' };
    }

    if (resData.session) {
      localStorage.setItem('slidenode_session', JSON.stringify(resData.session));
      try {
        await supabase.auth.setSession({
          access_token: resData.session.access_token,
          refresh_token: resData.session.refresh_token
        });
      } catch (e) {
        // SDK setSession error ignored if localStorage fallback is saved
      }
    }

    return { success: true, user: resData.user };
  },

  // Sign in with email & password
  signIn: async (email: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> => {
    try {
      // 1. Attempt client-side Supabase signin
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (!error && data?.user && data?.session) {
        localStorage.setItem('slidenode_session', JSON.stringify(data.session));
        return { success: true, user: data.user };
      }

      console.warn("Client signIn fallback to backend auth API...", error?.message);

      // 2. Fallback to backend Auth endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const resData = await response.json();
      if (!resData.success) {
        return { success: false, error: resData.error || 'Email or password is incorrect.' };
      }

      if (resData.session) {
        localStorage.setItem('slidenode_session', JSON.stringify(resData.session));
        try {
          await supabase.auth.setSession({
            access_token: resData.session.access_token,
            refresh_token: resData.session.refresh_token
          });
        } catch (e) {
          // SDK setSession error ignored
        }
      }

      return { success: true, user: resData.user };

    } catch (err: any) {
      console.error("signIn exception:", err);
      return { success: false, error: 'Unable to connect. Please check your internet connection.' };
    }
  },

  // Sign out user and clear state
  signOut: async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("signOut error:", err);
    } finally {
      localStorage.removeItem('slidenode_session');
      window.location.replace('login.html');
    }
  },

  // Send password reset email
  resetPassword: async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const resData = await response.json();
      if (!resData.success) {
        return { success: false, error: resData.error || 'Failed to send reset link.' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send reset link.' };
    }
  },

  // Get active session with localStorage fallback
  getSession: async (): Promise<any> => {
    // Check localStorage fallback
    const localSessionStr = localStorage.getItem('slidenode_session');
    let localSession: any = null;
    if (localSessionStr) {
      try {
        localSession = JSON.parse(localSessionStr);
        if (localSession?.expires_at && localSession.expires_at * 1000 < Date.now()) {
          localSession = null;
          localStorage.removeItem('slidenode_session');
        }
      } catch (e) {
        localSession = null;
      }
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        localStorage.setItem('slidenode_session', JSON.stringify(data.session));
        return data.session;
      }
    } catch (e) {
      // SDK getSession error ignored
    }

    if (localSession) {
      return localSession;
    }

    return new Promise((resolve) => {
      let resolved = false;
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!resolved) {
          resolved = true;
          listener?.subscription?.unsubscribe();
          if (session) {
            localStorage.setItem('slidenode_session', JSON.stringify(session));
          }
          resolve(session || null);
        }
      });

      setTimeout(async () => {
        if (!resolved) {
          resolved = true;
          listener?.subscription?.unsubscribe();
          try {
            const { data: reCheck } = await supabase.auth.getSession();
            if (reCheck?.session) {
              localStorage.setItem('slidenode_session', JSON.stringify(reCheck.session));
              resolve(reCheck.session);
              return;
            }
          } catch (e) {}
          resolve(null);
        }
      }, 300);
    });
  },

  // Get current authenticated user
  getCurrentUser: async () => {
    const session = await auth.getSession();
    return session?.user || null;
  },

  // Get user profile from backend API (or Auth metadata)
  getUserProfile: async (): Promise<UserProfile | null> => {
    const user = await auth.getCurrentUser();
    if (!user) return null;

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email })
      });

      const resData = await response.json();
      if (resData.success && resData.profile) {
        return resData.profile as UserProfile;
      }
    } catch (e) {
      console.warn("Backend getUserProfile warning:", e);
    }

    // Fallback profile object from Auth metadata
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    return {
      id: user.id,
      full_name: name,
      email: user.email || '',
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=004AC6&color=fff`,
      created_at: user.created_at
    };
  },

  // Update profile full_name or avatar_url
  updateProfile: async (updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    const user = await auth.getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          full_name: updates.full_name,
          avatar_url: updates.avatar_url
        })
      });

      const resData = await response.json();
      if (!resData.success) {
        return { success: false, error: resData.error || 'Failed to update profile.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile.' };
    }
  },

  // Upload avatar to profile
  uploadAvatar: async (file: File): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
    const user = await auth.getCurrentUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      await auth.updateProfile({ avatar_url: dataUrl });
      return { success: true, publicUrl: dataUrl };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to upload avatar.' };
    }
  },

  // Get user wallet info with real on-chain balance query
  getUserWallet: async (forceRefresh: boolean = false): Promise<UserWallet | null> => {
    const user = await auth.getCurrentUser();
    if (!user) return null;

    let address = '';
    let network = 'Algorand Testnet';

    // 0. Priority 1: Check if user saved a custom wallet address locally
    if (typeof localStorage !== 'undefined') {
      const savedLocal = localStorage.getItem('slidenode_custom_wallet');
      if (savedLocal && savedLocal.length >= 32) {
        address = savedLocal;
        console.log('[WALLET] getUserWallet: custom user address from localStorage:', address);
      }
    }

    // 1. Priority 2: check if user has set a custom wallet address in Supabase
    if (!address) {
      try {
        const { data } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (data?.address && data.address !== 'NOT_SET' && data.address !== 'SHATJ64UNTP4ROCYV4YW4YZVNLR66ZTNZ3LZMNXXRCREPIZHGX5ZYR25GU') {
          address = data.address;
          if (data.network) network = data.network;
          console.log('[WALLET] getUserWallet: custom user address from Supabase:', address);
        }
      } catch (e) {}
    }

    // 2. Fallback: fetch default signer address from backend (/api/test/sign)
    if (!address) {
      try {
        const res = await fetch('/api/test/sign');
        const data = await res.json();
        if (data?.address) {
          address = data.address;
          console.log('[WALLET] getUserWallet: fallback signer address from backend:', address);
        }
      } catch (e) {
        console.warn('[WALLET] Could not fetch signer address from backend:', e);
      }
    }

    if (!address) {
      console.warn('[WALLET] No valid wallet address found — balance will show Loading');
      return {
        user_id: user.id,
        address: '',
        network,
        algo_balance: 'Loading...',
        usdc_balance: 'Loading...'
      };
    }

    const balances = forceRefresh
      ? await refreshWalletBalances(address)
      : await fetchOnChainBalances(address, false);

    return {
      user_id: user.id,
      address: address,
      network: network,
      algo_balance: balances.algoBalanceStr,
      usdc_balance: balances.usdcBalanceStr
    };
  },

  // Update connected wallet address
  updateUserWalletAddress: async (newAddress: string): Promise<{ success: boolean; wallet?: UserWallet; error?: string }> => {
    const cleanAddr = newAddress.trim();
    if (cleanAddr.length < 32) {
      return { success: false, error: 'Invalid Algorand wallet address' };
    }

    // Always store custom address in localStorage so it persists reliably
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('slidenode_custom_wallet', cleanAddr);
    }
    setConnectedPeraAddress(cleanAddr);

    try {
      const user = await auth.getCurrentUser();
      if (user) {
        await supabase.from('wallets').upsert({
          user_id: user.id,
          address: cleanAddr,
          network: 'Algorand Testnet',
          updated_at: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.warn('[WALLET] Supabase upsert warning:', err);
    }

    const balances = await refreshWalletBalances(cleanAddr);

    return {
      success: true,
      wallet: {
        user_id: 'local',
        address: cleanAddr,
        network: 'Algorand Testnet',
        algo_balance: balances.algoBalanceStr,
        usdc_balance: balances.usdcBalanceStr
      }
    };
  },

  // Route protection guard
  initAuthGuard: async (isProtectedRoute: boolean = false): Promise<any> => {
    showAuthLoadingOverlay();
    try {
      const session = await auth.getSession();
      const currentPath = window.location.pathname.toLowerCase();

      const isAuthPage = currentPath.endsWith('login.html') ||
                         currentPath.endsWith('signup.html') ||
                         currentPath.endsWith('/login') ||
                         currentPath.endsWith('/signup') ||
                         currentPath.includes('/login.') ||
                         currentPath.includes('/signup.');

      if (isAuthPage) {
        if (session) {
          console.log("Authenticated user on auth page. Redirecting to index.html...");
          window.location.replace('index.html');
          return session.user;
        }
        hideAuthLoadingOverlay();
        return null;
      }

      if (isProtectedRoute && !session) {
        console.warn("Unauthenticated access to protected route. Redirecting to login.html...");
        window.location.replace('login.html');
        return null;
      }

      hideAuthLoadingOverlay();
      return session?.user || null;
    } catch (err) {
      hideAuthLoadingOverlay();
      if (isProtectedRoute) {
        window.location.replace('login.html');
      }
      return null;
    }
  }
};

// Global Supabase auth listener
supabase.auth.onAuthStateChange((event, session) => {
  const currentPath = window.location.pathname.toLowerCase();
  const isAuthPage = currentPath.includes('login') || currentPath.includes('signup');

  if (event === 'SIGNED_IN' && session) {
    localStorage.setItem('slidenode_session', JSON.stringify(session));
    if (isAuthPage) {
      console.log("[GlobalAuthListener] SIGNED_IN on auth page -> Redirecting to index.html");
      window.location.replace('index.html');
    }
  } else if (event === 'SIGNED_OUT') {
    localStorage.removeItem('slidenode_session');
    if (!isAuthPage) {
      console.log("[GlobalAuthListener] SIGNED_OUT on protected page -> Redirecting to login.html");
      window.location.replace('login.html');
    }
  }
});


