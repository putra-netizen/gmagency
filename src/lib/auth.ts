/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './supabase';

export interface AuthUser {
  id?: string;
  email?: string;
  username: string;
  role: 'admin' | 'adminshp' | 'finance' | 'worker';
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

const USER_KEY = 'gm_auth_user';
const TOKEN_KEY = 'gm_auth_token';
export const VIEW_AS_SHP_KEY = 'gm_view_as_shp';

// Purge stale bypass tokens and sanitize adminshp state if user is actually admin
try {
  if (typeof window !== 'undefined') {
    const rawToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    const hasAdminAuth = localStorage.getItem('gm_admin_auth') === 'true' || sessionStorage.getItem('gm_admin_auth') === 'true';
    if (rawToken === 'gm-bypass-token') {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      if (hasAdminAuth) {
        localStorage.removeItem('gm_adminshp_auth');
        sessionStorage.removeItem('gm_adminshp_auth');
        localStorage.removeItem('gm_adminshp_user');
        sessionStorage.removeItem('gm_adminshp_user');
        const restoredUser: AuthUser = {
          username: 'admin',
          role: 'admin',
          name: 'Super Admin',
          email: 'admin@gmagency.internal'
        };
        localStorage.setItem(USER_KEY, JSON.stringify(restoredUser));
        sessionStorage.setItem(USER_KEY, JSON.stringify(restoredUser));
      }
    } else if (hasAdminAuth) {
      const rawUser = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          if (parsed?.role === 'admin') {
            localStorage.removeItem('gm_adminshp_auth');
            sessionStorage.removeItem('gm_adminshp_auth');
            localStorage.removeItem('gm_adminshp_user');
            sessionStorage.removeItem('gm_adminshp_user');
          }
        } catch (e) {}
      }
    }
  }
} catch (e) {}

// In-memory active user cache
let cachedAuthUser: AuthUser | null = null;

export function getViewAsShpSlot(): string | null {
  try {
    return sessionStorage.getItem(VIEW_AS_SHP_KEY);
  } catch {
    return null;
  }
}

export function setViewAsShpSlot(slot: string | null): void {
  try {
    if (slot) {
      sessionStorage.setItem(VIEW_AS_SHP_KEY, slot);
    } else {
      sessionStorage.removeItem(VIEW_AS_SHP_KEY);
    }
  } catch (err) {
    console.warn('Storage restricted:', err);
  }
  window.dispatchEvent(new Event('gm_auth_changed'));
  window.dispatchEvent(new Event('admin-auth-change'));
  window.dispatchEvent(new Event('adminshp-auth-change'));
}

/**
 * Resolve simple username input (e.g. "admin", "adminshp1", "worker3", "finance")
 * to the full registered email address in Supabase Auth.
 */
export async function resolveEmailFromUsername(input: string): Promise<string> {
  const clean = (input || '').trim();
  if (!clean) return '';
  if (clean.includes('@')) return clean.toLowerCase();

  const lower = clean.toLowerCase();

  // 1. Check if username exists in public.user_roles table
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('email')
      .ilike('username', lower)
      .maybeSingle();

    if (data?.email) {
      return data.email.toLowerCase().trim();
    }
  } catch (err) {
    // Ignore error if table not yet created
  }

  // 2. Standard pattern mapping (matching Supabase Auth dashboard setup)
  if (lower === 'admin' || lower === 'gmadmin' || lower === 'superadmin' || lower === 'owner' || lower === 'gmowner' || lower === 'internal') {
    return 'admin@gmagency.internal';
  }
  if (lower === 'adminshp1' || lower === 'adminera' || lower === 'era') {
    return 'adminera@gmagency.internal';
  }
  if (lower === 'adminshp2' || lower === 'admincika' || lower === 'cika') {
    return 'admincika@gmagency.internal';
  }
  if (lower === 'adminshp3' || lower === 'adminvira' || lower === 'vira') {
    return 'adminvira@gmagency.internal';
  }
  if (lower === 'adminshp4' || lower === 'adminali' || lower === 'ali') {
    return 'adminali@gmagency.internal';
  }
  if (lower === 'finance') {
    return 'finance@gmagency.internal';
  }
  for (let i = 1; i <= 8; i++) {
    if (lower === `worker${i}`) {
      return `worker${i}@gmagency.internal`;
    }
  }

  return `${lower}@gmagency.internal`;
}

