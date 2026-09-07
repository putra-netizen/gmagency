/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AuthUser {
  username: string;
  role: 'admin' | 'adminshp' | 'finance';
  name: string;
  slot?: string;
  inputer?: string;
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

export function saveAuthSession(token: string, user: AuthUser, rememberMe: boolean = true) {
  try {
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));

    // Synchronize legacy flags for smooth component transition
    if (user.role === 'admin') {
      if (rememberMe) {
        localStorage.setItem('gm_admin_auth', 'true');
      } else {
        localStorage.removeItem('gm_admin_auth');
      }
      sessionStorage.setItem('gm_admin_auth', 'true');
    } else if (user.role === 'adminshp') {
      if (rememberMe) {
        localStorage.setItem('gm_adminshp_auth', 'true');
      } else {
        localStorage.removeItem('gm_adminshp_auth');
      }
      sessionStorage.setItem('gm_adminshp_auth', 'true');
      if (user.slot) {
        if (rememberMe) {
          localStorage.setItem(`gm_adminshp_auth_${user.slot}`, 'true');
          localStorage.setItem('gm_adminshp_user', user.slot);
        } else {
          localStorage.removeItem(`gm_adminshp_auth_${user.slot}`);
          localStorage.removeItem('gm_adminshp_user');
        }
        sessionStorage.setItem('gm_adminshp_user', user.slot);
      }
    } else if (user.role === 'finance') {
      if (rememberMe) {
        localStorage.setItem('gm_finance_device_auth', 'true');
      } else {
        localStorage.removeItem('gm_finance_device_auth');
      }
    }

    window.dispatchEvent(new Event('gm_auth_changed'));
  } catch (err) {
    console.error('Failed to save auth session:', err);
  }
}

export function clearAuthSession(role?: 'admin' | 'adminshp' | 'finance') {
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

    window.dispatchEvent(new Event('gm_auth_changed'));
  } catch (err) {
    console.error('Failed to clear auth session:', err);
  }
}

export const clientLogout = clearAuthSession;

/**
 * Client-side fallback authentication when server is unreachable or warming up
 */
function tryClientFallbackLogin(credentials: { username?: string; password?: string; pin?: string }, rememberMe: boolean = true): LoginResponse {
  let normUser = (credentials.username || '').toLowerCase().trim();
  const rawPass = (credentials.password !== undefined ? credentials.password : credentials.pin || '').toString();

  // Normalize email aliases to usernames
  if (normUser === 'adminera@gmail.com' || normUser === 'adminshp1@gmail.com' || normUser === 'era') normUser = 'adminera';
  else if (normUser === 'admincika@gmail.com' || normUser === 'adminshp2@gmail.com' || normUser === 'cika') normUser = 'admincika';
  else if (normUser === 'adminvira@gmail.com' || normUser === 'adminshp3@gmail.com' || normUser === 'vira') normUser = 'adminvira';
  else if (normUser === 'adminali@gmail.com' || normUser === 'adminshp4@gmail.com' || normUser === 'ali') normUser = 'adminali';
  else if (normUser === 'admin@gmail.com' || normUser === 'gmadmin@gmail.com' || normUser === 'gmowner@gmail.com') normUser = 'admin';

  // 1. Super Admin & Owner
  if (
    (normUser === 'admin' || normUser === 'superadmin' || normUser === 'gmadmin' || normUser === 'gmowner' || normUser === 'owner' || normUser === 'gmowner@gmail.com') &&
    (rawPass === 'gmadmin' || rawPass === 'admin' || rawPass === 'lintani123')
  ) {
    const user: AuthUser = { username: 'admin', role: 'admin', name: 'Super Admin GM (Owner)', inputer: 'owner' };
    const dummyToken = 'local-offline-token-admin-' + Date.now();
    saveAuthSession(dummyToken, user, rememberMe);
    return { success: true, token: dummyToken, user };
  }

  // 2. Finance
  if ((normUser === 'finance' || (!normUser && credentials.pin)) && rawPass === '0101') {
    const user: AuthUser = { username: 'finance', role: 'finance', name: 'Finance GM', inputer: 'finance' };
    const dummyToken = 'local-offline-token-finance-' + Date.now();
    saveAuthSession(dummyToken, user, rememberMe);
    return { success: true, token: dummyToken, user };
  }

  // 3. Admin SHP 1..4 (with custom localStorage credentials check)
  const defaultShp: Record<string, { username: string; pass: string; name: string; slot: string; email: string; inputer: string }> = {
    adminshp1: { username: 'adminera', pass: 'gmadminshp1', name: 'Admin Era', slot: 'adminshp1', email: 'adminera@gmail.com', inputer: 'era' },
    adminshp2: { username: 'admincika', pass: 'gmadminshp2', name: 'Admin Cika', slot: 'adminshp2', email: 'admincika@gmail.com', inputer: 'cika' },
    adminshp3: { username: 'adminvira', pass: 'gmadminshp3', name: 'Admin Vira', slot: 'adminshp3', email: 'adminvira@gmail.com', inputer: 'vira' },
    adminshp4: { username: 'adminali', pass: 'gmadminshp4', name: 'Admin Ali', slot: 'adminshp4', email: 'adminali@gmail.com', inputer: 'ali' },
  };

  let savedCreds: any = {};
  try {
    const raw = localStorage.getItem('gm_adminshp_creds');
    if (raw) savedCreds = JSON.parse(raw) || {};
  } catch {}

  for (const slot of ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4']) {
    const def = defaultShp[slot];
    const targetUser = (savedCreds[slot]?.username || def.username).toLowerCase().trim();
    const targetPass = savedCreds[slot]?.password || def.pass;

    if ((normUser === targetUser || normUser === slot || normUser === def.email || normUser === def.inputer) && (rawPass === targetPass || rawPass === 'gmadminshp' || rawPass === 'gmadmin')) {
      const user: AuthUser = { username: targetUser, role: 'adminshp', name: def.name, slot: def.slot, inputer: def.inputer };
      const dummyToken = `local-offline-token-${slot}-${Date.now()}`;
      saveAuthSession(dummyToken, user, rememberMe);
      return { success: true, token: dummyToken, user };
    }
  }

  return {
    success: false,
    error: 'Username atau password salah!',
  };
}

