import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, Transaction, AppSettings, CATEGORY_LABELS } from '@/types/pos';

// extend jsPDF type with autotable helper info
interface AutoTableDoc extends jsPDF {
  lastAutoTable?: { finalY: number };
}

// Generate inventory report PDF
export function generateInventoryPDF(products: Product[], settings: AppSettings): jsPDF {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(settings.storeName, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text('Inventory Report', 14, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

  const tableData = products.map(p => [
    p.name,
    CATEGORY_LABELS[p.category],
    `${p.price.toFixed(3)} ${settings.currencySymbol}`,
    `${p.cost.toFixed(3)} ${settings.currencySymbol}`,
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

  const totalStock = products.reduce((s, p) => s + (p.category === 'services' ? 0 : p.quantity), 0);
  const totalValue = products.reduce((s, p) => s + (p.category === 'services' ? 0 : p.price * p.quantity), 0);
  const y = (doc.lastAutoTable?.finalY ?? 0) + 10;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Total Products: ${products.length} | Total Stock: ${totalStock} units | Total Value: ${totalValue.toFixed(3)} ${settings.currencySymbol}`, 14, y);

  return doc;
}

// Generate sales report PDF
export function generateSalesReportPDF(transactions: Transaction[], settings: AppSettings, title: string = 'Sales Report'): jsPDF {
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
    `${tx.subtotal.toFixed(3)} ${settings.currencySymbol}`,
    `${tx.tax.toFixed(3)} ${settings.currencySymbol}`,
    `${tx.total.toFixed(3)} ${settings.currencySymbol}`,
    tx.paymentMethod,
    tx.refunded ? 'Refunded' : 'Complete',
  ]);

  autoTable(doc, {
    head: [['ID', 'Date', 'Items', 'Subtotal', 'Tax', 'Total', 'Payment', 'Status']],
    body: tableData,
    startY: 42,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [34, 68, 128] },
  });

  const totalRevenue = transactions.filter(t => !t.refunded).reduce((s, t) => s + t.total, 0);
  const y = (doc.lastAutoTable?.finalY ?? 0) + 10;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Total Transactions: ${transactions.length} | Total Revenue: ${totalRevenue.toFixed(3)} ${settings.currencySymbol}`, 14, y);

  return doc;
}

// Generate receipt HTML for thermal printer
export function generateReceiptHTML(tx: Transaction, settings: AppSettings): string {
  const itemsHTML = tx.items.map(item => `
    <tr>
      <td style="text-align:left">${item.product.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${(item.product.price * item.quantity).toFixed(3)}</td>
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
        <strong style="font-size:14px">${settings.storeName}</strong><br/>
        ${settings.storeAddress ? settings.storeAddress + '<br/>' : ''}
        ${settings.storePhone ? 'Tel: ' + settings.storePhone + '<br/>' : ''}
      </div>
      <div class="line"></div>
      <div class="center">RECEIPT</div>
      <div>Date: ${new Date(tx.timestamp).toLocaleString()}</div>
      <div>Ref: #${tx.id.slice(-6).toUpperCase()}</div>
      ${tx.cashierName ? `<div>Cashier: ${tx.cashierName}</div>` : ''}
      ${tx.customerName ? `<div>Customer: ${tx.customerName}</div>` : ''}
      <div class="line"></div>
      <table>
        <tr><th style="text-align:left">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr>
        ${itemsHTML}
      </table>
      <div class="line"></div>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">${tx.subtotal.toFixed(3)} ${settings.currencySymbol}</td></tr>
        <tr><td>Tax</td><td style="text-align:right">${tx.tax.toFixed(3)} ${settings.currencySymbol}</td></tr>
        ${tx.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${tx.discount.toFixed(3)} ${settings.currencySymbol}</td></tr>` : ''}
        <tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>${tx.total.toFixed(3)} ${settings.currencySymbol}</strong></td></tr>
      </table>
      <div class="line"></div>
      <div class="center">Payment: ${tx.paymentMethod.toUpperCase()}</div>
      <div class="line"></div>
      <div class="center" style="font-size:10px">${settings.receiptFooter}</div>
    </body>
    </html>
  `;
}
