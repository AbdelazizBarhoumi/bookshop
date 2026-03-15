/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  getProducts, saveProducts, addProduct as rawAddProduct, updateProduct as rawUpdateProduct,
  deleteProduct as rawDeleteProduct, bulkAddProducts as rawBulkAddProducts,
  getTransactions, saveTransaction as rawSaveTransaction, refundTransaction as rawRefundTransaction,
  getCustomers, addCustomer as rawAddCustomer, updateCustomer as rawUpdateCustomer, deleteCustomer as rawDeleteCustomer,
  getSuppliers, addSupplier as rawAddSupplier, updateSupplier as rawUpdateSupplier, deleteSupplier as rawDeleteSupplier,
  getExpenses, addExpense as rawAddExpense, updateExpense as rawUpdateExpense, deleteExpense as rawDeleteExpense,
  getPurchaseOrders, addPurchaseOrder as rawAddPurchaseOrder, updatePurchaseOrder as rawUpdatePurchaseOrder, receivePurchaseOrder as rawReceivePurchaseOrder,
  getStockEntries, addStockEntry as rawAddStockEntry, getStockEntriesForProduct,
  getSettings, saveSettings as rawSaveSettings,
  generateId, importAllData as rawImportAllData,
} from './storage';
import { Product, Transaction, Customer, Supplier, Expense, PurchaseOrder, AppSettings, DEFAULT_SETTINGS, BackupData, StockEntry } from '@/types/pos';

interface DataStoreContextType {
  // Products
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  bulkAddProducts: (products: Product[]) => void;
  refreshProducts: () => void;

  // Transactions
  transactions: Transaction[];
  saveTransaction: (tx: Transaction) => void;
  refundTransaction: (txId: string) => void;
  refreshTransactions: () => void;

  // Customers
  customers: Customer[];
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  refreshCustomers: () => void;

  // Suppliers
  suppliers: Supplier[];
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  refreshSuppliers: () => void;

  // Expenses
  expenses: Expense[];
  addExpense: (expense: Expense) => void;
  updateExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  refreshExpenses: () => void;

  // Purchase Orders
  purchaseOrders: PurchaseOrder[];
  addPurchaseOrder: (order: PurchaseOrder) => void;
  updatePurchaseOrder: (order: PurchaseOrder) => void;
  receivePurchaseOrder: (orderId: string) => void;
  refreshPurchaseOrders: () => void;

  // Stock Entries
  stockEntries: StockEntry[];
  addStockEntry: (entry: StockEntry) => void;
  getStockEntriesForProduct: (productId: string) => StockEntry[];
  refreshStockEntries: () => void;

  // Settings
  settings: AppSettings;
  saveSettings: (settings: AppSettings) => void;
  refreshSettings: () => void;

  // Global
  refreshAll: () => void;
  importAllData: (data: BackupData) => void;
  generateId: () => string;
}

