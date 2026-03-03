import { describe, it, expect, beforeEach, vi } from 'vitest';

// Ensure window exists in node-like test environment
if (typeof window === 'undefined') {
  // vitest may default to node environment; create a minimal window object
  (global as any).window = {};
}

// Mock localStorage before importing storage so the module sees it
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Notification API
Object.defineProperty(window, 'Notification', {
  value: { permission: 'denied', requestPermission: vi.fn() },
  writable: true,
});

import {
  generateId,
  hashPassword,
  sanitizeInput,
  sanitizeObject,
  authenticateUser,
  getProducts,
  saveProducts,
  saveUsers,
  getSuppliers,
  addSupplier,
  deleteSupplier,
  getExpenses,
  addExpense,
  deleteExpense,
  getAuditLogs,
  addAuditLog,
  getTransactions,
  getCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  exportAllData,
  importAllData,
  getSettings,
  saveSettings,
  seedDemoData,
  updateLastActivity,
  getLastActivity,
  isSessionExpired,
} from '@/lib/storage';
import { DEFAULT_SETTINGS } from '@/types/pos';

describe('generateId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('generates string IDs of reasonable length', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(5);
  });
});

describe('hashPassword', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = hashPassword('testpassword');
    const hash2 = hashPassword('testpassword');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', () => {
    const hash1 = hashPassword('password1');
    const hash2 = hashPassword('password2');
    expect(hash1).not.toBe(hash2);
  });

  it('returns non-empty string', () => {
    expect(hashPassword('test').length).toBeGreaterThan(0);
  });

  it('has a recognizable prefix', () => {
    const hash = hashPassword('test');
    expect(hash.startsWith('sha_')).toBe(true);
  });
});

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('strips HTML angle brackets', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
  });

  it('handles empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('preserves normal text', () => {
    expect(sanitizeInput('Hello World 123')).toBe('Hello World 123');
  });
});

describe('sanitizeObject', () => {
  it('sanitizes all string values in an object', () => {
    const result = sanitizeObject({ name: '  <b>Test</b>  ', age: 25 });
    expect(result.name).toBe('bTest/b');
    expect(result.age).toBe(25);
  });

  it('does not modify non-string values', () => {
    const result = sanitizeObject({ flag: true, count: 42, items: [1, 2] });
    expect(result.flag).toBe(true);
    expect(result.count).toBe(42);
    expect(result.items).toEqual([1, 2]);
  });
});

