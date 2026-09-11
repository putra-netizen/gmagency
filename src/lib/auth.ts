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

/**
 * Standardize slot or username to order inputer identifier ('era', 'cika', 'vira', 'ali', 'owner', 'finance')
 */
export function getSlotIndicatorName(slot?: string): string {
  if (!slot) return '';
  const clean = slot.trim().toLowerCase();
  if (clean === 'adminshp1' || clean === 'adminera' || clean === 'era' || clean === 'adminera@gmail.com' || clean === 'adminera@gmagency.internal') return 'era';
  if (clean === 'adminshp2' || clean === 'admincika' || clean === 'cika' || clean === 'admincika@gmail.com' || clean === 'admincika@gmagency.internal') return 'cika';
  if (clean === 'adminshp3' || clean === 'adminvira' || clean === 'vira' || clean === 'adminvira@gmail.com' || clean === 'adminvira@gmagency.internal') return 'vira';
  if (clean === 'adminshp4' || clean === 'adminali' || clean === 'ali' || clean === 'adminali@gmail.com' || clean === 'adminali@gmagency.internal') return 'ali';
  if (clean === 'admin' || clean === 'gmowner' || clean === 'owner' || clean === 'gmowner@gmail.com' || clean === 'admin@gmagency.internal' || clean === 'superadmin') return 'owner';
  if (clean === 'finance' || clean === 'gmfinance' || clean === 'finance@gmagency.internal') return 'finance';
  return clean;
}

// In-memory active user cache
let cachedAuthUser: AuthUser | null = null;

export function getViewAsShpSlot(): string | null {
  try {
    return sessionStorage.getItem(VIEW_AS_SHP_KEY) || localStorage.getItem(VIEW_AS_SHP_KEY);
  } catch {
    return null;
  }
}

