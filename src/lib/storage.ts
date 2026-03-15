/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * storage.ts  –  In-memory data store backed by SQLite via Electron IPC.
 *
 * Architecture
 * ────────────
 * • All entity data lives in module-level arrays (fast synchronous reads).
 * • On startup `initializeStorage()` loads everything from SQLite (one IPC
 *   round-trip).  If the SQLite database is empty but localStorage still
 *   contains legacy data the migration path copies it across automatically.
 * • Every mutation updates the in-memory array **and** fires an IPC write to
 *   SQLite (fire-and-forget – local DB writes are virtually instant).
 * • Session-only values (current user, last activity) stay in localStorage
 *   because they are not business data.
 */

import {
  Product, Transaction, Customer, User, AppSettings, DEFAULT_SETTINGS,
  BackupData, Supplier, PurchaseOrder, Expense, AuditLog, AuditAction, StockEntry,
} from '@/types/pos';

// ═════════════════════════════════════════════════════════════════
// IN-MEMORY STORES
// ═════════════════════════════════════════════════════════════════
let _products: Product[] = [];
let _transactions: Transaction[] = [];
let _customers: Customer[] = [];
let _users: User[] = [];
let _suppliers: Supplier[] = [];
let _purchaseOrders: PurchaseOrder[] = [];
let _expenses: Expense[] = [];
let _auditLogs: AuditLog[] = [];
let _stockEntries: StockEntry[] = [];
let _settings: AppSettings = { ...DEFAULT_SETTINGS };
let _initialized = false;

// ═════════════════════════════════════════════════════════════════
// RESET (for testing only — clears all in-memory state)
// ═════════════════════════════════════════════════════════════════
export function resetStorageForTesting(): void {
  _products = [];
  _transactions = [];
  _customers = [];
  _users = [];
  _suppliers = [];
  _purchaseOrders = [];
  _expenses = [];
  _auditLogs = [];
  _stockEntries = [];
  _settings = { ...DEFAULT_SETTINGS };
  _initialized = false;
}

// ═════════════════════════════════════════════════════════════════
// PERSISTENCE HELPERS
// ═════════════════════════════════════════════════════════════════
function useIPC(): boolean {
  return !!window.electronAPI?.db;
}

/** Fire-and-forget: replace entire table in SQLite */
function persistTable(table: string, items: { id: string }[]) {
  if (useIPC()) window.electronAPI!.db.saveAll(table, items).catch(console.error);
}

/** Fire-and-forget: upsert a single row */
function persistUpsert(table: string, item: { id: string }) {
  if (useIPC()) window.electronAPI!.db.upsert(table, item.id, item).catch(console.error);
}

/** Fire-and-forget: delete a single row */
function persistDelete(table: string, id: string) {
  if (useIPC()) window.electronAPI!.db.delete(table, id).catch(console.error);
}

/** Fire-and-forget: save a setting value */
function persistSetting(key: string, value: string) {
  if (useIPC()) window.electronAPI!.db.saveSetting(key, value).catch(console.error);
}

// ═════════════════════════════════════════════════════════════════
// INITIALIZATION  (called once before React renders)
// ═════════════════════════════════════════════════════════════════
export async function initializeStorage(): Promise<void> {
  if (_initialized) return;

  if (useIPC()) {
    try {
      const data: Record<string, unknown> = await window.electronAPI!.db.loadAll();

      const hasData = Array.isArray(data.users) && (data.users as unknown[]).length > 0;

      if (!hasData) {
        // ── Migrate from localStorage if present ─────────────
        const lsUsers = localStorage.getItem('pos_users');
        if (lsUsers) {
          console.info('[storage] Migrating localStorage → SQLite …');
          _products = JSON.parse(localStorage.getItem('pos_products') || '[]');
          _transactions = JSON.parse(localStorage.getItem('pos_transactions') || '[]');
          _customers = JSON.parse(localStorage.getItem('pos_customers') || '[]');
          _users = JSON.parse(localStorage.getItem('pos_users') || '[]');
          _suppliers = JSON.parse(localStorage.getItem('pos_suppliers') || '[]');
          _purchaseOrders = JSON.parse(localStorage.getItem('pos_purchase_orders') || '[]');
          _expenses = JSON.parse(localStorage.getItem('pos_expenses') || '[]');
          _auditLogs = JSON.parse(localStorage.getItem('pos_audit_logs') || '[]');
          const rawSettings = localStorage.getItem('pos_settings');
          if (rawSettings) _settings = { ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) };

          // Persist to SQLite
          await window.electronAPI!.db.saveAll('products', _products);
          await window.electronAPI!.db.saveAll('transactions', _transactions);
          await window.electronAPI!.db.saveAll('customers', _customers);
          await window.electronAPI!.db.saveAll('users', _users);
          await window.electronAPI!.db.saveAll('suppliers', _suppliers);
          await window.electronAPI!.db.saveAll('purchase_orders', _purchaseOrders);
          await window.electronAPI!.db.saveAll('expenses', _expenses);
          await window.electronAPI!.db.saveAll('audit_logs', _auditLogs);
          await window.electronAPI!.db.saveSetting('app_settings', JSON.stringify(_settings));
          console.info('[storage] Migration complete');
        }
      } else {
        // ── Load from SQLite ─────────────────────────────────
        _products = (data.products ?? []) as Product[];
        _transactions = (data.transactions ?? []) as Transaction[];
        _customers = (data.customers ?? []) as Customer[];
        _users = (data.users ?? []) as User[];
        _suppliers = (data.suppliers ?? []) as Supplier[];
        _purchaseOrders = (data.purchase_orders ?? []) as PurchaseOrder[];
        _expenses = (data.expenses ?? []) as Expense[];
        _auditLogs = (data.audit_logs ?? []) as AuditLog[];
        _stockEntries = (data.stock_entries ?? []) as StockEntry[];
        if (data.settings) _settings = { ...DEFAULT_SETTINGS, ...(data.settings as Partial<AppSettings>) };
      }
    } catch (err) {
      console.error('[storage] Failed to load from SQLite, starting empty:', err);
    }
  }

  _initialized = true;
}