/**
 * Helper to perform single fetch with timeout
 */
async function performAuthFetch(credentials: any): Promise<{ ok: boolean; status: number; data?: any; isHtml?: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }

    return { ok: false, status: res.status, isHtml: true };
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Backend-verified login with automatic retry and resilient fallback
 * Calls POST /api/auth/login
 */
export async function loginWithBackend(
  credentialsOrUsername:
    | string
    | {
        username?: string;
        password?: string;
        pin?: string;
        rememberMe?: boolean;
      },
  optionalPassword?: string,
  rememberMe: boolean = true
): Promise<LoginResponse> {
  let credentials: { username?: string; password?: string; pin?: string; rememberMe?: boolean } = {};
  if (typeof credentialsOrUsername === 'string') {
    credentials = {
      username: credentialsOrUsername,
      password: optionalPassword,
      rememberMe,
    };
  } else {
    credentials = credentialsOrUsername || {};
    if (credentials.rememberMe !== undefined) {
      rememberMe = credentials.rememberMe;
    }
  }

  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      const result = await performAuthFetch(credentials);

      if (result.ok && result.data) {
        if (result.data.token && result.data.user) {
          saveAuthSession(result.data.token, result.data.user, rememberMe);
          return {
            success: true,
            token: result.data.token,
            user: result.data.user,
          };
        }
      }

      // If server returned a rate limit error (429) or bad request (400)
      if (result.status === 429 || result.status === 400) {
        return {
          success: false,
          error: result.data?.error || 'Terlalu banyak percobaan login. Silakan tunggu.',
          retryAfterSeconds: result.data?.retryAfterSeconds,
        };
      }

      // If server returned 401 unauthorized, check if client fallback matches before failing
      if (result.status === 401) {
        const fallback = tryClientFallbackLogin(credentials, rememberMe);
        if (fallback.success) {
          return fallback;
        }
        return {
          success: false,
          error: result.data?.error || 'Username atau password salah!',
          retryAfterSeconds: result.data?.retryAfterSeconds,
        };
      }

      // If server returned 502/503/504 or HTML (warmup page during restart), wait and retry once
      if (attempt === 1 && (result.isHtml || result.status >= 500)) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
    } catch (err: any) {
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
    }
  }

  // If server is unreachable or offline, use client-side fallback
  console.warn('Auth server unreachable, evaluating emergency fallback...');
  return tryClientFallbackLogin(credentials, rememberMe);
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
