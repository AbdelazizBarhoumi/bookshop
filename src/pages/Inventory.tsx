import { useState, useMemo } from 'react';
import { getSettings } from '@/lib/storage';
import { Product, ProductCategory, CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_I18N_KEYS } from '@/types/pos';
import { exportProductsCSV, importProductsCSV } from '@/lib/csv';
import { generateInventoryPDF } from '@/lib/pdf';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Package, Upload, Download, FileText, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

const emptyProduct: Partial<Product> = {
  name: '', category: 'other', price: 0, cost: 0, quantity: 0, lowStockThreshold: 5, description: '',
};

export default function Inventory() {
  const store = useDataStore();
  const { t, formatCurrency, isRTL } = useI18n();
  const products = store.products;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>(emptyProduct);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'quantity' | 'category'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const filtered = useMemo(() => {
    const result = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.includes(search)) ||
        (p.author && p.author.toLowerCase().includes(search.toLowerCase())) ||
        (p.supplier && p.supplier.toLowerCase().includes(search.toLowerCase()));
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      let matchStock = true;
      if (stockFilter === 'low') matchStock = p.quantity <= p.lowStockThreshold && p.quantity > 0 && p.category !== 'services';
      if (stockFilter === 'out') matchStock = p.quantity === 0 && p.category !== 'services';
      return matchSearch && matchCat && matchStock;
    });
    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'price') cmp = a.price - b.price;
      else if (sortBy === 'quantity') cmp = a.quantity - b.quantity;
      else if (sortBy === 'category') cmp = a.category.localeCompare(b.category);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [products, search, categoryFilter, sortBy, sortDir, stockFilter]);

  const openAdd = () => { setEditing(null); setForm(emptyProduct); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm(p); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name?.trim()) { toast.error(t('inventory.nameRequired')); return; }
    if ((form.price ?? 0) < 0) { toast.error(t('inventory.pricePositive')); return; }

    const now = new Date().toISOString();
    if (editing) {
      const updated = { ...editing, ...form, updatedAt: now } as Product;
      store.updateProduct(updated);
      toast.success(t('inventory.productUpdated'));
    } else {
      const newProduct: Product = {
        ...form,
        id: store.generateId(),
        name: form.name!.trim(),
        category: (form.category || 'other') as ProductCategory,
        price: form.price || 0,
        cost: form.cost || 0,
        quantity: form.quantity || 0,
        lowStockThreshold: form.lowStockThreshold || 5,
        createdAt: now,
        updatedAt: now,
      };
      store.addProduct(newProduct);
      toast.success(t('inventory.productAdded'));
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    store.deleteProduct(id);
    toast.success(t('inventory.productDeleted'));
  };

  const updateField = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const handleExportCSV = () => {
    const csv = exportProductsCSV(products);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('inventory.exportedCSV'));
  };

  const handleExportPDF = () => {
    const settings = getSettings();
    const doc = generateInventoryPDF(products, settings);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('inventory.exportedPDF'));
  };

  const handleImportCSV = () => {
    if (window.electronAPI) {
      window.electronAPI.importCSV().then(result => {
        if (result.success && result.data) {
          const { products: imported, errors } = importProductsCSV(result.data);
          if (imported.length > 0) {
            store.bulkAddProducts(imported);
            toast.success(t('inventory.imported', { count: imported.length }));
          }
          if (errors.length > 0) {
            toast.error(t('inventory.importErrors', { count: errors.length }));
          }
        }
      });
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const { products: imported, errors } = importProductsCSV(reader.result as string);
          if (imported.length > 0) {
            store.bulkAddProducts(imported);
            toast.success(t('inventory.imported', { count: imported.length }));
          }
          if (errors.length > 0) {
            toast.error(t('inventory.importErrors', { count: errors.length }));
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('inventory.title')}</h1>
          <p className="text-muted-foreground text-sm">{products.length} {t('inventory.productsCount')} · {filtered.length} {t('inventory.shown')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImportCSV} className="gap-1">
            <Upload size={14} /> {t('inventory.importCSV')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1">
            <Download size={14} /> {t('inventory.exportCSV')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1">
            <FileText size={14} /> {t('inventory.exportPDF')}
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus size={16} /> {t('inventory.addProduct')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
          <Input
            placeholder={t('inventory.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={isRTL ? 'pr-9' : 'pl-9'}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('inventory.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('inventory.allCategories')}</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k]) => (
              <SelectItem key={k} value={k}>{CATEGORY_ICONS[k as ProductCategory]} {t(CATEGORY_I18N_KEYS[k as ProductCategory])}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={v => setStockFilter(v as 'all' | 'low' | 'out')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Stock Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('inventory.allStock')}</SelectItem>
            <SelectItem value="low">{t('inventory.lowStockFilter')}</SelectItem>
            <SelectItem value="out">{t('inventory.outOfStock')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Product Table */}
      <div className="pos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-1">{t('inventory.product')} <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('category')}>
                  <span className="flex items-center gap-1">{t('inventory.category')} <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('price')}>
                  <span className="flex items-center gap-1 justify-end">{t('inventory.price')} <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('quantity')}>
                  <span className="flex items-center gap-1 justify-end">{t('inventory.stock')} <ArrowUpDown size={12} /></span>
                </th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('inventory.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-3">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.author && <p className="text-xs text-muted-foreground">{t('inventory.by')} {p.author}</p>}
                      {p.brand && <p className="text-xs text-muted-foreground">{p.brand} · {p.color}</p>}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted">
                      {CATEGORY_ICONS[p.category]} {t(CATEGORY_I18N_KEYS[p.category])}
                    </span>
                  </td>
                  <td className="p-3 text-right text-sm font-medium">{formatCurrency(p.price)}</td>
                  <td className="p-3 text-right">
                    <span className={`text-sm font-medium ${
                      p.quantity <= p.lowStockThreshold && p.category !== 'services'
                        ? 'text-destructive'
                        : 'text-foreground'
                    }`}>
                      {p.category === 'services' ? '∞' : p.quantity}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">
                    <Package size={40} className="mx-auto mb-3 opacity-30" />
                    <p>{t('inventory.noProductsFound')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('inventory.editProduct') : t('inventory.addProduct')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t('inventory.productName')}</Label>
                <Input value={form.name || ''} onChange={e => updateField('name', e.target.value)} placeholder={t('inventory.productName')} />
              </div>
              <div>
                <Label>{t('inventory.category')}</Label>
                <Select value={form.category || 'other'} onValueChange={v => updateField('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k]) => (
                      <SelectItem key={k} value={k}>{t(CATEGORY_I18N_KEYS[k as ProductCategory])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('inventory.barcode')}</Label>
                <Input value={form.barcode || ''} onChange={e => updateField('barcode', e.target.value)} placeholder={t('inventory.optional')} />
              </div>
              <div>
                <Label>{t('inventory.supplier')}</Label>
                <Input value={form.supplier || ''} onChange={e => updateField('supplier', e.target.value)} placeholder={t('inventory.optional')} />
              </div>
              <div>
                <Label>{t('inventory.priceCurrency', { currency: 'SDG' })}</Label>
                <Input type="number" step="0.001" min="0" value={form.price || ''} onChange={e => updateField('price', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>{t('inventory.costCurrency', { currency: 'SDG' })}</Label>
                <Input type="number" step="0.001" min="0" value={form.cost || ''} onChange={e => updateField('cost', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>{t('inventory.quantity')}</Label>
                <Input type="number" min="0" value={form.quantity || ''} onChange={e => updateField('quantity', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <Label>{t('inventory.lowStockThreshold')}</Label>
                <Input type="number" min="0" value={form.lowStockThreshold || ''} onChange={e => updateField('lowStockThreshold', parseInt(e.target.value) || 0)} />
              </div>
              {(form.category === 'books') && (
                <>
                  <div><Label>{t('inventory.author')}</Label><Input value={form.author || ''} onChange={e => updateField('author', e.target.value)} /></div>
                  <div><Label>{t('inventory.isbn')}</Label><Input value={form.isbn || ''} onChange={e => updateField('isbn', e.target.value)} /></div>
                </>
              )}
              {(form.category === 'writing') && (
                <>
                  <div><Label>{t('inventory.brand')}</Label><Input value={form.brand || ''} onChange={e => updateField('brand', e.target.value)} /></div>
                  <div><Label>{t('inventory.color')}</Label><Input value={form.color || ''} onChange={e => updateField('color', e.target.value)} /></div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.update') : t('inventory.addProduct')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