const DataStoreContext = createContext<DataStoreContextType | null>(null);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load all data on mount
  useEffect(() => {
    refreshAll();
  }, []);

  const refreshProducts = useCallback(() => setProducts(getProducts()), []);
  const refreshTransactions = useCallback(() => setTransactions(getTransactions()), []);
  const refreshCustomers = useCallback(() => setCustomers(getCustomers()), []);
  const refreshSuppliers = useCallback(() => setSuppliers(getSuppliers()), []);
  const refreshExpenses = useCallback(() => setExpenses(getExpenses()), []);
  const refreshPurchaseOrders = useCallback(() => setPurchaseOrders(getPurchaseOrders()), []);
  const refreshStockEntries = useCallback(() => setStockEntries(getStockEntries()), []);
  const refreshSettings = useCallback(() => setSettings(getSettings()), []);

  const refreshAll = useCallback(() => {
    refreshProducts();
    refreshTransactions();
    refreshCustomers();
    refreshSuppliers();
    refreshExpenses();
    refreshPurchaseOrders();
    refreshStockEntries();
    refreshSettings();
  }, [refreshProducts, refreshTransactions, refreshCustomers, refreshSuppliers, refreshExpenses, refreshPurchaseOrders, refreshStockEntries, refreshSettings]);

  // Products
  const addProduct = useCallback((product: Product) => {
    setProducts(rawAddProduct(product));
  }, []);

  const updateProduct = useCallback((product: Product) => {
    setProducts(rawUpdateProduct(product));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts(rawDeleteProduct(id));
  }, []);

  const bulkAddProducts = useCallback((newProducts: Product[]) => {
    setProducts(rawBulkAddProducts(newProducts));
  }, []);

  // Transactions
  const saveTransaction = useCallback((tx: Transaction) => {
    setTransactions(rawSaveTransaction(tx));
    // Also refresh products since stock changes
    refreshProducts();
  }, [refreshProducts]);

  const refundTransaction = useCallback((txId: string) => {
    setTransactions(rawRefundTransaction(txId));
    // Also refresh products since stock is restored
    refreshProducts();
  }, [refreshProducts]);

  // Customers
  const addCustomer = useCallback((customer: Customer) => {
    setCustomers(rawAddCustomer(customer));
  }, []);

  const updateCustomer = useCallback((customer: Customer) => {
    setCustomers(rawUpdateCustomer(customer));
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setCustomers(rawDeleteCustomer(id));
  }, []);

  // Suppliers
  const addSupplier = useCallback((supplier: Supplier) => {
    setSuppliers(rawAddSupplier(supplier));
  }, []);

  const updateSupplier = useCallback((supplier: Supplier) => {
    setSuppliers(rawUpdateSupplier(supplier));
  }, []);

  const deleteSupplier = useCallback((id: string) => {
    setSuppliers(rawDeleteSupplier(id));
  }, []);

  // Expenses
  const addExpense = useCallback((expense: Expense) => {
    setExpenses(rawAddExpense(expense));
  }, []);

  const updateExpense = useCallback((expense: Expense) => {
    setExpenses(rawUpdateExpense(expense));
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses(rawDeleteExpense(id));
  }, []);

  // Purchase Orders
  const addPurchaseOrder = useCallback((order: PurchaseOrder) => {
    setPurchaseOrders(rawAddPurchaseOrder(order));
  }, []);

  const updatePurchaseOrder = useCallback((order: PurchaseOrder) => {
    setPurchaseOrders(rawUpdatePurchaseOrder(order));
  }, []);

  const receivePurchaseOrder = useCallback((orderId: string) => {
    setPurchaseOrders(rawReceivePurchaseOrder(orderId));
    refreshProducts(); // Stock updated
  }, [refreshProducts]);

  // Stock Entries
  const addStockEntry = useCallback((entry: StockEntry) => {
    setStockEntries(rawAddStockEntry(entry));
    refreshProducts(); // Stock quantity updated
  }, [refreshProducts]);

  const getStockEntriesForProductFn = useCallback((productId: string) => {
    return getStockEntriesForProduct(productId);
  }, []);

  // Settings
  const saveSettingsFn = useCallback((newSettings: AppSettings) => {
    rawSaveSettings(newSettings);
    setSettings(newSettings);
  }, []);

  // Import all data
  const importAllDataFn = useCallback((data: BackupData) => {
    rawImportAllData(data);
    refreshAll();
  }, [refreshAll]);

  return (
    <DataStoreContext.Provider value={{
      products, addProduct, updateProduct, deleteProduct, bulkAddProducts, refreshProducts,
      transactions, saveTransaction, refundTransaction, refreshTransactions,
      customers, addCustomer, updateCustomer, deleteCustomer, refreshCustomers,
      suppliers, addSupplier, updateSupplier, deleteSupplier, refreshSuppliers,
      expenses, addExpense, updateExpense, deleteExpense, refreshExpenses,
      purchaseOrders, addPurchaseOrder, updatePurchaseOrder, receivePurchaseOrder, refreshPurchaseOrders,
      stockEntries, addStockEntry, getStockEntriesForProduct: getStockEntriesForProductFn, refreshStockEntries,
      settings, saveSettings: saveSettingsFn, refreshSettings,
      refreshAll, importAllData: importAllDataFn, generateId,
    }}>
      {children}
    </DataStoreContext.Provider>
  );
}

export function useDataStore() {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error('useDataStore must be used within DataStoreProvider');
  return ctx;
}
