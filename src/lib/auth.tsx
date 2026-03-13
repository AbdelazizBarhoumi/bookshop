import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, ROLE_PERMISSIONS } from '@/types/pos';
import { addAuditLog, getUsers, saveUsers } from '@/lib/storage';

/**
 * AUTH ARCHITECTURE
 * ─────────────────
 * Authentication, password hashing, brute-force protection and session
 * management now run in the Electron **main process** (`electron/auth.ts`).
 *
 * The renderer only calls `window.electronAPI.auth.*` IPC methods.
 * Password hashes never reach the renderer.
 *
 * BROWSER-ONLY DEV FALLBACK
 * When running `vite` in a regular browser (no Electron), there is no
 * `window.electronAPI`.  In that case a lightweight in-memory fallback
 * authenticates against the `_users` array in storage.ts using a simple
 * hash so you can still test the UI.  This is dev-only; the production
 * Electron build always uses the secure main-process path.
 */

// ── Browser-only dev fallback ──────────────────────────────────
function devHashPassword(password: string): string {
  const salt = 'riadh_library_salt_v3_secure';
  const input = salt + password + salt;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let round = 0; round < 200; round++) {
    const roundInput = round === 0 ? input : `${h1.toString(16)}:${input}:${h2.toString(16)}`;
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

/** Dev-only: authenticate against in-memory users array */
function devAuthenticate(username: string, password: string): User | null {
  const norm = username.trim().toLowerCase();
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === norm);
  if (!user) return null;
  const hash = devHashPassword(password);
  if (user.passwordHash === hash) {
    user.lastLogin = new Date().toISOString();
    return user;
  }
  return null;
}

function isElectronAuth(): boolean {
  return !!window.electronAPI?.auth;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (page: string) => boolean;
  resetPassword: (username: string, email: string) => Promise<{ success: boolean; newPassword?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: () => {},
  hasPermission: () => false,
  resetPassword: async () => ({ success: false }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  // On mount, check if the main process still has an active session
  useEffect(() => {
    async function restoreSession() {
      if (window.electronAPI?.auth) {
        const session = await window.electronAPI.auth.getSession();
        if (session?.user) {
          // Map SafeUser → User (passwordHash is empty — never exposed)
          setUser({
            id: session.user.id,
            username: session.user.username,
            passwordHash: '',           // not available in renderer
            displayName: session.user.displayName,
            role: session.user.role as User['role'],
            email: session.user.email,
            createdAt: session.user.createdAt,
            lastLogin: session.user.lastLogin,
          });
        }
      }
      setInitialized(true);
    }
    restoreSession();
  }, []);

  // Session timeout checker — pings main process every 60 s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      if (window.electronAPI?.auth) {
        const session = await window.electronAPI.auth.getSession();
        if (!session) {
          // Session expired in main process
          addAuditLog('logout', 'Session expired (auto-logout after inactivity)', user.id, user.displayName);
          setUser(null);
        }
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Track user activity → heartbeat to main process
  useEffect(() => {
    if (!user || !window.electronAPI?.auth) return;
    const handleActivity = () => window.electronAPI!.auth.heartbeat();
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    // Throttle mousemove to avoid flooding IPC
    let lastMove = 0;
    const handleMouseMove = () => {
      const now = Date.now();
      if (now - lastMove > 30_000) {   // at most once per 30 s
        lastMove = now;
        window.electronAPI!.auth.heartbeat();
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [user]);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    if (isElectronAuth()) {
      // ── Secure path: main-process auth via IPC ──
      const result = await window.electronAPI!.auth.login(username, password);

      if (result.success && result.user) {
        const u: User = {
          id: result.user.id,
          username: result.user.username,
          passwordHash: '',
          displayName: result.user.displayName,
          role: result.user.role as User['role'],
          email: result.user.email,
          createdAt: result.user.createdAt,
          lastLogin: result.user.lastLogin,
        };
        setUser(u);
        addAuditLog('login', `User "${u.displayName}" logged in`, u.id, u.displayName);
        return true;
      }

      addAuditLog('login_failed', `Failed login attempt for username "${username}"`);
      return false;
    }

    // ── Browser-only dev fallback (not used in production Electron build) ──
    console.warn('[auth] No electronAPI — using browser-only dev fallback');
    const authed = devAuthenticate(username, password);
    if (authed) {
      setUser(authed);
      addAuditLog('login', `User "${authed.displayName}" logged in`, authed.id, authed.displayName);
      return true;
    }
    addAuditLog('login_failed', `Failed login attempt for username "${username}"`);
    return false;
  }, []);

  const logout = useCallback(() => {
    if (user) {
      addAuditLog('logout', `User "${user.displayName}" logged out`, user.id, user.displayName);
    }
    if (window.electronAPI?.auth) {
      window.electronAPI.auth.logout();
    }
    setUser(null);
  }, [user]);

  const hasPermission = useCallback((page: string): boolean => {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(page) || false;
  }, [user]);

  const resetPassword = useCallback(async (username: string, email: string): Promise<{ success: boolean; newPassword?: string; error?: string }> => {
    if (isElectronAuth()) {
      const result = await window.electronAPI!.auth.resetPassword(username, email);
      if (result.success) {
        addAuditLog('settings_change', `Password reset for user "${username}"`);
      }
      return result;
    }
    // ── Browser-only dev fallback ──
    const users = getUsers();
    const target = users.find(u => u.username === username);
    if (!target) return { success: false, error: 'Username not found' };
    if (!target.email || target.email.toLowerCase() !== email.toLowerCase()) {
      return { success: false, error: 'Email does not match the account' };
    }
    const tempPassword = 'reset_' + Math.random().toString(36).substr(2, 6);
    target.passwordHash = devHashPassword(tempPassword);
    saveUsers(users);
    addAuditLog('settings_change', `Password reset for user "${username}"`);
    return { success: true, newPassword: tempPassword };
  }, []);

  if (!initialized) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