/**
 * Resolve user role, slot, and display name from user_roles table or email pattern
 */
export async function resolveUserRole(user: any): Promise<AuthUser> {
  const email = (user?.email || '').toLowerCase().trim();
  const meta = user?.user_metadata || {};
  let role: 'admin' | 'adminshp' | 'finance' | 'worker' = 'admin';
  let slot: string | undefined = undefined;
  let username = email.split('@')[0] || 'user';
  let name = meta.full_name || meta.name || username;

  try {
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleRow) {
      role = roleRow.role;
      slot = roleRow.slot;
      name = roleRow.display_name || name;
      username = roleRow.username || username;
    } else {
      // Pattern fallback
      if (email.includes('era') || email.includes('cika') || email.includes('vira') || email.includes('ali') || email.includes('adminshp')) {
        role = 'adminshp';
        if (email.includes('era') || email.includes('adminshp1')) slot = 'adminshp1';
        else if (email.includes('cika') || email.includes('adminshp2')) slot = 'adminshp2';
        else if (email.includes('vira') || email.includes('adminshp3')) slot = 'adminshp3';
        else if (email.includes('ali') || email.includes('adminshp4')) slot = 'adminshp4';
      } else {
        role = 'admin';
      }
    }
  } catch {
    if (email.includes('era') || email.includes('cika') || email.includes('vira') || email.includes('ali') || email.includes('adminshp')) {
      role = 'adminshp';
      if (email.includes('era') || email.includes('adminshp1')) slot = 'adminshp1';
      else if (email.includes('cika') || email.includes('adminshp2')) slot = 'adminshp2';
      else if (email.includes('vira') || email.includes('adminshp3')) slot = 'adminshp3';
      else if (email.includes('ali') || email.includes('adminshp4')) slot = 'adminshp4';
    } else {
      role = 'admin';
    }
  }

  // Determine slot indicator name for order inputer
  let inputer = 'owner';
  if (role === 'adminshp') {
    if (slot === 'adminshp1' || username.includes('era')) inputer = 'era';
    else if (slot === 'adminshp2' || username.includes('cika')) inputer = 'cika';
    else if (slot === 'adminshp3' || username.includes('vira')) inputer = 'vira';
    else if (slot === 'adminshp4' || username.includes('ali')) inputer = 'ali';
    else inputer = 'adminshp';
  } else if (role === 'finance') {
    inputer = 'finance';
  } else if (role === 'worker') {
    inputer = slot || username;
  }

  return {
    id: user.id,
    email,
    username,
    role,
    name,
    slot,
    inputer,
  };
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAuthUser(): AuthUser | null {
  if (cachedAuthUser) return cachedAuthUser;
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
  cachedAuthUser = user;
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

    // Compatibility sync for legacy event listeners
    if (user.role === 'admin') {
      sessionStorage.setItem('gm_admin_auth', 'true');
      if (rememberMe) localStorage.setItem('gm_admin_auth', 'true');
    } else if (user.role === 'adminshp') {
      sessionStorage.setItem('gm_adminshp_auth', 'true');
      if (rememberMe) localStorage.setItem('gm_adminshp_auth', 'true');
      if (user.slot) {
        sessionStorage.setItem('gm_adminshp_user', user.slot);
        if (rememberMe) {
          localStorage.setItem('gm_adminshp_user', user.slot);
          localStorage.setItem(`gm_adminshp_auth_${user.slot}`, 'true');
        }
      }
    } else if (user.role === 'finance') {
      sessionStorage.setItem('gm_finance_device_auth', 'true');
      if (rememberMe) localStorage.setItem('gm_finance_device_auth', 'true');
    }

    window.dispatchEvent(new Event('gm_auth_changed'));
    window.dispatchEvent(new Event('admin-auth-change'));
    window.dispatchEvent(new Event('adminshp-auth-change'));
  } catch (err) {
    console.error('Failed to save auth session:', err);
  }
}

