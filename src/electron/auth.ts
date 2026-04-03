/**
 * auth.ts  –  Authentication & session management in the **main process**.
 *
 * All password verification, brute-force protection and session tracking
 * runs here so it cannot be bypassed from the renderer (DevTools, etc.).
 * Passwords are hashed using Node.js `crypto.scryptSync` – a proper KDF.
 *
 * The renderer never sees password hashes; it only receives sanitised user
 * objects after a successful login.
 */

import crypto from 'crypto';
import { dbGetAll, dbUpsert, dbDelete, dbGetSetting } from './database';

// ── Scrypt parameters ──────────────────────────────────────────
const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

// ── Types ──────────────────────────────────────────────────────
export interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  email?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Session {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  email?: string;
  loginTime: number;
  lastActivity: number;
}

interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: string;
  email?: string;
  createdAt: string;
  lastLogin?: string;
}

// ── Session state (main-process memory only) ───────────────────
let _session: Session | null = null;
let _sessionTimeoutMinutes = 30;

// ── Brute-force protection ─────────────────────────────────────
const _loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// ═════════════════════════════════════════════════════════════════
// PASSWORD HASHING  (crypto.scryptSync — proper KDF)
// ═════════════════════════════════════════════════════════════════

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

function verifyScrypt(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts[0] !== 'scrypt' || parts.length !== 3) return false;
  const salt = parts[1];
  const hash = parts[2];
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString('hex');
  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(derived, 'hex'),
    );
  } catch {
    return false;
  }
}

/** Legacy v2_ hash — kept ONLY for auto-migration on login */
function legacyHashV2(password: string): string {
  const salt = 'ric_library_salt_v3_secure';
  const input = salt + password + salt;
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let round = 0; round < 200; round++) {
    const roundInput =
      round === 0 ? input : `${h1.toString(16)}:${input}:${h2.toString(16)}`;
    for (let i = 0; i < roundInput.length; i++) {
      const ch = roundInput.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  }
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return 'v2_' + hash.toString(36);
}

/** Legacy sha_ hash — kept ONLY for auto-migration on login */
function legacyHashSha(password: string): string {
  const salt = 'ric_library_salt_v2';
  const input = salt + password + salt;
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return 'sha_' + hash.toString(36) + '_' + password.length;
}

function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith('scrypt$')) return verifyScrypt(password, stored);
  if (stored.startsWith('v2_')) return stored === legacyHashV2(password);
  if (stored.startsWith('sha_')) return stored === legacyHashSha(password);
  // h_ prefix = too old, force reset
  return false;
}

function needsRehash(stored: string): boolean {
  return !stored.startsWith('scrypt$');
}

// ═════════════════════════════════════════════════════════════════
// BRUTE-FORCE HELPERS
// ═════════════════════════════════════════════════════════════════

function isLocked(username: string): { locked: boolean; remainingMs: number } {
  const key = username.trim().toLowerCase();
  const rec = _loginAttempts.get(key);
  if (!rec || rec.count < MAX_ATTEMPTS) return { locked: false, remainingMs: 0 };
  const remaining = rec.lockedUntil - Date.now();
  if (remaining <= 0) {
    _loginAttempts.delete(key);
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs: remaining };
}

function recordFail(username: string) {
  const key = username.trim().toLowerCase();
  const rec = _loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = Date.now() + LOCKOUT_MS;
  _loginAttempts.set(key, rec);
}

function clearFails(username: string) {
  _loginAttempts.delete(username.trim().toLowerCase());
}

// ═════════════════════════════════════════════════════════════════
// STRIP PASSWORD HASH  (never leak to renderer)
// ═════════════════════════════════════════════════════════════════

function stripHash(user: StoredUser): SafeUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
}

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

function getAllUsers(): StoredUser[] {
  return dbGetAll('users') as StoredUser[];
}

function loadSessionTimeout() {
  try {
    const raw = dbGetSetting('app_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.sessionTimeoutMinutes === 'number') {
        _sessionTimeoutMinutes = parsed.sessionTimeoutMinutes;
      }
    }
  } catch {
    // keep default
  }
}

// ═════════════════════════════════════════════════════════════════
// PUBLIC API  (called from IPC handlers in main.ts)
// ═════════════════════════════════════════════════════════════════

export interface LoginResult {
  success: boolean;
  user?: SafeUser;
  error?: string;
  lockedMs?: number;
}

export function login(username: string, password: string): LoginResult {
  loadSessionTimeout();

  const norm = username.trim().toLowerCase();
  const lock = isLocked(norm);
  if (lock.locked) {
    return { success: false, error: 'account_locked', lockedMs: lock.remainingMs };
  }

  const users = getAllUsers();
  const user = users.find((u) => u.username.toLowerCase() === norm);
  if (!user) {
    recordFail(norm);
    return { success: false, error: 'invalid_credentials' };
  }

  if (!verifyPassword(password, user.passwordHash)) {
    recordFail(norm);
    return { success: false, error: 'invalid_credentials' };
  }

  // ── Success ──
  clearFails(norm);

  // Auto-upgrade legacy hash → scrypt
  if (needsRehash(user.passwordHash)) {
    user.passwordHash = hashPassword(password);
    dbUpsert('users', user.id, user);
    console.log(`[auth] Upgraded password hash for "${user.username}" to scrypt`);
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  dbUpsert('users', user.id, user);

  // Create session
  _session = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    loginTime: Date.now(),
    lastActivity: Date.now(),
  };

  return { success: true, user: stripHash(user) };
}