describe('Storage CRUD operations', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Suppliers', () => {
    it('returns empty array when no suppliers exist', () => {
      expect(getSuppliers()).toEqual([]);
    });

    it('adds and retrieves suppliers', () => {
      addSupplier({ id: 's1', name: 'Test Supplier', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const suppliers = getSuppliers();
      expect(suppliers).toHaveLength(1);
      expect(suppliers[0].name).toBe('Test Supplier');
    });

    it('deletes a supplier', () => {
      addSupplier({ id: 's1', name: 'Test Supplier', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      deleteSupplier('s1');
      expect(getSuppliers()).toHaveLength(0);
    });
  });

  describe('Expenses', () => {
    it('returns empty array when no expenses exist', () => {
      expect(getExpenses()).toEqual([]);
    });

    it('adds and retrieves expenses', () => {
      addExpense({
        id: 'e1',
        description: 'Office rent',
        category: 'rent',
        amount: 500,
        date: '2024-01-15',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const expenses = getExpenses();
      expect(expenses).toHaveLength(1);
      expect(expenses[0].description).toBe('Office rent');
      expect(expenses[0].amount).toBe(500);
    });

    it('deletes an expense', () => {
      addExpense({
        id: 'e1',
        description: 'Test',
        category: 'other',
        amount: 10,
        date: '2024-01-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      deleteExpense('e1');
      expect(getExpenses()).toHaveLength(0);
    });
  });

  describe('Audit Logs', () => {
    it('returns empty array when no logs exist', () => {
      expect(getAuditLogs()).toEqual([]);
    });

    it('adds audit log entries', () => {
      addAuditLog('login', 'Test login', 'user1', 'Admin');
      const logs = getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('login');
      expect(logs[0].details).toBe('Test login');
    });

    it('keeps most recent entries first', () => {
      addAuditLog('login', 'First', 'u1', 'A');
      addAuditLog('logout', 'Second', 'u1', 'A');
      const logs = getAuditLogs();
      expect(logs[0].action).toBe('logout');
      expect(logs[1].action).toBe('login');
    });
  });

  describe('Customers', () => {
    it('returns empty array when no customers exist', () => {
      expect(getCustomers()).toEqual([]);
    });

    it('adds and retrieves customers', () => {
      addCustomer({ id: 'c1', name: 'John', phone: '123', email: '', loyaltyPoints: 0, totalPurchases: 0, joinDate: new Date().toISOString() });
      const customers = getCustomers();
      expect(customers).toHaveLength(1);
      expect(customers[0].name).toBe('John');
    });

    it('updates a customer', () => {
      addCustomer({ id: 'c1', name: 'John', phone: '123', email: '', loyaltyPoints: 0, totalPurchases: 0, joinDate: new Date().toISOString() });
      updateCustomer({ id: 'c1', name: 'John Updated', phone: '456', email: 'john@test.com', loyaltyPoints: 10, totalPurchases: 100, joinDate: new Date().toISOString() });
      const customers = getCustomers();
      expect(customers[0].name).toBe('John Updated');
      expect(customers[0].phone).toBe('456');
    });

    it('deletes a customer', () => {
      addCustomer({ id: 'c1', name: 'John', phone: '123', email: '', loyaltyPoints: 0, totalPurchases: 0, joinDate: new Date().toISOString() });
      deleteCustomer('c1');
      expect(getCustomers()).toHaveLength(0);
    });
  });

  describe('Session Management', () => {
    it('tracks last activity', () => {
      updateLastActivity();
      const lastActivity = getLastActivity();
      expect(lastActivity).toBeGreaterThan(0);
      expect(Date.now() - lastActivity).toBeLessThan(1000);
    });

    it('detects expired sessions', () => {
      // Set last activity to 20 minutes ago
      localStorage.setItem('pos_last_activity', String(Date.now() - 20 * 60 * 1000));
      expect(isSessionExpired(10)).toBe(true);
    });

    it('detects active sessions', () => {
      updateLastActivity();
      expect(isSessionExpired(10)).toBe(false);
    });
  });

  describe('Settings', () => {
    it('returns default settings when none saved', () => {
      const settings = getSettings();
      expect(settings.storeName).toBe(DEFAULT_SETTINGS.storeName);
      expect(settings.currency).toBe(DEFAULT_SETTINGS.currency);
    });

    it('saves and retrieves settings', () => {
      const custom = { ...DEFAULT_SETTINGS, storeName: 'My Bookshop' };
      saveSettings(custom);
      const retrieved = getSettings();
      expect(retrieved.storeName).toBe('My Bookshop');
    });
  });

  describe('Backup/Restore', () => {
    it('exports all data as BackupData object', () => {
      seedDemoData();
      const data = exportAllData();
      expect(data.version).toBeDefined();
      expect(data.products).toBeDefined();
      expect(data.transactions).toBeDefined();
      expect(data.customers).toBeDefined();
      expect(data.settings).toBeDefined();
      expect(data.users).toBeDefined();
    });

    it('restores data from backup object', () => {
      seedDemoData();
      const backup = exportAllData();
      localStorageMock.clear();
      expect(getProducts()).toEqual([]);
      importAllData(backup);
      expect(getProducts().length).toBeGreaterThan(0);
    });
  });
});

describe('seedDemoData', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('reset admin password in development mode', () => {
    // simulate a wrong admin password stored previously
    process.env.NODE_ENV = 'development';
    saveUsers([{ id: 'u1', username: 'admin', passwordHash: hashPassword('wrong') } as any]);
    seedDemoData();
    const admin = authenticateUser('admin', 'admin');
    expect(admin).not.toBeNull();
  });

  it('creates demo products', () => {
    seedDemoData();
    expect(getProducts().length).toBeGreaterThan(0);
  });

  it('creates default admin user', () => {
    seedDemoData();
    const data = exportAllData();
    const admin = data.users.find((u: any) => u.username === 'admin');
    expect(admin).toBeDefined();
    expect(admin.role).toBe('owner');
  });

  it('does not overwrite existing products', () => {
    seedDemoData();
    const count1 = getProducts().length;
    seedDemoData();
    const count2 = getProducts().length;
    expect(count2).toBe(count1);
  });

  it('allows authentication with default admin credentials', () => {
    seedDemoData();
    const admin = authenticateUser('admin', 'admin');
    expect(admin).not.toBeNull();
    expect(admin?.username).toBe('admin');
    expect(admin?.role).toBe('owner');

    // also check that variations of case/whitespace succeed after our normalization
    const admin2 = authenticateUser('  Admin  ', 'admin');
    expect(admin2).not.toBeNull();
  });
});