export async function clearAuthSession(role?: 'admin' | 'adminshp' | 'finance' | 'worker') {
  cachedAuthUser = null;
  try {
    await supabase.auth.signOut().catch(() => {});

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    localStorage.removeItem('gm_admin_auth');
    sessionStorage.removeItem('gm_admin_auth');
    localStorage.removeItem('gm_adminshp_auth');
    sessionStorage.removeItem('gm_adminshp_auth');
    localStorage.removeItem('gm_adminshp_user');
    sessionStorage.removeItem('gm_adminshp_user');
    ['adminshp1', 'adminshp2', 'adminshp3', 'adminshp4'].forEach((s) => {
      localStorage.removeItem(`gm_adminshp_auth_${s}`);
    });
    localStorage.removeItem('gm_finance_device_auth');
    sessionStorage.removeItem('gm_finance_device_auth');
    localStorage.removeItem('gm_finance_pin');
    localStorage.removeItem('gm_finance_auth_time');
    sessionStorage.removeItem(VIEW_AS_SHP_KEY);

    window.dispatchEvent(new Event('gm_auth_changed'));
    window.dispatchEvent(new Event('admin-auth-change'));
    window.dispatchEvent(new Event('adminshp-auth-change'));
  } catch (err) {
    console.error('Failed to clear auth session:', err);
  }
}

export const clientLogout = clearAuthSession;

/**
 * Authenticate directly with Supabase Auth (supabase.auth.signInWithPassword)
 * Maps simple usernames to registered emails automatically.
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
  let rawUsername = '';
  let rawPassword = '';

  if (typeof credentialsOrUsername === 'string') {
    rawUsername = credentialsOrUsername.trim();
    rawPassword = (optionalPassword !== undefined ? optionalPassword : '').toString();
  } else {
    rawUsername = (credentialsOrUsername.username || '').trim();
    rawPassword = (credentialsOrUsername.password !== undefined ? credentialsOrUsername.password : credentialsOrUsername.pin || '').toString();
    if (credentialsOrUsername.rememberMe !== undefined) {
      rememberMe = credentialsOrUsername.rememberMe;
    }
  }

  // Support finance PIN field as password
  if (!rawUsername && (credentialsOrUsername as any)?.pin) {
    rawUsername = 'finance';
  }

  if (!rawUsername || !rawPassword) {
    return {
      success: false,
      error: 'Username dan password wajib diisi!',
    };
  }

  // 1. Resolve username to email address
  const primaryEmail = await resolveEmailFromUsername(rawUsername);

  // Candidate emails to try if user entered simple username
  const candidateEmails: string[] = [primaryEmail];
  if (!rawUsername.includes('@')) {
    const lower = rawUsername.toLowerCase();
    // Also try alternative domains in case user created them with @gmail.com or other domain
    candidateEmails.push(`${lower}@gmail.com`);
    if (lower === 'admin' || lower === 'gmadmin' || lower === 'owner') {
      candidateEmails.push('gmowner@gmail.com', 'admin@gmail.com');
    } else if (lower === 'adminshp1' || lower === 'era') {
      candidateEmails.push('adminera@gmail.com');
    } else if (lower === 'adminshp2' || lower === 'cika') {
      candidateEmails.push('admincika@gmail.com');
    } else if (lower === 'adminshp3' || lower === 'vira') {
      candidateEmails.push('adminvira@gmail.com');
    } else if (lower === 'adminshp4' || lower === 'ali') {
      candidateEmails.push('adminali@gmail.com');
    }
  }

  let lastErrorMsg = 'Username atau password salah!';

  for (const emailToTry of candidateEmails) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToTry,
        password: rawPassword,
      });

      if (!error && data?.user && data.session) {
        const authUser = await resolveUserRole(data.user);
        saveAuthSession(data.session.access_token, authUser, rememberMe);

        return {
          success: true,
          token: data.session.access_token,
          user: authUser,
        };
      }

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          lastErrorMsg = 'Email belum dikonfirmasi di Supabase Auth dashboard.';
        } else if (error.message.includes('Invalid login credentials')) {
          lastErrorMsg = 'Username atau password salah!';
        } else {
          lastErrorMsg = error.message;
        }
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || 'Gagal terhubung ke layanan autentikasi Supabase.';
    }
  }

  return {
    success: false,
    error: lastErrorMsg,
  };
}

/**
 * Check official Supabase Auth Session
 */
export async function verifyCurrentSession(): Promise<AuthUser | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) {
      cachedAuthUser = null;
      return null;
    }

    const authUser = await resolveUserRole(session.user);
    saveAuthSession(session.access_token, authUser, true);
    return authUser;
  } catch (err) {
    return getAuthUser();
  }
}
