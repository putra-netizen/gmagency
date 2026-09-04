import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

dotenv.config();

export interface AuthPayload {
  username: string;
  role: 'admin' | 'adminshp' | 'finance' | 'worker';
  name: string;
  slot?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'gm-agency-jwt-secure-auth-secret-key-2026';
const TOKEN_EXPIRY = '8h';

// Default pre-computed bcrypt hashes (cost factor 10)
const DEFAULT_HASHES: Record<string, string> = {
  admin: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPe9Uay/rVD/hcTr0CfReJxe1ke6ZV6m1W', // gmadmin
  adminera: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPeMgYckjaHTtnq9UGd1vIAJlaOiyahgt6', // gmadminshp1
  admincika: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPeIikqqSsB6dhUmb.kst4Aa/lV1eIjL8K', // gmadminshp2
  adminvira: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPeg6FFV8lLJzpUmvJSjOJyaT9YKue6/WO', // gmadminshp3
  adminali: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPeZZt6MOAEhIfCSRojMdQzzFr9mGp4o4G', // gmadminshp4
  finance: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPeaFjsmEYNAhyXPTfk7w8x5wNToBctMMm', // 0101
  worker1: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPe27BMbUEtYz8JmydQ1D/xa7zEk9G75XW', // gmworker1
  worker2: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPeikXyMraVHkCxOWtWFeSY3M9.F.d1sm2', // gmworker2
  worker3: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPelxj/eTx4BuwV90svzq7ACHlCE6kkGlq', // gmworker3
  worker4: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPesiyO6BYAbsY3CS91F3VEyR5Q9rFAu6W', // gmworker4
  worker5: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPezmjAca25ftEh.IbDNS//jqyRCKurp6e', // gmworker5
  worker6: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPeHX5FdmfG8awRiYkwswVg4F8F2vUaCfu', // gmworker6
  worker7: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPeDmdWqDtnTtK0fY3kaYWBvH7k/jUTDuW', // gmworker7
  worker8: '$2b$10$W4Kg8T2kKFHG8IlMvRgLPeeA6JiG5/v0LSdKS0GdEY0ndY1Ubdgim', // gmworker8
};

// Path to persistent auth overrides (e.g. updated passwords by super admin)
const AUTH_OVERRIDES_FILE = path.join(process.cwd(), 'src', 'data', 'auth_overrides.json');

function getAuthOverrides(): Record<string, string> {
  try {
    if (fs.existsSync(AUTH_OVERRIDES_FILE)) {
      const content = fs.readFileSync(AUTH_OVERRIDES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Failed to read auth overrides file:', err);
  }
  return {};
}

export function saveAuthOverride(usernameKey: string, newHash: string) {
  try {
    const overrides = getAuthOverrides();
    overrides[usernameKey.toLowerCase().trim()] = newHash;
    const dir = path.dirname(AUTH_OVERRIDES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(AUTH_OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save auth override:', err);
  }
}

// User registry and metadata
interface UserAccountDef {
  username: string;
  aliases: string[];
  role: 'admin' | 'adminshp' | 'finance' | 'worker';
  name: string;
  slot?: string;
  envVar: string;
  defaultHashKey: string;
}

const USER_ACCOUNTS: UserAccountDef[] = [
  {
    username: 'admin',
    aliases: ['superadmin'],
    role: 'admin',
    name: 'Super Admin GM',
    envVar: 'ADMIN_PASSWORD_HASH',
    defaultHashKey: 'admin',
  },
  {
    username: 'adminera',
    aliases: ['adminshp1'],
    role: 'adminshp',
    name: 'Admin Era (SHP 1)',
    slot: 'adminshp1',
    envVar: 'ADMINSHP1_PASSWORD_HASH',
    defaultHashKey: 'adminera',
  },
  {
    username: 'admincika',
    aliases: ['adminshp2'],
    role: 'adminshp',
    name: 'Admin Cika (SHP 2)',
    slot: 'adminshp2',
    envVar: 'ADMINSHP2_PASSWORD_HASH',
    defaultHashKey: 'admincika',
  },
  {
    username: 'adminvira',
    aliases: ['adminshp3'],
    role: 'adminshp',
    name: 'Admin Vira (SHP 3)',
    slot: 'adminshp3',
    envVar: 'ADMINSHP3_PASSWORD_HASH',
    defaultHashKey: 'adminvira',
  },
  {
    username: 'adminali',
    aliases: ['adminshp4'],
    role: 'adminshp',
    name: 'Admin Ali (SHP 4)',
    slot: 'adminshp4',
    envVar: 'ADMINSHP4_PASSWORD_HASH',
    defaultHashKey: 'adminali',
  },
  {
    username: 'finance',
    aliases: ['gmfinance', 'owner'],
    role: 'finance',
    name: 'Finance & Owner',
    envVar: 'FINANCE_PIN_HASH',
    defaultHashKey: 'finance',
  },
  ...Array.from({ length: 8 }, (_, i) => {
    const num = i + 1;
    return {
      username: `worker${num}`,
      aliases: [`w${num}`],
      role: 'worker' as const,
      name: `Worker ${num}`,
      slot: `worker${num}`,
      envVar: `WORKER${num}_PASSWORD_HASH`,
      defaultHashKey: `worker${num}`,
    };
  }),
];

/**
 * Resolves the active bcrypt hash for a user account:
 * 1. Checks file overrides (if super admin changed credentials via UI)
 * 2. Checks process.env variable
 * 3. Falls back to secure default hash
 */
export function getActiveHashForUser(user: UserAccountDef): string {
  const overrides = getAuthOverrides();
  const overrideHash = overrides[user.username.toLowerCase()] || (user.slot && overrides[user.slot.toLowerCase()]);
  if (overrideHash) return overrideHash;

  const envVal = process.env[user.envVar];
  if (envVal && envVal.trim().startsWith('$2')) {
    return envVal.trim();
  }

  return DEFAULT_HASHES[user.defaultHashKey] || '';
}

/* ========================================================================= */
/* TAHAP 2: RATE LIMITING (Max 5 failed attempts in 15 minutes per IP/user) */
/* ========================================================================= */
interface AttemptRecord {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of loginAttempts.entries()) {
    if (rec.blockedUntil && rec.blockedUntil < now) {
      loginAttempts.delete(key);
    } else if (!rec.blockedUntil && now - rec.firstAttempt > WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

function getRateLimitKey(ip: string, username: string): string {
  const cleanIp = (ip || 'unknown').replace(/^.*:/, ''); // normalize IPv6 if needed
  return `${cleanIp}:${username.toLowerCase().trim()}`;
}

export function checkRateLimit(ip: string, username: string): { isBlocked: boolean; retryAfterSeconds?: number; attemptsLeft?: number } {
  const key = getRateLimitKey(ip, username);
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) {
    return { isBlocked: false, attemptsLeft: MAX_ATTEMPTS };
  }

  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { isBlocked: true, retryAfterSeconds };
  }

  // Window expired, reset
  if (now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(key);
    return { isBlocked: false, attemptsLeft: MAX_ATTEMPTS };
  }

  return { isBlocked: false, attemptsLeft: Math.max(0, MAX_ATTEMPTS - record.count) };
}

export function recordFailedAttempt(ip: string, username: string): { isBlocked: boolean; retryAfterSeconds?: number; attemptsLeft: number } {
  const key = getRateLimitKey(ip, username);
  const now = Date.now();
  let record = loginAttempts.get(key);

  if (!record || (now - record.firstAttempt > WINDOW_MS && !record.blockedUntil)) {
    record = { count: 1, firstAttempt: now };
  } else {
    record.count += 1;
  }

  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    loginAttempts.set(key, record);
    return { isBlocked: true, retryAfterSeconds: Math.ceil(BLOCK_DURATION_MS / 1000), attemptsLeft: 0 };
  }

  loginAttempts.set(key, record);
  return { isBlocked: false, attemptsLeft: MAX_ATTEMPTS - record.count };
}

export function resetRateLimit(ip: string, username: string) {
  const key = getRateLimitKey(ip, username);
  loginAttempts.delete(key);
}

/* ========================================================================= */
/* TAHAP 1: AUTH HANDLERS & MIDDLEWARE                                       */
/* ========================================================================= */

/**
 * POST /api/auth/login handler
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawUsername = (req.body.username || '').toString().trim();
    const rawPassword = (req.body.password !== undefined ? req.body.password : req.body.pin || '').toString();
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';

    // Support PIN-only login for Finance
    let targetUsername = rawUsername;
    if (!targetUsername && req.body.pin) {
      targetUsername = 'finance';
    }

    if (!targetUsername || !rawPassword) {
      res.status(400).json({ error: 'Username dan password wajib diisi!' });
      return;
    }

    const normUser = targetUsername.toLowerCase();

    // Check rate limiter
    const rateCheck = checkRateLimit(clientIp, normUser);
    if (rateCheck.isBlocked) {
      const mins = Math.ceil((rateCheck.retryAfterSeconds || 60) / 60);
      res.status(429).json({
        error: `Terlalu banyak percobaan login yang gagal. Akses diblokir sementara selama ${mins} menit. Silakan coba lagi nanti.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
      return;
    }

    // Locate user definition
    const userDef = USER_ACCOUNTS.find(
      (u) => u.username === normUser || u.aliases.includes(normUser) || (u.slot && u.slot === normUser)
    );

    if (!userDef) {
      const fail = recordFailedAttempt(clientIp, normUser);
      if (fail.isBlocked) {
        res.status(429).json({
          error: 'Terlalu banyak percobaan login yang gagal. Akun diblokir sementara selama 15 menit.',
          retryAfterSeconds: fail.retryAfterSeconds,
        });
        return;
      }
      res.status(401).json({
        error: `Username atau password salah! Sisa percobaan: ${fail.attemptsLeft}`,
      });
      return;
    }

    const targetHash = getActiveHashForUser(userDef);
    if (!targetHash) {
      res.status(500).json({ error: 'Konfigurasi kredensial server bermasalah.' });
      return;
    }

    // Verify bcrypt hash
    const isMatch = await bcrypt.compare(rawPassword, targetHash);
    if (!isMatch) {
      const fail = recordFailedAttempt(clientIp, normUser);
      if (fail.isBlocked) {
        res.status(429).json({
          error: 'Terlalu banyak percobaan login yang gagal. Akun diblokir sementara selama 15 menit.',
          retryAfterSeconds: fail.retryAfterSeconds,
        });
        return;
      }
      res.status(401).json({
        error: `Username atau password salah! Sisa percobaan: ${fail.attemptsLeft}`,
      });
      return;
    }

    // Password valid! Clear rate limiter
    resetRateLimit(clientIp, normUser);

    // Generate signed JWT token
    const payload: AuthPayload = {
      username: userDef.username,
      role: userDef.role,
      name: userDef.name,
      slot: userDef.slot,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.json({
      success: true,
      token,
      user: {
        username: userDef.username,
        role: userDef.role,
        name: userDef.name,
        slot: userDef.slot,
      },
      expiresIn: TOKEN_EXPIRY,
    });
  } catch (err: any) {
    console.error('Error during loginHandler:', err);
    res.status(500).json({ error: 'Terjadi kesalahan internal server saat login.' });
  }
}

/**
 * GET /api/auth/me handler
 */
export function meHandler(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ valid: false, error: 'Unauthorized' });
    return;
  }
  res.json({ valid: true, user: req.user });
}

/**
 * Middleware to verify JWT token on sensitive routes
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized: Token autentikasi tidak valid atau sudah kedaluwarsa.' });
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        res.status(403).json({ error: 'Forbidden: Anda tidak memiliki izin untuk mengakses resource ini.' });
        return;
      }
      next();
    });
  };
}
