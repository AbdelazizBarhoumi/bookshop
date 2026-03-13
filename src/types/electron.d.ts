// ── Safe user object (never contains passwordHash) ──
interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  email?: string;
  createdAt: string;
  lastLogin?: string;
}

// ── Auth API (runs in main process) ──
interface ElectronAuthAPI {
  login: (username: string, password: string) => Promise<{
    success: boolean;
    user?: SafeUser;
    error?: string;
    lockedMs?: number;
  }>;
  logout: () => Promise<{ success: boolean }>;
  getSession: () => Promise<{
    userId: string;
    username: string;
    displayName: string;
    role: string;
    email?: string;
    loginTime: number;
    lastActivity: number;
    user: SafeUser;
  } | null>;
  heartbeat: () => Promise<boolean>;
  resetPassword: (username: string, email: string) => Promise<{
    success: boolean;
    newPassword?: string;
    error?: string;
  }>;
}

// ── User management API (passwords hashed in main process) ──
interface ElectronUsersAPI {
  getAll: () => Promise<SafeUser[]>;
  create: (data: {
    username: string;
    password: string;
    displayName: string;
    role: string;
    email?: string;
  }) => Promise<{ success: boolean; user?: SafeUser; error?: string }>;
  delete: (userId: string) => Promise<{ success: boolean; error?: string }>;
  update: (userId: string, data: {
    displayName?: string;
    role?: string;
    email?: string;
    password?: string;
  }) => Promise<{ success: boolean; user?: SafeUser; error?: string }>;
}

interface ElectronDbAPI {
  loadAll: () => Promise<Record<string, unknown>>;
  getAll: (table: string) => Promise<unknown[]>;
  upsert: (table: string, id: string, data: unknown) => Promise<void>;
  delete: (table: string, id: string) => Promise<void>;
  saveAll: (table: string, items: unknown[]) => Promise<void>;
  getSetting: (key: string) => Promise<string | null>;
  saveSetting: (key: string, value: string) => Promise<void>;
  importAll: (data: Record<string, unknown[]>) => Promise<void>;
}

interface ElectronAPI {
  auth: ElectronAuthAPI;
  users: ElectronUsersAPI;
  db: ElectronDbAPI;
  showNotification: (title: string, body: string) => void;
  backupData: (json: string) => Promise<{ success: boolean; path?: string }>;
  autoBackup: (json: string) => Promise<{ success: boolean }>;
  restoreData: () => Promise<{ success: boolean; data?: string }>;
  exportFile?: (data: string, filename: string) => Promise<{ success: boolean }>;
  importCSV: () => Promise<{ success: boolean; data?: string }>;
  printReceipt: (html: string) => Promise<void>;
  getAppVersion?: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