export function setViewAsShpSlot(slot: string | null): void {
  try {
    if (slot && slot.trim()) {
      sessionStorage.setItem(VIEW_AS_SHP_KEY, slot.trim());
      localStorage.setItem(VIEW_AS_SHP_KEY, slot.trim());
    } else {
      sessionStorage.removeItem(VIEW_AS_SHP_KEY);
      localStorage.removeItem(VIEW_AS_SHP_KEY);
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
  let username = (email.split('@')[0] || meta.username || 'user').toLowerCase();
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
    }
  } catch {}

  // If slot or role is not fully specified, use comprehensive string pattern detection
  const searchStr = `${email} ${username} ${name} ${meta.role || ''} ${meta.slot || ''}`.toLowerCase();
  if (!slot) {
    if (searchStr.includes('adminshp1') || searchStr.includes('adminera') || searchStr.includes('era')) {
      slot = 'adminshp1';
      role = 'adminshp';
    } else if (searchStr.includes('adminshp2') || searchStr.includes('admincika') || searchStr.includes('cika')) {
      slot = 'adminshp2';
      role = 'adminshp';
    } else if (searchStr.includes('adminshp3') || searchStr.includes('adminvira') || searchStr.includes('vira')) {
      slot = 'adminshp3';
      role = 'adminshp';
    } else if (searchStr.includes('adminshp4') || searchStr.includes('adminali') || searchStr.includes('ali')) {
      slot = 'adminshp4';
      role = 'adminshp';
    }
  }

  if (searchStr.includes('admin') || searchStr.includes('owner') || searchStr.includes('gmowner')) {
    if (!slot) role = 'admin';
  } else if (searchStr.includes('finance')) {
    role = 'finance';
  }

  // Determine slot indicator name for order inputer
  let inputer = 'owner';
  if (role === 'adminshp') {
    if (slot === 'adminshp1' || searchStr.includes('era')) inputer = 'era';
    else if (slot === 'adminshp2' || searchStr.includes('cika')) inputer = 'cika';
    else if (slot === 'adminshp3' || searchStr.includes('vira')) inputer = 'vira';
    else if (slot === 'adminshp4' || searchStr.includes('ali')) inputer = 'ali';
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

/**
 * Single Source of Truth for resolving the active creator/inputer ('era', 'cika', 'vira', 'ali', 'owner', etc.)
 * 
 * 1. Cek dulu apakah sedang dalam mode "View As" (state viewAsShp yang tersimpan saat Super Admin Quick Access).
 * 2. Kalau YA sedang View As seseorang, return identitas yang di-VIEW AS itu (misal 'vira'), BUKAN identitas asli Super Admin yang login.
 *    (PENTING: session/token autentikasi Supabase TETAP milik Super Admin sepenuhnya, hanya atribusi created_by yang diarahkan).
 * 3. Kalau TIDAK sedang View As (login normal biasa oleh Admin SHP itu sendiri atau Super Admin sendiri), tetap gunakan logic session Supabase Auth asli.
 */
export async function resolveActiveInputerIdentity(): Promise<string> {
  console.group('🔍 [DEBUG resolveActiveInputerIdentity] Resolving Active Creator Identity');
  
  // 1. CEK DULU APAKAH SEDANG DALAM MODE "VIEW AS"
  const rawViewAs = getViewAsShpSlot();
  console.log('[DEBUG 1] Active VIEW_AS_SHP_KEY (viewAsShp):', rawViewAs);

  if (rawViewAs && typeof rawViewAs === 'string' && rawViewAs.trim()) {
    const targetIdentity = getSlotIndicatorName(rawViewAs.trim());
    if (targetIdentity) {
      console.log('🎯 [DEBUG resolveActiveInputerIdentity] VIEW AS MODE ACTIVE -> returning target identity:', `"${targetIdentity}"`);
      console.log('🎯 [DEBUG resolveActiveInputerIdentity FINAL RETURN]:', `"${targetIdentity}"`);
      console.groupEnd();
      return targetIdentity;
    }
  }

  // 2. JIKA TIDAK SEDANG VIEW AS (LOGIN NORMAL BIASA OLEH ADMIN SHP ATAU SUPER ADMIN SENDIRI)
  // Tetap gunakan logic yang sudah ada (identitas dari session Supabase Auth asli)
  let sessionUser: any = null;
  let liveUser: any = null;

  // Step A: Query Supabase Auth Session
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    sessionUser = sessionData?.session?.user || null;
    console.log('[DEBUG 2] supabase.auth.getSession() result:', {
      hasSession: !!sessionData?.session,
      user_id: sessionUser?.id,
      email: sessionUser?.email,
      user_metadata: sessionUser?.user_metadata,
      error: sessionErr?.message || null
    });
  } catch (err) {
    console.warn('[DEBUG 2] Exception in getSession():', err);
  }

  // Step B: Query Supabase Auth live User
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    liveUser = userData?.user || null;
    console.log('[DEBUG 3] supabase.auth.getUser() result:', {
      hasUser: !!liveUser,
      user_id: liveUser?.id,
      email: liveUser?.email,
      user_metadata: liveUser?.user_metadata,
      error: userErr?.message || null
    });
  } catch (err) {
    console.warn('[DEBUG 3] Exception in getUser():', err);
  }

  // Active Supabase Auth user (liveUser preferred, fallback sessionUser)
  const currentSupabaseUser = liveUser || sessionUser;

  // Step C: Resolve user role & slot from Supabase User if available
  let resolvedFromSupabase: AuthUser | null = null;
  if (currentSupabaseUser) {
    try {
      resolvedFromSupabase = await resolveUserRole(currentSupabaseUser);
      console.log('[DEBUG 4] resolveUserRole(currentSupabaseUser):', resolvedFromSupabase);
    } catch (err) {
      console.warn('[DEBUG 4] Exception in resolveUserRole():', err);
    }
  }

  // Step D: Stored / In-memory user
  const storedUser = getAuthUser();
  console.log('[DEBUG 5] getAuthUser() from storage/memory:', storedUser);

  let finalIdentity = '';

  // Decision Logic for Normal (Non-View As) Mode:
  // Primary authority: Supabase authenticated session
  if (resolvedFromSupabase) {
    if (resolvedFromSupabase.role === 'admin') {
      finalIdentity = 'owner';
      console.log('[DEBUG 6] Matched authenticated Supabase Super Admin session ->', finalIdentity);
    } else if (resolvedFromSupabase.role === 'adminshp') {
      finalIdentity = resolvedFromSupabase.inputer || (resolvedFromSupabase.slot ? getSlotIndicatorName(resolvedFromSupabase.slot) : getSlotIndicatorName(resolvedFromSupabase.username));
      console.log('[DEBUG 6] Matched authenticated Supabase adminshp session ->', finalIdentity);
    } else if (resolvedFromSupabase.role === 'finance') {
      finalIdentity = 'finance';
      console.log('[DEBUG 6] Matched authenticated Supabase finance session ->', finalIdentity);
    }
  }

  // Secondary fallback: stored user in memory / local state
  if (!finalIdentity && storedUser) {
    if (storedUser.role === 'admin') {
      finalIdentity = 'owner';
      console.log('[DEBUG 6] Fallback to stored Super Admin user ->', finalIdentity);
    } else if (storedUser.role === 'adminshp') {
      finalIdentity = storedUser.inputer || (storedUser.slot ? getSlotIndicatorName(storedUser.slot) : getSlotIndicatorName(storedUser.username));
      console.log('[DEBUG 6] Fallback to stored adminshp user ->', finalIdentity);
    } else if (storedUser.role === 'finance') {
      finalIdentity = 'finance';
      console.log('[DEBUG 6] Fallback to stored finance user ->', finalIdentity);
    }
  }

  // Tertiary fallback: localStorage flags
  if (!finalIdentity) {
    const hasAdminAuth = typeof window !== 'undefined' && (sessionStorage.getItem('gm_admin_auth') === 'true' || localStorage.getItem('gm_admin_auth') === 'true');
    if (hasAdminAuth) {
      finalIdentity = 'owner';
    } else {
      const shpUser = typeof window !== 'undefined' ? (sessionStorage.getItem('gm_adminshp_user') || localStorage.getItem('gm_adminshp_user')) : null;
      if (shpUser) {
        finalIdentity = getSlotIndicatorName(shpUser);
      }
    }
  }

  if (!finalIdentity) {
    finalIdentity = 'owner';
  }

  console.log('🎯 [DEBUG resolveActiveInputerIdentity FINAL RETURN]:', `"${finalIdentity}"`);
  console.groupEnd();

  return finalIdentity;
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
      localStorage.removeItem('gm_adminshp_user');
      sessionStorage.removeItem('gm_adminshp_user');
    } else if (user.role === 'adminshp') {
      sessionStorage.setItem('gm_adminshp_auth', 'true');
      if (rememberMe) localStorage.setItem('gm_adminshp_auth', 'true');
      const targetSlot = user.slot || (user.inputer === 'vira' ? 'adminshp3' : user.inputer === 'cika' ? 'adminshp2' : user.inputer === 'ali' ? 'adminshp4' : user.inputer === 'era' ? 'adminshp1' : undefined);
      if (targetSlot) {
        sessionStorage.setItem('gm_adminshp_user', targetSlot);
        sessionStorage.setItem(VIEW_AS_SHP_KEY, targetSlot);
        if (rememberMe) {
          localStorage.setItem('gm_adminshp_user', targetSlot);
          localStorage.setItem(`gm_adminshp_auth_${targetSlot}`, 'true');
        }
      } else {
        sessionStorage.removeItem(VIEW_AS_SHP_KEY);
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
      candidateEmails.push('gmowner@gmail.com', 'admin@gmail.com', 'internal@gmagency.com');
    } else if (lower === 'adminshp1' || lower === 'era') {
      candidateEmails.push('adminera@gmail.com', 'adminera@gmagency.com');
    } else if (lower === 'adminshp2' || lower === 'cika') {
      candidateEmails.push('admincika@gmail.com', 'admincika@gmagency.com');
    } else if (lower === 'adminshp3' || lower === 'vira') {
      candidateEmails.push('adminvira@gmail.com', 'adminvira@gmagency.com');
    } else if (lower === 'adminshp4' || lower === 'ali') {
      candidateEmails.push('adminali@gmail.com', 'adminali@gmagency.com');
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