export function isStorageInitialized(): boolean {
  return _initialized;
}

// ═════════════════════════════════════════════════════════════════
// ID GENERATOR (cryptographically secure)
// ═════════════════════════════════════════════════════════════════
export function generateId(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(36).padStart(2, '0')).join('').slice(0, 18);
}

// ═════════════════════════════════════════════════════════════════
// INPUT SANITIZATION (hardened against XSS vectors)
// ═════════════════════════════════════════════════════════════════
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')             // strip HTML angle brackets
    .replace(/javascript\s*:/gi, '')  // block javascript: URIs
    .replace(/data\s*:\s*text\/html/gi, '')  // block data: HTML URIs
    .replace(/vbscript\s*:/gi, '')    // block vbscript: URIs
    .replace(/on\w+\s*=/gi, '')       // strip inline event handlers
    .replace(/expression\s*\(/gi, '') // block CSS expression()
    .replace(/url\s*\(/gi, '')        // block CSS url()
    .replace(/import\s*\(/gi, '')     // block dynamic import()
    .replace(/eval\s*\(/gi, '')       // block eval()
    .replace(/Function\s*\(/gi, '')   // block Function constructor
    .trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeInput(sanitized[key] as string);
    }
  }
  return sanitized;
}

// ═════════════════════════════════════════════════════════════════
// PASSWORD HASHING  →  MOVED TO MAIN PROCESS (electron/auth.ts)
// ═════════════════════════════════════════════════════════════════
// All password hashing, verification, brute-force protection and
// session management now run in the Electron main process using
// Node.js crypto.scryptSync.  The renderer never sees password hashes.

// ═════════════════════════════════════════════════════════════════
// AUDIT LOGGING
// ═════════════════════════════════════════════════════════════════
export function getAuditLogs(): AuditLog[] {
  return _auditLogs;
}

export function addAuditLog(
  action: AuditAction,
  details: string,
  userId?: string,
  userName?: string,
) {
  const entry: AuditLog = {
    id: generateId(),
    action,
    userId,
    userName,
    details,
    timestamp: new Date().toISOString(),
  };
  _auditLogs.unshift(entry);
  if (_auditLogs.length > 1000) _auditLogs.length = 1000;
  persistTable('audit_logs', _auditLogs);
  return entry;
}

// ═════════════════════════════════════════════════════════════════
// PRODUCTS
// ═════════════════════════════════════════════════════════════════
export function getProducts(): Product[] {
  return _products;
}

export function saveProducts(products: Product[]) {
  _products = products;
  persistTable('products', _products);
}

export function addProduct(product: Product) {
  _products.push(product);
  persistUpsert('products', product);
  return [..._products];
}

export function updateProduct(updated: Product) {
  _products = _products.map(p =>
    p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p,
  );
  const item = _products.find(p => p.id === updated.id);
  if (item) persistUpsert('products', item);
  return [..._products];
}

export function deleteProduct(id: string) {
  _products = _products.filter(p => p.id !== id);
  persistDelete('products', id);
  return [..._products];
}

export function bulkAddProducts(newProducts: Product[]) {
  _products.push(...newProducts);
  persistTable('products', _products);
  return [..._products];
}

// ═════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═════════════════════════════════════════════════════════════════
export function getTransactions(): Transaction[] {
  return _transactions;
}

export function saveTransaction(transaction: Transaction) {
  _transactions.unshift(transaction);
  persistUpsert('transactions', transaction);
  return [..._transactions];
}

export function saveAllTransactions(transactions: Transaction[]) {
  _transactions = transactions;
  persistTable('transactions', _transactions);
}

export function refundTransaction(txId: string): Transaction[] {
  _transactions = _transactions.map(tx =>
    tx.id === txId ? { ...tx, refunded: true, refundedAt: new Date().toISOString() } : tx,
  );
  const refundedTx = _transactions.find(tx => tx.id === txId);
  if (refundedTx) {
    persistUpsert('transactions', refundedTx);
    // Restore stock
    _products = _products.map(p => {
      const item = refundedTx.items.find(i => i.product.id === p.id);
      if (item && p.category !== 'services') {
        return { ...p, quantity: p.quantity + item.quantity, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    persistTable('products', _products);
  }
  return [..._transactions];
}

// ═════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═════════════════════════════════════════════════════════════════
export function getCustomers(): Customer[] {
  return _customers;
}

export function saveCustomers(customers: Customer[]) {
  _customers = customers;
  persistTable('customers', _customers);
}

export function addCustomer(customer: Customer) {
  _customers.push(customer);
  persistUpsert('customers', customer);
  return [..._customers];
}

export function updateCustomer(updated: Customer) {
  _customers = _customers.map(c =>
    c.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : c,
  );
  const item = _customers.find(c => c.id === updated.id);
  if (item) persistUpsert('customers', item);
  return [..._customers];
}

export function deleteCustomer(id: string) {
  _customers = _customers.filter(c => c.id !== id);
  persistDelete('customers', id);
  return [..._customers];
}

// ═════════════════════════════════════════════════════════════════
// USERS
// ═════════════════════════════════════════════════════════════════
export function getUsers(): User[] {
  return _users;
}

export function saveUsers(users: User[]) {
  _users = users;
  persistTable('users', _users);
}

export function addUser(user: User) {
  if (_users.find(u => u.username === user.username)) {
    throw new Error('Username already exists');
  }
  _users.push(user);
  persistUpsert('users', user);
  return [..._users];
}

export function updateUser(updated: User) {
  _users = _users.map(u => (u.id === updated.id ? updated : u));
  persistUpsert('users', updated);
  return [..._users];
}

export function deleteUser(id: string) {
  _users = _users.filter(u => u.id !== id);
  persistDelete('users', id);
  return [..._users];
}

// ── Authentication & brute-force protection ─────────────────────
// MOVED to Electron main process (electron/auth.ts).
// Login, password hashing, session management and brute-force
// protection all run in the main process and are accessed via
// window.electronAPI.auth.*  IPC calls.

// ═════════════════════════════════════════════════════════════════
// SETTINGS
// ═════════════════════════════════════════════════════════════════
export function getSettings(): AppSettings {
  return { ..._settings };
}

export function saveSettings(settings: AppSettings) {
  _settings = { ...settings };
  persistSetting('app_settings', JSON.stringify(_settings));
}

// ═════════════════════════════════════════════════════════════════
// SUPPLIERS
// ═════════════════════════════════════════════════════════════════
export function getSuppliers(): Supplier[] {
  return _suppliers;
}

export function saveSuppliers(suppliers: Supplier[]) {
  _suppliers = suppliers;
  persistTable('suppliers', _suppliers);
}

export function addSupplier(supplier: Supplier) {
  _suppliers.push(supplier);
  persistUpsert('suppliers', supplier);
  return [..._suppliers];
}

export function updateSupplier(updated: Supplier) {
  _suppliers = _suppliers.map(s =>
    s.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : s,
  );
  const item = _suppliers.find(s => s.id === updated.id);
  if (item) persistUpsert('suppliers', item);
  return [..._suppliers];
}

export function deleteSupplier(id: string) {
  _suppliers = _suppliers.filter(s => s.id !== id);
  persistDelete('suppliers', id);
  return [..._suppliers];
}

// ═════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═════════════════════════════════════════════════════════════════
export function getPurchaseOrders(): PurchaseOrder[] {
  return _purchaseOrders;
}

export function savePurchaseOrders(orders: PurchaseOrder[]) {
  _purchaseOrders = orders;
  persistTable('purchase_orders', _purchaseOrders);
}

export function addPurchaseOrder(order: PurchaseOrder) {
  _purchaseOrders.unshift(order);
  persistUpsert('purchase_orders', order);
  return [..._purchaseOrders];
}

export function updatePurchaseOrder(updated: PurchaseOrder) {
  _purchaseOrders = _purchaseOrders.map(o =>
    o.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : o,
  );
  const item = _purchaseOrders.find(o => o.id === updated.id);
  if (item) persistUpsert('purchase_orders', item);
  return [..._purchaseOrders];
}

export function receivePurchaseOrder(orderId: string): PurchaseOrder[] {
  const orderIdx = _purchaseOrders.findIndex(o => o.id === orderId);
  if (orderIdx === -1) return [..._purchaseOrders];

  const order = _purchaseOrders[orderIdx];
  const now = new Date().toISOString();
  _purchaseOrders[orderIdx] = { ...order, status: 'received', receivedDate: now, updatedAt: now };
  persistUpsert('purchase_orders', _purchaseOrders[orderIdx]);

  // Update product stock
  order.items.forEach(item => {
    const pIdx = _products.findIndex(p => p.id === item.productId);
    if (pIdx !== -1) {
      _products[pIdx] = {
        ..._products[pIdx],
        quantity: _products[pIdx].quantity + item.quantity,
        cost: item.unitCost,
        updatedAt: now,
      };
      persistUpsert('products', _products[pIdx]);
    }
  });

  return [..._purchaseOrders];
}

// ═════════════════════════════════════════════════════════════════
// EXPENSES
// ═════════════════════════════════════════════════════════════════
export function getExpenses(): Expense[] {
  return _expenses;
}

export function saveExpenses(expenses: Expense[]) {
  _expenses = expenses;
  persistTable('expenses', _expenses);
}

export function addExpense(expense: Expense) {
  _expenses.unshift(expense);
  persistUpsert('expenses', expense);
  return [..._expenses];
}

export function updateExpense(updated: Expense) {
  _expenses = _expenses.map(e =>
    e.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : e,
  );
  const item = _expenses.find(e => e.id === updated.id);
  if (item) persistUpsert('expenses', item);
  return [..._expenses];
}

export function deleteExpense(id: string) {
  _expenses = _expenses.filter(e => e.id !== id);
  persistDelete('expenses', id);
  return [..._expenses];
}

// ═════════════════════════════════════════════════════════════════
// STOCK ENTRIES
// ═════════════════════════════════════════════════════════════════
export function getStockEntries(): StockEntry[] {
  return _stockEntries;
}

export function addStockEntry(entry: StockEntry): StockEntry[] {
  _stockEntries.unshift(entry);
  persistUpsert('stock_entries', entry);
  // Also update the product quantity
  _products = _products.map(p =>
    p.id === entry.productId
      ? { ...p, quantity: p.quantity + entry.quantity, updatedAt: new Date().toISOString() }
      : p,
  );
  const updated = _products.find(p => p.id === entry.productId);
  if (updated) persistUpsert('products', updated);
  return [..._stockEntries];
}

export function getStockEntriesForProduct(productId: string): StockEntry[] {
  return _stockEntries.filter(e => e.productId === productId);
}

// ═════════════════════════════════════════════════════════════════
// LOW STOCK ALERTS
// ═════════════════════════════════════════════════════════════════
export function getLowStockProducts(): Product[] {
  return _products.filter(p => p.quantity <= p.lowStockThreshold && p.category !== 'services');
}

export function checkAndNotifyLowStock() {
  const lowStock = getLowStockProducts();
  if (lowStock.length > 0 && window.electronAPI) {
    window.electronAPI.showNotification(
      'Low Stock Alert',
      `${lowStock.length} item(s) are running low: ${lowStock.slice(0, 3).map(p => p.name).join(', ')}${lowStock.length > 3 ? '...' : ''}`,
    );
  }
}

// ═════════════════════════════════════════════════════════════════
// BACKUP / RESTORE
// ═════════════════════════════════════════════════════════════════
export function exportAllData(): BackupData {
  return {
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    products: _products,
    transactions: _transactions,
    customers: _customers,
    users: _users,
    settings: _settings,
    suppliers: _suppliers,
    purchaseOrders: _purchaseOrders,
    expenses: _expenses,
    auditLogs: _auditLogs,
    stockEntries: _stockEntries,
  };
}

export function importAllData(data: BackupData) {
  if (data.products) { _products = data.products; persistTable('products', _products); }
  if (data.transactions) { _transactions = data.transactions; persistTable('transactions', _transactions); }
  if (data.customers) { _customers = data.customers; persistTable('customers', _customers); }
  if (data.users) { _users = data.users; persistTable('users', _users); }
  if (data.settings) { _settings = { ...DEFAULT_SETTINGS, ...data.settings }; persistSetting('app_settings', JSON.stringify(_settings)); }
  if (data.suppliers) { _suppliers = data.suppliers; persistTable('suppliers', _suppliers); }
  if (data.purchaseOrders) { _purchaseOrders = data.purchaseOrders; persistTable('purchase_orders', _purchaseOrders); }
  if (data.expenses) { _expenses = data.expenses; persistTable('expenses', _expenses); }
  if (data.auditLogs) { _auditLogs = data.auditLogs; persistTable('audit_logs', _auditLogs); }
  if (data.stockEntries) { _stockEntries = data.stockEntries; persistTable('stock_entries', _stockEntries); }
}

// ═════════════════════════════════════════════════════════════════
// SEED DATA
// ═════════════════════════════════════════════════════════════════
/**
 * Dev-only hash (same legacy v2_ algorithm used in browser fallback auth).
 * Only called from seedDemoData for browser-only dev mode.
 */
function devHashPassword(password: string): string {
  const salt = 'ric_library_salt_v3_secure';
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

export function seedDemoData() {
  // In Electron, user management is handled by ensureAdminUser() in the
  // main process.  In browser-only dev mode, we need to seed a default
  // admin here so the dev fallback auth works.
  if (!useIPC() && _users.length === 0) {
    const now = new Date().toISOString();
    _users = [{
      id: generateId(),
      username: 'admin',
      passwordHash: devHashPassword('admin'),
      displayName: 'Owner',
      role: 'owner',
      email: 'admin@riadhlibrary.local',
      createdAt: now,
    }];
  }

  if (_products.length > 0) return;

  const now = new Date().toISOString();
  const demoProducts: Product[] = [
    { id: generateId(), name: 'The Great Gatsby', category: 'books', price: 25.000, cost: 15.000, quantity: 12, lowStockThreshold: 3, author: 'F. Scott Fitzgerald', isbn: '978-0743273565', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Pilot G2 Pen (Black)', category: 'writing', price: 3.500, cost: 1.800, quantity: 45, lowStockThreshold: 10, brand: 'Pilot', color: 'Black', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Pilot G2 Pen (Blue)', category: 'writing', price: 3.500, cost: 1.800, quantity: 38, lowStockThreshold: 10, brand: 'Pilot', color: 'Blue', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'HB Pencil Pack (12)', category: 'writing', price: 4.200, cost: 2.000, quantity: 25, lowStockThreshold: 5, brand: 'Staedtler', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'A4 Notebook (Ruled)', category: 'paper', price: 6.800, cost: 3.500, quantity: 30, lowStockThreshold: 8, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'A4 Printer Paper (500 sheets)', category: 'paper', price: 12.000, cost: 7.500, quantity: 15, lowStockThreshold: 5, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'B&W Printing (per page)', category: 'services', price: 0.150, cost: 0.050, quantity: 9999, lowStockThreshold: 0, serviceType: 'printing-bw', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Color Printing (per page)', category: 'services', price: 0.500, cost: 0.200, quantity: 9999, lowStockThreshold: 0, serviceType: 'printing-color', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Sticky Notes (Pack)', category: 'paper', price: 2.500, cost: 1.200, quantity: 2, lowStockThreshold: 5, createdAt: now, updatedAt: now },
    { id: generateId(), name: '1984', category: 'books', price: 18.500, cost: 10.000, quantity: 8, lowStockThreshold: 3, author: 'George Orwell', isbn: '978-0451524935', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Bic Cristal Pen (Red)', category: 'writing', price: 1.200, cost: 0.500, quantity: 60, lowStockThreshold: 15, brand: 'Bic', color: 'Red', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'A5 Spiral Notebook', category: 'paper', price: 4.500, cost: 2.200, quantity: 20, lowStockThreshold: 5, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'To Kill a Mockingbird', category: 'books', price: 22.000, cost: 12.000, quantity: 6, lowStockThreshold: 2, author: 'Harper Lee', isbn: '978-0061120084', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Colored Pencils Set (24)', category: 'writing', price: 15.000, cost: 8.000, quantity: 10, lowStockThreshold: 3, brand: 'Faber-Castell', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Binding (Spiral)', category: 'services', price: 2.000, cost: 0.800, quantity: 9999, lowStockThreshold: 0, serviceType: 'binding-spiral', createdAt: now, updatedAt: now },
  ];

  _products = demoProducts;
  persistTable('products', _products);
}
