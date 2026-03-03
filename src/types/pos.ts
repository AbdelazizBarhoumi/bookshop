// ── Product Types ──
export type ProductCategory = 'books' | 'writing' | 'paper' | 'services' | 'other';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  cost: number;
  quantity: number;
  lowStockThreshold: number;
  barcode?: string;
  description?: string;
  supplier?: string;
  // Book-specific
  author?: string;
  isbn?: string;
  // Writing instrument specific
  brand?: string;
  color?: string;
  // Service specific
  serviceType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // percentage
}

// ── Print Job ──
export interface PrintJob {
  id: string;
  printType: 'bw' | 'color';
  pageCount: number;
  copies: number;
  paperSize: 'A4' | 'A3' | 'Letter';
  binding: 'none' | 'spiral' | 'staple';
  pricePerPage: number;
  bindingPrice: number;
  total: number;
}

// ── Customer ──
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyPoints: number;
  totalSpent: number;
  purchaseCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Transaction ──
export interface Transaction {
  id: string;
  items: CartItem[];
  printJobs?: PrintJob[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile';
  timestamp: string;
  cashierId?: string;
  cashierName?: string;
  customerId?: string;
  customerName?: string;
  refunded?: boolean;
  refundedAt?: string;
  notes?: string;
}

// ── User / Auth ──
export type UserRole = 'owner' | 'cashier' | 'stock_clerk';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  email?: string;
  createdAt: string;
  lastLogin?: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner (Full Access)',
  cashier: 'Cashier (Sales Only)',
  stock_clerk: 'Stock Clerk (Inventory Only)',
};

// i18n key maps – use with t() at render time
export const ROLE_I18N_KEYS: Record<UserRole, string> = {
  owner: 'role.owner',
  cashier: 'role.cashier',
  stock_clerk: 'role.stock_clerk',
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['dashboard', 'inventory', 'pos', 'transactions', 'customers', 'reports', 'settings', 'users', 'suppliers', 'expenses'],
  cashier: ['pos', 'transactions', 'customers'],
  stock_clerk: ['inventory', 'dashboard', 'suppliers'],
};

// ── App Settings ──
export interface AppSettings {
  currency: string;
  currencySymbol: string;
  currencyCode: string;
  taxRate: number;
  language: 'en' | 'ar';
  theme: 'light' | 'dark';
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  receiptFooter: string;
  autoBackup: boolean;
  backupIntervalHours: number;
  sessionTimeoutMinutes: number;
  lowStockEmailAlerts: boolean;
  bwPricePerPage: number;
  colorPricePerPage: number;
  spiralBindingPrice: number;
  stapleBindingPrice: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'Tunisian Dinar',
  currencySymbol: 'SDG',
  currencyCode: 'SDG',
  taxRate: 0.07,
  language: 'en',
  theme: 'light',
  storeName: 'Riadh Library Bookshop',
  storeAddress: '',
  storePhone: '',
  storeEmail: '',
  receiptFooter: 'Thank you for your purchase!',
  autoBackup: true,
  backupIntervalHours: 24,
  sessionTimeoutMinutes: 10,
  lowStockEmailAlerts: false,
  bwPricePerPage: 0.150,
  colorPricePerPage: 0.500,
  spiralBindingPrice: 2.000,
  stapleBindingPrice: 0.500,
};

// ── Labels & Icons ──
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  books: 'Books',
  writing: 'Writing Instruments',
  paper: 'Paper Goods',
  services: 'Services',
  other: 'Other',
};

// i18n key maps – use with t() at render time
export const CATEGORY_I18N_KEYS: Record<ProductCategory, string> = {
  books: 'category.books',
  writing: 'category.writing',
  paper: 'category.paper',
  services: 'category.services',
  other: 'category.other',
};

export const CATEGORY_ICONS: Record<ProductCategory, string> = {
  books: '📚',
  writing: '✏️',
  paper: '📄',
  services: '🖨️',
  other: '📦',
};

// ── Supplier ──
export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Purchase Order ──
export type PurchaseOrderStatus = 'pending' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  orderDate: string;
  receivedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Expense ──
export type ExpenseCategory = 'rent' | 'utilities' | 'supplies' | 'salary' | 'marketing' | 'maintenance' | 'other';

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  supplierId?: string;
  supplierName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  utilities: 'Utilities',
  supplies: 'Office Supplies',
  salary: 'Salary',
  marketing: 'Marketing',
  maintenance: 'Maintenance',
  other: 'Other',
};

// i18n key maps – use with t() at render time
export const EXPENSE_CATEGORY_I18N_KEYS: Record<ExpenseCategory, string> = {
  rent: 'expenseCategory.rent',
  utilities: 'expenseCategory.utilities',
  supplies: 'expenseCategory.supplies',
  salary: 'expenseCategory.salary',
  marketing: 'expenseCategory.marketing',
  maintenance: 'expenseCategory.maintenance',
  other: 'expenseCategory.other',
};

// ── Audit Log ──
export type AuditAction =
  | 'login' | 'logout' | 'login_failed'
  | 'sale' | 'refund'
  | 'product_add' | 'product_edit' | 'product_delete'
  | 'customer_add' | 'customer_edit' | 'customer_delete'
  | 'user_add' | 'user_delete'
  | 'settings_change' | 'backup' | 'restore'
  | 'expense_add' | 'expense_edit' | 'expense_delete'
  | 'supplier_add' | 'supplier_edit' | 'supplier_delete'
  | 'purchase_order_create' | 'purchase_order_receive' | 'purchase_order_cancel';

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId?: string;
  userName?: string;
  details: string;
  timestamp: string;
}

// ── Backup Data Shape ──
export interface BackupData {
  version: string;
  timestamp: string;
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
  users: User[];
  settings: AppSettings;
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  expenses?: Expense[];
  auditLogs?: AuditLog[];
}

