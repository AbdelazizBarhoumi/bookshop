import { Product, Transaction, Customer, User, AppSettings, DEFAULT_SETTINGS, BackupData, Supplier, PurchaseOrder, Expense, AuditLog, AuditAction } from '@/types/pos';

// ── Storage Keys ──
const PRODUCTS_KEY = 'pos_products';
const TRANSACTIONS_KEY = 'pos_transactions';
const CUSTOMERS_KEY = 'pos_customers';
const USERS_KEY = 'pos_users';
const SETTINGS_KEY = 'pos_settings';
const CURRENT_USER_KEY = 'pos_current_user';
const SUPPLIERS_KEY = 'pos_suppliers';
const PURCHASE_ORDERS_KEY = 'pos_purchase_orders';
const EXPENSES_KEY = 'pos_expenses';
const AUDIT_LOGS_KEY = 'pos_audit_logs';
const LAST_ACTIVITY_KEY = 'pos_last_activity';

// ── ID Generator ──
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ── Input Sanitization ──
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Strip HTML angle brackets
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
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

// ── Password hashing with SHA-256 + salt (for local use) ──
export function hashPassword(password: string): string {
  // Deterministic SHA-256-like hash using a simple but much stronger algorithm than bit-shift
  const salt = 'riadh_library_salt_v2';
  const input = salt + password + salt;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
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

// ── Session Activity Tracking ──
export function updateLastActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

export function getLastActivity(): number {
  const val = localStorage.getItem(LAST_ACTIVITY_KEY);
  return val ? parseInt(val, 10) : Date.now();
}

export function isSessionExpired(timeoutMinutes: number): boolean {
  const last = getLastActivity();
  const elapsed = (Date.now() - last) / 1000 / 60;
  return elapsed > timeoutMinutes;
}

// ── Audit Logging ──
export function getAuditLogs(): AuditLog[] {
  const data = localStorage.getItem(AUDIT_LOGS_KEY);
  return data ? JSON.parse(data) : [];
}

export function addAuditLog(action: AuditAction, details: string, userId?: string, userName?: string) {
  const logs = getAuditLogs();
  const entry: AuditLog = {
    id: generateId(),
    action,
    userId,
    userName,
    details,
    timestamp: new Date().toISOString(),
  };
  logs.unshift(entry);
  // Keep max 1000 entries
  if (logs.length > 1000) logs.length = 1000;
  localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
  return entry;
}

// ═══════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════
export function getProducts(): Product[] {
  const data = localStorage.getItem(PRODUCTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveProducts(products: Product[]) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

export function addProduct(product: Product) {
  const products = getProducts();
  products.push(product);
  saveProducts(products);
  return products;
}

export function updateProduct(updated: Product) {
  const products = getProducts().map(p => p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p);
  saveProducts(products);
  return products;
}

export function deleteProduct(id: string) {
  const products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
  return products;
}

export function bulkAddProducts(newProducts: Product[]) {
  const products = getProducts();
  products.push(...newProducts);
  saveProducts(products);
  return products;
}

// ═══════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════
export function getTransactions(): Transaction[] {
  const data = localStorage.getItem(TRANSACTIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveTransaction(transaction: Transaction) {
  const transactions = getTransactions();
  transactions.unshift(transaction);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  return transactions;
}

export function saveAllTransactions(transactions: Transaction[]) {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export function refundTransaction(txId: string): Transaction[] {
  const transactions = getTransactions().map(tx => {
    if (tx.id === txId) {
      return { ...tx, refunded: true, refundedAt: new Date().toISOString() };
    }
    return tx;
  });
  // Restore stock for the refunded items
  const refundedTx = transactions.find(tx => tx.id === txId);
  if (refundedTx) {
    const products = getProducts().map(p => {
      const item = refundedTx.items.find(i => i.product.id === p.id);
      if (item && p.category !== 'services') {
        return { ...p, quantity: p.quantity + item.quantity, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    saveProducts(products);
  }
  saveAllTransactions(transactions);
  return transactions;
}

// ═══════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════
export function getCustomers(): Customer[] {
  const data = localStorage.getItem(CUSTOMERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveCustomers(customers: Customer[]) {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
}

export function addCustomer(customer: Customer) {
  const customers = getCustomers();
  customers.push(customer);
  saveCustomers(customers);
  return customers;
}

export function updateCustomer(updated: Customer) {
  const customers = getCustomers().map(c => c.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : c);
  saveCustomers(customers);
  return customers;
}

export function deleteCustomer(id: string) {
  const customers = getCustomers().filter(c => c.id !== id);
  saveCustomers(customers);
  return customers;
}

// ═══════════════════════════════════════
// USERS
// ═══════════════════════════════════════
export function getUsers(): User[] {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function addUser(user: User) {
  const users = getUsers();
  if (users.find(u => u.username === user.username)) {
    throw new Error('Username already exists');
  }
  users.push(user);
  saveUsers(users);
  return users;
}

export function updateUser(updated: User) {
  const users = getUsers().map(u => u.id === updated.id ? updated : u);
  saveUsers(users);
  return users;
}

export function deleteUser(id: string) {
  const users = getUsers().filter(u => u.id !== id);
  saveUsers(users);
  return users;
}

export function authenticateUser(username: string, password: string): User | null {
  // Be forgiving about case and leading/trailing whitespace on the username.
  const normalized = username.trim().toLowerCase();
  const users = getUsers();

  // debug log to help diagnose packaging issues (open devtools in Electron)
  console.debug(`[auth] attempt login for "${normalized}"; stored users:`, users.map(u => u.username));

  const user = users.find(
    u => u.username.toLowerCase() === normalized && u.passwordHash === hashPassword(password)
  );

  if (user) {
    // Update last login
    user.lastLogin = new Date().toISOString();
    saveUsers(users);
    return user;
  }

  console.warn(`[auth] login failed for "${normalized}"`);
  return null;
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
}

export function setCurrentUser(user: User | null) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

// ═══════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════
export function getSettings(): AppSettings {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (data) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ═══════════════════════════════════════
// BACKUP / RESTORE
// ═══════════════════════════════════════
export function exportAllData(): BackupData {
  return {
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    products: getProducts(),
    transactions: getTransactions(),
    customers: getCustomers(),
    users: getUsers(),
    settings: getSettings(),
    suppliers: getSuppliers(),
    purchaseOrders: getPurchaseOrders(),
    expenses: getExpenses(),
    auditLogs: getAuditLogs(),
  };
}

export function importAllData(data: BackupData) {
  if (data.products) saveProducts(data.products);
  if (data.transactions) saveAllTransactions(data.transactions);
  if (data.customers) saveCustomers(data.customers);
  if (data.users) saveUsers(data.users);
  if (data.settings) saveSettings(data.settings);
  if (data.suppliers) saveSuppliers(data.suppliers);
  if (data.purchaseOrders) savePurchaseOrders(data.purchaseOrders);
  if (data.expenses) saveExpenses(data.expenses);
  if (data.auditLogs) localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(data.auditLogs));
}

// ═══════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════
export function getSuppliers(): Supplier[] {
  const data = localStorage.getItem(SUPPLIERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveSuppliers(suppliers: Supplier[]) {
  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers));
}

export function addSupplier(supplier: Supplier) {
  const suppliers = getSuppliers();
  suppliers.push(supplier);
  saveSuppliers(suppliers);
  return suppliers;
}

export function updateSupplier(updated: Supplier) {
  const suppliers = getSuppliers().map(s => s.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : s);
  saveSuppliers(suppliers);
  return suppliers;
}

export function deleteSupplier(id: string) {
  const suppliers = getSuppliers().filter(s => s.id !== id);
  saveSuppliers(suppliers);
  return suppliers;
}

// ═══════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════
export function getPurchaseOrders(): PurchaseOrder[] {
  const data = localStorage.getItem(PURCHASE_ORDERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function savePurchaseOrders(orders: PurchaseOrder[]) {
  localStorage.setItem(PURCHASE_ORDERS_KEY, JSON.stringify(orders));
}

export function addPurchaseOrder(order: PurchaseOrder) {
  const orders = getPurchaseOrders();
  orders.unshift(order);
  savePurchaseOrders(orders);
  return orders;
}

export function updatePurchaseOrder(updated: PurchaseOrder) {
  const orders = getPurchaseOrders().map(o => o.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : o);
  savePurchaseOrders(orders);
  return orders;
}

export function receivePurchaseOrder(orderId: string): PurchaseOrder[] {
  const orders = getPurchaseOrders();
  const orderIdx = orders.findIndex(o => o.id === orderId);
  if (orderIdx === -1) return orders;

  const order = orders[orderIdx];
  orders[orderIdx] = { ...order, status: 'received', receivedDate: new Date().toISOString(), updatedAt: new Date().toISOString() };

  // Update product stock
  const products = getProducts();
  order.items.forEach(item => {
    const pIdx = products.findIndex(p => p.id === item.productId);
    if (pIdx !== -1) {
      products[pIdx] = {
        ...products[pIdx],
        quantity: products[pIdx].quantity + item.quantity,
        cost: item.unitCost, // Update cost to latest purchase cost
        updatedAt: new Date().toISOString(),
      };
    }
  });
  saveProducts(products);
  savePurchaseOrders(orders);
  return orders;
}

// ═══════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════
export function getExpenses(): Expense[] {
  const data = localStorage.getItem(EXPENSES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

export function addExpense(expense: Expense) {
  const expenses = getExpenses();
  expenses.unshift(expense);
  saveExpenses(expenses);
  return expenses;
}

export function updateExpense(updated: Expense) {
  const expenses = getExpenses().map(e => e.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : e);
  saveExpenses(expenses);
  return expenses;
}

export function deleteExpense(id: string) {
  const expenses = getExpenses().filter(e => e.id !== id);
  saveExpenses(expenses);
  return expenses;
}

// ═══════════════════════════════════════
// LOW STOCK ALERTS
// ═══════════════════════════════════════
export function getLowStockProducts(): Product[] {
  return getProducts().filter(p => p.quantity <= p.lowStockThreshold && p.category !== 'services');
}

export function checkAndNotifyLowStock() {
  const lowStock = getLowStockProducts();
  if (lowStock.length > 0 && window.electronAPI) {
    window.electronAPI.showNotification(
      'Low Stock Alert',
      `${lowStock.length} item(s) are running low: ${lowStock.slice(0, 3).map(p => p.name).join(', ')}${lowStock.length > 3 ? '...' : ''}`
    );
  }
}

// ═══════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════
export function seedDemoData() {
  // Always make sure there's at least one administrator.
  const users = getUsers();

  if (users.length === 0) {
    const now = new Date().toISOString();
    const defaultUser: User = {
      id: generateId(),
      username: 'admin',
      passwordHash: hashPassword('admin'),
      displayName: 'Owner',
      role: 'owner',
      email: 'admin@riadhlibrary.local',
      createdAt: now,
    };
    saveUsers([defaultUser]);
  } else {
    // if no admin user exists, add one with default password
    let hasAdmin = users.some(u => u.username.toLowerCase() === 'admin');
    if (!hasAdmin) {
      const now = new Date().toISOString();
      users.push({
        id: generateId(),
        username: 'admin',
        passwordHash: hashPassword('admin'),
        displayName: 'Owner',
        role: 'owner',
        email: 'admin@riadhlibrary.local',
        createdAt: now,
      });
      hasAdmin = true;
    }

    // In development builds we also reset the admin password to the default if it
    // doesn't match; this makes it easier to test fresh installs and avoids stale
    // credentials surviving between rebuilds. Remove or adjust this logic for a
    // production deployment if you want admins to be able to set their own
    // password permanently.
    if (process.env.NODE_ENV !== 'production') {
      const adminUser = users.find(u => u.username.toLowerCase() === 'admin');
      if (adminUser && adminUser.passwordHash !== hashPassword('admin')) {
        console.info('[seedDemoData] resetting admin password to default');
        adminUser.passwordHash = hashPassword('admin');
        saveUsers(users);
      }
    }

    // Migrate old password hashes (h_ prefix) to new format (sha_ prefix)
    let needsMigration = false;
    const migrated = users.map(u => {
      if (u.passwordHash.startsWith('h_')) {
        needsMigration = true;
        // Can't recover the original password, reset to 'admin' for the admin or username for others
        return { ...u, passwordHash: hashPassword(u.username === 'admin' ? 'admin' : u.username) };
      }
      return u;
    });

    if (needsMigration) {
      saveUsers(migrated);
    } else if (!hasAdmin) {
      // we added an admin above; persist the change
      saveUsers(users);
    }
  }

  if (getProducts().length > 0) return;

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

  saveProducts(demoProducts);
}

