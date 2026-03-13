// ── Product Types ──
export type BuiltInCategory = 'books' | 'writing' | 'paper' | 'services' | 'other';
export type ProductCategory = BuiltInCategory | string;

export interface CustomCategory {
  id: string;
  name: string;
  nameAr?: string;
}

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

// ── Stock Entry ──
export interface StockEntry {
  id: string;
  productId: string;
  quantity: number;
  note?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
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

// ── Mobile Payment Providers ──
export type MobileProvider = 'bankak' | 'fawry' | 'ocash' | 'other';

export const MOBILE_PROVIDER_LABELS: Record<MobileProvider, string> = {
  bankak: 'Bankak',
  fawry: 'Fawry',
  ocash: 'Ocash',
  other: 'Other',
};

export const MOBILE_PROVIDER_I18N_KEYS: Record<MobileProvider, string> = {
  bankak: 'pos.providerBankak',
  fawry: 'pos.providerFawry',
  ocash: 'pos.providerOcash',
  other: 'pos.providerOther',
};

export const MOBILE_PROVIDERS: MobileProvider[] = ['bankak', 'fawry', 'ocash', 'other'];

// ── Transaction ──
export interface Transaction {
  id: string;
  items: CartItem[];
  printJobs?: PrintJob[];
  subtotal: number;
  /** @deprecated kept for backward compat with old data; always 0 for new sales */
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'mobile' | 'split';
  mobileProvider?: MobileProvider;
  transactionReference?: string;
  cashTendered?: number;
  changeDue?: number;
  splitCashAmount?: number;
  splitMobileAmount?: number;
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
  owner: ['dashboard', 'products', 'inventory', 'pos', 'transactions', 'customers', 'reports', 'settings', 'users', 'suppliers', 'expenses'],
  cashier: ['pos', 'transactions', 'customers'],
  stock_clerk: ['products', 'inventory', 'dashboard', 'suppliers'],
};

// ── App Settings ──
export interface AppSettings {
  currency: string;
  currencySymbol: string;
  currencyCode: string;
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
  customCategories: CustomCategory[];
  bwPricePerPage: number;
  colorPricePerPage: number;
  spiralBindingPrice: number;
  stapleBindingPrice: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'Tunisian Dinar',
  currencySymbol: 'SDG',
  currencyCode: 'SDG',
  language: 'en',
  theme: 'light',
  storeName: 'RIC Library Bookshop',
  storeAddress: '',
  storePhone: '',
  storeEmail: '',
  receiptFooter: 'Thank you for your purchase!',
  autoBackup: true,
  backupIntervalHours: 24,
  sessionTimeoutMinutes: 10,
  lowStockEmailAlerts: false,
  customCategories: [],
  bwPricePerPage: 0.150,
  colorPricePerPage: 0.500,
  spiralBindingPrice: 2.000,
  stapleBindingPrice: 0.500,
};

// ── Labels & Icons ──
export const CATEGORY_LABELS: Record<BuiltInCategory, string> = {
  books: 'Books',
  writing: 'Writing Instruments',
  paper: 'Paper Goods',
  services: 'Services',
  other: 'Other',
};

// i18n key maps – use with t() at render time
export const CATEGORY_I18N_KEYS: Record<BuiltInCategory, string> = {
  books: 'category.books',
  writing: 'category.writing',
  paper: 'category.paper',
  services: 'category.services',
  other: 'category.other',
};

export const CATEGORY_ICONS: Record<BuiltInCategory, string> = {
  books: '📚',
  writing: '✏️',
  paper: '📄',
  services: '🖨️',
  other: '📦',
};

export const BUILTIN_CATEGORIES: BuiltInCategory[] = ['books', 'writing', 'paper', 'services', 'other'];

/** Merge built-in + custom categories into label/icon/i18nKey maps */
export function getAllCategories(customCategories: CustomCategory[] = [], locale: 'en' | 'ar' = 'en'): { key: string; label: string; icon: string }[] {
  const builtIn = BUILTIN_CATEGORIES.map(k => ({
    key: k,
    label: CATEGORY_LABELS[k],
    icon: CATEGORY_ICONS[k],
  }));
  const custom = customCategories.map(c => ({
    key: c.id,
    label: (locale === 'ar' && c.nameAr) ? c.nameAr : c.name,
    icon: '🏷️',
  }));
  return [...builtIn, ...custom];
}

/** Get label for any category key (built-in or custom) */
export function getCategoryLabel(key: string, customCategories: CustomCategory[] = [], locale: 'en' | 'ar' = 'en'): string {
  if (key in CATEGORY_LABELS) return CATEGORY_LABELS[key as BuiltInCategory];
  const custom = customCategories.find(c => c.id === key);
  if (custom) return (locale === 'ar' && custom.nameAr) ? custom.nameAr : custom.name;
  return key;
}

/** Get icon for any category key (built-in or custom) */
export function getCategoryIcon(key: string, _customCategories: CustomCategory[] = []): string {
  if (key in CATEGORY_ICONS) return CATEGORY_ICONS[key as BuiltInCategory];
  return '🏷️';
}

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
export type ExpenseCategory = 'rent' | 'utilities' | 'supplies' | 'salary' | 'marketing' | 'maintenance' | 'transport' | 'insurance' | 'other';

export type ExpensePaymentStatus = 'paid' | 'pending';
export type ExpenseRecurring = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  supplierId?: string;
  supplierName?: string;
  notes?: string;
  paymentStatus: ExpensePaymentStatus;
  recurring: ExpenseRecurring;
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
  transport: 'Transport',
  insurance: 'Insurance',
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
  transport: 'expenseCategory.transport',
  insurance: 'expenseCategory.insurance',
  other: 'expenseCategory.other',
};

export const EXPENSE_PAYMENT_STATUS_I18N_KEYS: Record<ExpensePaymentStatus, string> = {
  paid: 'expense.paid',
  pending: 'expense.pending',
};

export const EXPENSE_RECURRING_I18N_KEYS: Record<ExpenseRecurring, string> = {
  none: 'expense.recurringNone',
  weekly: 'expense.recurringWeekly',
  monthly: 'expense.recurringMonthly',
  yearly: 'expense.recurringYearly',
};

// ── Audit Log ──
export type AuditAction =
  | 'login' | 'logout' | 'login_failed'
  | 'sale' | 'refund'
  | 'product_add' | 'product_edit' | 'product_delete' | 'stock_add'
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
  stockEntries?: StockEntry[];
}

