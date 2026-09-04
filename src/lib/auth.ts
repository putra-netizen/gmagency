/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AuthUser {
  username: string;
  role: 'admin' | 'adminshp' | 'finance' | 'worker';
  name: string;
  slot?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
  retryAfterSeconds?: number;
}

const TOKEN_KEY = 'gm_auth_token';
const USER_KEY = 'gm_auth_user';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export function saveAuthSession(token: string, user: AuthUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));

    // Synchronize legacy flags for smooth component transition
    if (user.role === 'admin') {
      localStorage.setItem('gm_admin_auth', 'true');
      sessionStorage.setItem('gm_admin_auth', 'true');
    } else if (user.role === 'adminshp') {
      localStorage.setItem('gm_adminshp_auth', 'true');
      sessionStorage.setItem('gm_adminshp_auth', 'true');
      if (user.slot) {
        localStorage.setItem(`gm_adminshp_auth_${user.slot}`, 'true');
        localStorage.setItem('gm_adminshp_user', user.slot);
        sessionStorage.setItem('gm_adminshp_user', user.slot);
      }
    } else if (user.role === 'finance') {
      localStorage.setItem('gm_finance_device_auth', 'true');
    } else if (user.role === 'worker') {
      sessionStorage.setItem('gm_worker_auth', user.username);
    }

    window.dispatchEvent(new Event('gm_auth_changed'));
  } catch (err) {
    console.error('Failed to save auth session:', err);
  }
}

export function clearAuthSession(role?: 'admin' | 'adminshp' | 'finance' | 'worker') {
  try {
    if (!role || getAuthUser()?.role === role) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    }

    if (!role || role === 'admin') {
      localStorage.removeItem('gm_admin_auth');
      sessionStorage.removeItem('gm_admin_auth');
    }
    if (!role || role === 'adminshp') {
      localStorage.removeItem('gm_adminshp_auth');
      sessionStorage.removeItem('gm_adminshp_auth');
      localStorage.removeItem('gm_adminshp_user');
      sessionStorage.removeItem('gm_adminshp_user');
      ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4'].forEach((s) => {
        localStorage.removeItem(`gm_adminshp_auth_${s}`);
      });
    }
    if (!role || role === 'finance') {
      localStorage.removeItem('gm_finance_device_auth');
      localStorage.removeItem('gm_finance_pin');
      localStorage.removeItem('gm_finance_auth_time');
    }
    if (!role || role === 'worker') {
      sessionStorage.removeItem('gm_worker_auth');
    }

    window.dispatchEvent(new Event('gm_auth_changed'));
  } catch (err) {
    console.error('Failed to clear auth session:', err);
  }
}

export const clientLogout = clearAuthSession;

/**
 * Backend-verified login
 * Calls POST /api/auth/login
 */
export async function loginWithBackend(
  credentialsOrUsername:
    | string
    | {
        username?: string;
        password?: string;
        pin?: string;
      },
  optionalPassword?: string
): Promise<LoginResponse> {
  let credentials: { username?: string; password?: string; pin?: string } = {};
  if (typeof credentialsOrUsername === 'string') {
    credentials = {
      username: credentialsOrUsername,
      password: optionalPassword,
    };
  } else {
    credentials = credentialsOrUsername || {};
  }
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Login gagal. Periksa username dan password Anda.',
        retryAfterSeconds: data.retryAfterSeconds,
      };
    }

    if (data.token && data.user) {
      saveAuthSession(data.token, data.user);
      return {
        success: true,
        token: data.token,
        user: data.user,
      };
    }

    return { success: false, error: 'Respons login server tidak valid.' };
  } catch (err: any) {
    console.error('Network error during login:', err);
    return {
      success: false,
      error: 'Tidak dapat terhubung ke server. Pastikan koneksi internet aktif.',
    };
  }
}

/**
 * Verify current session with server GET /api/auth/me
 */
export async function verifyCurrentSession(): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) {
    clearAuthSession();
    return null;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      clearAuthSession();
      return null;
    }

    const data = await res.json();
    if (data.valid && data.user) {
      return data.user;
    }

    clearAuthSession();
    return null;
  } catch (err) {
    // If offline, trust existing session temporarily
    return getAuthUser();
  }
}
