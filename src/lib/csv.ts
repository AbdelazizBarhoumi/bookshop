/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Papa from 'papaparse';
import { Product, ProductCategory, Transaction, CartItem, BUILTIN_CATEGORIES, CustomCategory } from '@/types/pos';
import { generateId } from '@/lib/storage';

// Export products to CSV string
export function exportProductsCSV(products: Product[]): string {
  const rows = products.map(p => ({
    Name: p.name,
    Category: p.category,
    Price: p.price,
    Cost: p.cost,
    Quantity: p.quantity,
    LowStockThreshold: p.lowStockThreshold,
    Barcode: p.barcode || '',
    Author: p.author || '',
    ISBN: p.isbn || '',
    Brand: p.brand || '',
    Color: p.color || '',
    ServiceType: p.serviceType || '',
    Supplier: p.supplier || '',
    Description: p.description || '',
  }));
  return Papa.unparse(rows);
}

// Parse CSV string into products
export function importProductsCSV(csvString: string, customCategories?: CustomCategory[]): { products: Product[]; errors: string[] } {
  const result = Papa.parse(csvString, { header: true, skipEmptyLines: true });
  const errors: string[] = [];
  const now = new Date().toISOString();
  const generatedId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

  const products: Product[] = [];
  const validBuiltIn: string[] = [...BUILTIN_CATEGORIES];
  const validCustom = (customCategories || []).map(c => c.id);
  const allValid = [...validBuiltIn, ...validCustom];

  (result.data as Record<string, string>[]).forEach((row, index) => {
    if (!row.Name || !row.Name.trim()) {
      errors.push(`Row ${index + 1}: Missing product name`);
      return;
    }
    const category = allValid.includes(row.Category) ? row.Category as ProductCategory : 'other';
    products.push({
      id: generatedId(),
      name: row.Name.trim(),
      category,
      price: parseFloat(row.Price) || 0,
      cost: parseFloat(row.Cost) || 0,
      quantity: parseInt(row.Quantity) || 0,
      lowStockThreshold: parseInt(row.LowStockThreshold) || 5,
      barcode: row.Barcode || undefined,
      author: row.Author || undefined,
      isbn: row.ISBN || undefined,
      brand: row.Brand || undefined,
      color: row.Color || undefined,
      serviceType: row.ServiceType || undefined,
      supplier: row.Supplier || undefined,
      description: row.Description || undefined,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { products, errors };
}

// Export transactions to CSV
export function exportTransactionsCSV(transactions: Transaction[]): string {
  const rows = transactions.map(tx => ({
    ID: tx.id,
    Date: new Date(tx.timestamp).toLocaleString(),
    Items: tx.items.map((i: CartItem) => `${i.product.name} x${i.quantity}`).join('; '),
    Subtotal: Math.round(tx.subtotal).toString(),
    Total: Math.round(tx.total).toString(),
    Payment: tx.paymentMethod,
    SplitCash: tx.paymentMethod === 'split' ? Math.round(tx.splitCashAmount || 0).toString() : '',
    SplitMobile: tx.paymentMethod === 'split' ? Math.round(tx.splitMobileAmount || 0).toString() : '',
    Cashier: tx.cashierName || '',
    Customer: tx.customerName || '',
    Refunded: tx.refunded ? 'Yes' : 'No',
  }));
  return Papa.unparse(rows);
}
