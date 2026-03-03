import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, ROLE_PERMISSIONS } from '@/types/pos';
import { getCurrentUser, setCurrentUser, authenticateUser, updateLastActivity, isSessionExpired, getSettings, addAuditLog, getUsers, hashPassword, saveUsers } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  hasPermission: (page: string) => boolean;
  resetPassword: (username: string, email: string) => { success: boolean; newPassword?: string; error?: string };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => false,
  logout: () => {},
  hasPermission: () => false,
  resetPassword: () => ({ success: false }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // user state is kept null until we've checked localStorage so we don't flash the
  // login screen for an already‑authenticated session. `initialized` is flipped
  // once the first check is complete so the rest of the app can render safely.
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const saved = getCurrentUser();
    if (saved) {
      // Check session expiry
      const settings = getSettings();
      if (isSessionExpired(settings.sessionTimeoutMinutes)) {
        setCurrentUser(null);
        addAuditLog('logout', 'Session expired (auto-logout)', saved.id, saved.displayName);
      } else {
        setUser(saved);
        updateLastActivity();
      }
    }

    setInitialized(true);
  }, []);

  // Session timeout checker - runs every minute
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const settings = getSettings();
      if (isSessionExpired(settings.sessionTimeoutMinutes)) {
        addAuditLog('logout', 'Session expired (auto-logout after inactivity)', user.id, user.displayName);
        setUser(null);
        setCurrentUser(null);
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Track user activity
  useEffect(() => {
    if (!user) return;
    const handleActivity = () => updateLastActivity();
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousemove', handleActivity);
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
    };
  }, [user]);

  const login = useCallback((username: string, password: string): boolean => {
    const authedUser = authenticateUser(username, password);
    if (authedUser) {
      setUser(authedUser);
      setCurrentUser(authedUser);
      updateLastActivity();
      addAuditLog('login', `User "${authedUser.displayName}" logged in`, authedUser.id, authedUser.displayName);
      return true;
    }
    addAuditLog('login_failed', `Failed login attempt for username "${username}"`);
    return false;
  }, []);

  const logout = useCallback(() => {
    if (user) {
      addAuditLog('logout', `User "${user.displayName}" logged out`, user.id, user.displayName);
    }
    setUser(null);
    setCurrentUser(null);
  }, [user]);

  const hasPermission = useCallback((page: string): boolean => {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(page) || false;
  }, [user]);

  const resetPassword = useCallback((username: string, email: string): { success: boolean; newPassword?: string; error?: string } => {
    const users = getUsers();
    const target = users.find(u => u.username === username);
    if (!target) return { success: false, error: 'Username not found' };
    if (!target.email || target.email.toLowerCase() !== email.toLowerCase()) {
      return { success: false, error: 'Email does not match the account' };
    }
    // Generate temporary password
    const tempPassword = 'reset_' + Math.random().toString(36).substr(2, 6);
    target.passwordHash = hashPassword(tempPassword);
    saveUsers(users);
    addAuditLog('settings_change', `Password reset for user "${username}"`);
    return { success: true, newPassword: tempPassword };
  }, []);

  // don't render the app until we've finished reading localStorage; prevents a
  // spurious brief login screen on refresh when a session already exists.
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