export function logout(): void {
  _session = null;
}

export function getSession(): (Session & { user: SafeUser }) | null {
  if (!_session) return null;
  // Check timeout
  const elapsedMin = (Date.now() - _session.lastActivity) / 1000 / 60;
  if (elapsedMin > _sessionTimeoutMinutes) {
    console.log('[auth] Session expired after inactivity');
    _session = null;
    return null;
  }
  return {
    ..._session,
    user: {
      id: _session.userId,
      username: _session.username,
      displayName: _session.displayName,
      role: _session.role,
      email: _session.email,
      createdAt: '',       // not tracked in session
      lastLogin: undefined,
    },
  };
}

export function heartbeat(): void {
  if (_session) _session.lastActivity = Date.now();
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function requireAuth(): void {
  if (!isAuthenticated()) {
    throw new Error('AUTH_REQUIRED');
  }
}

export function getSessionRole(): string | null {
  const s = getSession();
  return s ? s.role : null;
}

export function setSessionTimeout(minutes: number): void {
  _sessionTimeoutMinutes = minutes;
}

// ── Password reset (by username + email) ───────────────────────
// Import email service
import { sendVerificationCode, verifyCode, clearVerificationCode, hasValidCode } from './emailService';

/**
 * Request password reset - sends verification code via email
 */
export async function requestPasswordReset(
  username: string,
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const users = getAllUsers();
  const target = users.find((u) => u.username === username);
  if (!target) return { success: false, error: 'Username not found' };
  if (
    !target.email ||
    target.email.toLowerCase() !== email.toLowerCase()
  ) {
    return { success: false, error: 'Email does not match the account' };
  }

  // Send verification code via email
  const result = await sendVerificationCode(target.email, username);
  return result;
}

/**
 * Verify code and complete password reset
 */
export function verifyAndResetPassword(
  username: string,
  code: string,
  newPassword: string,
): { success: boolean; error?: string } {
  // Verify the code
  const verifyResult = verifyCode(username, code);
  if (!verifyResult.success) {
    return verifyResult;
  }

  // Find user and update password
  const users = getAllUsers();
  const target = users.find((u) => u.username === username);
  if (!target) return { success: false, error: 'user_not_found' };

  // Update password
  target.passwordHash = hashPassword(newPassword);
  dbUpsert('users', target.id, target);

  // Clear verification code
  clearVerificationCode(username);

  return { success: true };
}

/**
 * Check if user has a valid verification code (for UI state)
 */
export function checkVerificationCode(username: string): boolean {
  return hasValidCode(username);
}

// ── User management (owner-only, called from IPC) ──────────────

export function getUsers_safe(): SafeUser[] {
  return getAllUsers().map(stripHash);
}

export function createUser(data: {
  username: string;
  password: string;
  displayName: string;
  role: string;
  email?: string;
}): { success: boolean; user?: SafeUser; error?: string } {
  const users = getAllUsers();
  if (users.find((u) => u.username.toLowerCase() === data.username.trim().toLowerCase())) {
    return { success: false, error: 'Username already exists' };
  }

  const now = new Date().toISOString();
  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    username: data.username.trim(),
    passwordHash: hashPassword(data.password),
    displayName: data.displayName.trim() || data.username.trim(),
    role: data.role,
    email: data.email?.trim() || undefined,
    createdAt: now,
  };

  dbUpsert('users', newUser.id, newUser);
  return { success: true, user: stripHash(newUser) };
}

export function deleteUserById(userId: string): { success: boolean; error?: string } {
  dbDelete('users', userId);
  return { success: true };
}

export function updateUserById(userId: string, data: {
  displayName?: string;
  role?: string;
  email?: string;
  password?: string;
}): { success: boolean; user?: SafeUser; error?: string } {
  const users = getAllUsers();
  const existing = users.find(u => u.id === userId);
  if (!existing) return { success: false, error: 'User not found' };

  const updated: StoredUser = {
    ...existing,
    displayName: data.displayName?.trim() || existing.displayName,
    role: data.role || existing.role,
    email: data.email?.trim() || existing.email,
    passwordHash: data.password ? hashPassword(data.password) : existing.passwordHash,
  };

  dbUpsert('users', updated.id, updated);
  return { success: true, user: stripHash(updated) };
}

// ── Ensure admin user on first launch ──────────────────────────

export function ensureAdminUser(): void {
  const users = getAllUsers();

  if (users.length === 0) {
    const now = new Date().toISOString();
    const admin: StoredUser = {
      id: crypto.randomUUID(),
      username: 'admin',
      passwordHash: hashPassword('admin'),
      displayName: 'Owner',
      role: 'owner',
      email: 'admin@RIC_Library.local',
      createdAt: now,
    };
    dbUpsert('users', admin.id, admin);
    console.log('[auth] Created default admin user (admin/admin)');
    return;
  }

  if (!users.some((u) => u.username.toLowerCase() === 'admin')) {
    const now = new Date().toISOString();
    const admin: StoredUser = {
      id: crypto.randomUUID(),
      username: 'admin',
      passwordHash: hashPassword('admin'),
      displayName: 'Owner',
      role: 'owner',
      email: 'admin@RIC_Library.local',
      createdAt: now,
    };
    dbUpsert('users', admin.id, admin);
    console.log('[auth] Created missing admin user');
  }
}
