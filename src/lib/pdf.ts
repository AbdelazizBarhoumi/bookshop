/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, Transaction, AppSettings, CATEGORY_LABELS, BuiltInCategory, getCategoryLabel, CustomCategory } from '@/types/pos';

// extend jsPDF type with autotable helper info
interface AutoTableDoc extends jsPDF {
  lastAutoTable?: { finalY: number };
}

// ── Security: HTML entity escaping for receipt template ──
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Check if text contains Arabic characters */
function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/** Generate an HTML-based printable report (supports Arabic/RTL) */
function generateHTMLReport(title: string, settings: AppSettings, headers: string[], rows: string[][], summary: string): Blob {
  const isRTL = hasArabic(title) || hasArabic(settings.storeName);
  const html = `<!DOCTYPE html>
<html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 20px; font-size: 12px; direction: ${isRTL ? 'rtl' : 'ltr'}; }
  h1 { font-size: 18px; margin: 0; }
  .subtitle { color: #666; font-size: 11px; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #224480; color: #fff; padding: 6px 8px; text-align: ${isRTL ? 'right' : 'left'}; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
  tr:nth-child(even) { background: #f9f9f9; }
  .summary { margin-top: 12px; font-size: 11px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(settings.storeName)}</h1>
  <div class="subtitle">${escapeHtml(title)}</div>
  <div class="subtitle">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
  <table>
    <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <div class="summary">${escapeHtml(summary)}</div>
</body>
</html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

// Generate inventory report PDF
export function generateInventoryPDF(products: Product[], settings: AppSettings, customCategories?: CustomCategory[]): jsPDF | Blob {
  const cats = customCategories || settings.customCategories || [];
  const getCatLabel = (key: string) => (key in CATEGORY_LABELS) ? CATEGORY_LABELS[key as BuiltInCategory] : getCategoryLabel(key, cats);

  // Check if any product names or store name contain Arabic
  const needsArabic = hasArabic(settings.storeName) || products.some(p => hasArabic(p.name));
  const totalStock = products.reduce((s, p) => s + (p.category === 'services' ? 0 : p.quantity), 0);
  const totalValue = products.reduce((s, p) => s + (p.category === 'services' ? 0 : p.price * p.quantity), 0);
  const summary = `Total Products: ${products.length} | Total Stock: ${totalStock} units | Total Value: ${Math.round(totalValue)} ${settings.currencySymbol}`;

  if (needsArabic) {
    const headers = ['Product', 'Category', 'Price', 'Cost', 'Stock', 'Status'];
    const rows = products.map(p => [
      p.name,
      getCatLabel(p.category),
      `${Math.round(p.price)} ${settings.currencySymbol}`,
      `${Math.round(p.cost)} ${settings.currencySymbol}`,
      p.category === 'services' ? '∞' : String(p.quantity),
      p.quantity <= p.lowStockThreshold && p.category !== 'services' ? 'LOW' : 'OK',
    ]);
    return generateHTMLReport('Inventory Report', settings, headers, rows, summary);
  }

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(settings.storeName, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text('Inventory Report', 14, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

  const tableData = products.map(p => [
    p.name,
    getCatLabel(p.category),
    `${Math.round(p.price)} ${settings.currencySymbol}`,
    `${Math.round(p.cost)} ${settings.currencySymbol}`,
    p.category === 'services' ? '∞' : String(p.quantity),
    p.quantity <= p.lowStockThreshold && p.category !== 'services' ? 'LOW' : 'OK',
  ]);

  autoTable(doc, {
    head: [['Product', 'Category', 'Price', 'Cost', 'Stock', 'Status']],
    body: tableData,
    startY: 42,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [34, 68, 128] },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const y = ((doc as any).lastAutoTable?.finalY ?? 0) + 10;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(summary, 14, y);

  return doc;
}

// Generate sales report PDF
export function generateSalesReportPDF(transactions: Transaction[], settings: AppSettings, title: string = 'Sales Report'): jsPDF | Blob {
  const needsArabic = hasArabic(settings.storeName) || transactions.some(tx => tx.items.some(i => hasArabic(i.product.name)));
  const totalRevenue = transactions.filter(t => !t.refunded).reduce((s, t) => s + t.total, 0);
  const summary = `Total Transactions: ${transactions.length} | Total Revenue: ${Math.round(totalRevenue)} ${settings.currencySymbol}`;

  if (needsArabic) {
    const headers = ['ID', 'Date', 'Items', 'Subtotal', 'Total', 'Payment', 'Status'];
    const rows = transactions.map(tx => [
      `#${tx.id.slice(-6).toUpperCase()}`,
      new Date(tx.timestamp).toLocaleString(),
      tx.items.length + ' items',
      `${Math.round(tx.subtotal)} ${settings.currencySymbol}`,
      `${Math.round(tx.total)} ${settings.currencySymbol}`,
      tx.paymentMethod,
      tx.refunded ? 'Refunded' : 'Complete',
    ]);
    return generateHTMLReport(title, settings, headers, rows, summary);
  }

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(settings.storeName, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(title, 14, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

  const tableData = transactions.map(tx => [
    `#${tx.id.slice(-6).toUpperCase()}`,
    new Date(tx.timestamp).toLocaleString(),
    tx.items.length + ' items',
    `${Math.round(tx.subtotal)} ${settings.currencySymbol}`,
    `${Math.round(tx.total)} ${settings.currencySymbol}`,
    tx.paymentMethod,
    tx.refunded ? 'Refunded' : 'Complete',
  ]);

  autoTable(doc, {
    head: [['ID', 'Date', 'Items', 'Subtotal', 'Total', 'Payment', 'Status']],
    body: tableData,
    startY: 42,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [34, 68, 128] },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const y = ((doc as any).lastAutoTable?.finalY ?? 0) + 10;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(summary, 14, y);

  return doc;
}

// Generate receipt HTML for thermal printer
export function generateReceiptHTML(tx: Transaction, settings: AppSettings): string {
  const itemsHTML = tx.items.map(item => `
    <tr>
      <td style="text-align:left">${escapeHtml(item.product.name)}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${Math.round(item.product.price * item.quantity)}</td>
    </tr>
  `).join('');

  return `
    <html>
    <head><style>
      body { font-family: monospace; width: 280px; margin: 0 auto; padding: 10px; font-size: 12px; }
      .center { text-align: center; }
      .line { border-top: 1px dashed #000; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 2px 0; }
    </style></head>
    <body>
      <div class="center">
        <strong style="font-size:14px">${escapeHtml(settings.storeName)}</strong><br/>
        ${settings.storeAddress ? escapeHtml(settings.storeAddress) + '<br/>' : ''}
        ${settings.storePhone ? 'Tel: ' + escapeHtml(settings.storePhone) + '<br/>' : ''}
      </div>
      <div class="line"></div>
      <div class="center">RECEIPT</div>
      <div>Date: ${escapeHtml(new Date(tx.timestamp).toLocaleString())}</div>
      <div>Ref: #${escapeHtml(tx.id.slice(-6).toUpperCase())}</div>
      ${tx.cashierName ? `<div>Cashier: ${escapeHtml(tx.cashierName)}</div>` : ''}
      ${tx.customerName ? `<div>Customer: ${escapeHtml(tx.customerName)}</div>` : ''}
      <div class="line"></div>
      <table>
        <tr><th style="text-align:left">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr>
        ${itemsHTML}
      </table>
      <div class="line"></div>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">${Math.round(tx.subtotal)} ${escapeHtml(settings.currencySymbol)}</td></tr>
        ${tx.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${Math.round(tx.discount)} ${escapeHtml(settings.currencySymbol)}</td></tr>` : ''}
        <tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>${Math.round(tx.total)} ${escapeHtml(settings.currencySymbol)}</strong></td></tr>
      </table>
      <div class="line"></div>
      <div class="center">Payment: ${escapeHtml(tx.paymentMethod.toUpperCase())}${tx.mobileProvider ? ` (${escapeHtml(tx.mobileProvider.charAt(0).toUpperCase() + tx.mobileProvider.slice(1))})` : ''}</div>
      ${tx.paymentMethod === 'cash' && tx.cashTendered ? `<div class="center">Tendered: ${Math.round(tx.cashTendered)} ${escapeHtml(settings.currencySymbol)} | Change: ${Math.round(tx.changeDue || 0)} ${escapeHtml(settings.currencySymbol)}</div>` : ''}
      ${tx.paymentMethod === 'split' ? `<div class="center">Cash: ${Math.round(tx.splitCashAmount || 0)} ${escapeHtml(settings.currencySymbol)} | Mobile: ${Math.round(tx.splitMobileAmount || 0)} ${escapeHtml(settings.currencySymbol)}</div>` : ''}
      <div class="line"></div>
      <div class="center" style="font-size:10px">${escapeHtml(settings.receiptFooter)}</div>
    </body>
    </html>
  `;
}
