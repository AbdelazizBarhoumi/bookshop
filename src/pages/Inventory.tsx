import { useState, useMemo } from 'react';
import { Product, StockEntry, CATEGORY_I18N_KEYS, BuiltInCategory, getAllCategories, getCategoryLabel, getCategoryIcon } from '@/types/pos';
import { addAuditLog, generateId } from '@/lib/storage';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, Package, ArrowUpDown, Clock, Boxes } from 'lucide-react';
import { toast } from 'sonner';

export default function Inventory() {
  const { user } = useAuth();
  const store = useDataStore();
  const { t, formatCurrency, isRTL } = useI18n();
  const products = store.products;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'category'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Stock detail dialog
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockHistory, setStockHistory] = useState<StockEntry[]>([]);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addQty, setAddQty] = useState(0);
  const [addNote, setAddNote] = useState('');

  const customCategories = store.settings.customCategories || [];
  const allCategories = getAllCategories(customCategories, store.settings.language);

  const filtered = useMemo(() => {
    const result = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.includes(search)) ||
        (p.author && p.author.toLowerCase().includes(search.toLowerCase()));
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      let matchStock = true;
      if (stockFilter === 'low') matchStock = p.quantity <= p.lowStockThreshold && p.quantity > 0 && p.category !== 'services';
      if (stockFilter === 'out') matchStock = p.quantity === 0 && p.category !== 'services';
      return matchSearch && matchCat && matchStock;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'quantity') cmp = a.quantity - b.quantity;
      else if (sortBy === 'category') cmp = a.category.localeCompare(b.category);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [products, search, categoryFilter, sortBy, sortDir, stockFilter]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const openStockDetail = (product: Product) => {
    setSelectedProduct(product);
    setStockHistory(store.getStockEntriesForProduct(product.id));
  };

  const openAddStock = () => {
    setAddQty(0);
    setAddNote('');
    setAddStockOpen(true);
  };

  const handleAddStock = () => {
    if (!selectedProduct) return;
    if (addQty <= 0) { toast.error(t('stock.quantityRequired')); return; }

    const entry: StockEntry = {
      id: generateId(),
      productId: selectedProduct.id,
      quantity: addQty,
      note: addNote.trim() || undefined,
      userId: user?.id,
      userName: user?.displayName,
      createdAt: new Date().toISOString(),
    };

    store.addStockEntry(entry);
    addAuditLog('stock_add', `Added ${addQty} units to "${selectedProduct.name}"`, user?.id, user?.displayName);

    // Keep the modal's current stock in sync immediately while the store updates.
    setSelectedProduct(prev => prev ? { ...prev, quantity: prev.quantity + addQty } : prev);
    setStockHistory(store.getStockEntriesForProduct(selectedProduct.id));

    toast.success(t('stock.added'));
    setAddStockOpen(false);
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('stock.title')}</h1>
          <p className="text-muted-foreground text-sm">{products.length} {t('products.productsCount')} · {filtered.length} {t('products.shown')}</p>
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
            {allCategories.map(cat => (
              <SelectItem key={cat.key} value={cat.key}>{cat.icon} {(cat.key in CATEGORY_I18N_KEYS) ? t(CATEGORY_I18N_KEYS[cat.key as BuiltInCategory]) : cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={v => setStockFilter(v as 'all' | 'low' | 'out')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('inventory.allStock')}</SelectItem>
            <SelectItem value="low">{t('inventory.lowStockFilter')}</SelectItem>
            <SelectItem value="out">{t('inventory.outOfStock')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stock Table */}
      <div className="pos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className={`${isRTL ? 'text-right' : 'text-left'} p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none`} onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-1">{t('inventory.product')} <ArrowUpDown size={12} /></span>
                </th>
                <th className={`${isRTL ? 'text-right' : 'text-left'} p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none`} onClick={() => toggleSort('category')}>
                  <span className="flex items-center gap-1">{t('inventory.category')} <ArrowUpDown size={12} /></span>
                </th>
                <th className={`${isRTL ? 'text-left' : 'text-right'} p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none`} onClick={() => toggleSort('quantity')}>
                  <span className={`flex items-center gap-1 ${isRTL ? 'justify-start' : 'justify-end'}`}>{t('inventory.stock')} <ArrowUpDown size={12} /></span>
                </th>
                <th className={`${isRTL ? 'text-left' : 'text-right'} p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider`}>{t('inventory.price')}</th>
                <th className={`${isRTL ? 'text-left' : 'text-right'} p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider`}>{t('inventory.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openStockDetail(p)}>
                  <td className="p-3">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.author && <p className="text-xs text-muted-foreground">{t('inventory.by')} {p.author}</p>}
                      {p.brand && <p className="text-xs text-muted-foreground">{p.brand} · {p.color}</p>}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted">
                      {getCategoryIcon(p.category, customCategories)} {(p.category in CATEGORY_I18N_KEYS) ? t(CATEGORY_I18N_KEYS[p.category as BuiltInCategory]) : getCategoryLabel(p.category, customCategories, store.settings.language)}
                    </span>
                  </td>
                  <td className={`p-3 ${isRTL ? 'text-left' : 'text-right'}`}>
                    <span className={`text-sm font-medium ${
                      p.quantity <= p.lowStockThreshold && p.category !== 'services'
                        ? 'text-destructive'
                        : 'text-foreground'
                    }`}>
                      {p.category === 'services' ? '∞' : p.quantity}
                    </span>
                  </td>
                  <td className={`p-3 ${isRTL ? 'text-left' : 'text-right'} text-sm font-medium`}>{formatCurrency(p.price)}</td>
                  <td className={`p-3 ${isRTL ? 'text-left' : 'text-right'}`}>
                    <Button variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); openStockDetail(p); }}>
                      <Boxes size={14} /> {t('stock.viewProduct')}
                    </Button>
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

      {/* Stock Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes size={18} /> {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {/* Current stock */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground">{t('stock.currentStock')}</p>
                  <p className={`text-2xl font-bold ${
                    selectedProduct.quantity <= selectedProduct.lowStockThreshold && selectedProduct.category !== 'services'
                      ? 'text-destructive' : ''
                  }`}>
                    {selectedProduct.category === 'services' ? '∞' : selectedProduct.quantity}
                  </p>
                </div>
                {selectedProduct.category !== 'services' && (
                  <Button onClick={openAddStock} className="gap-2">
                    <Plus size={16} /> {t('stock.addStock')}
                  </Button>
                )}
              </div>

              {/* Stock history */}
              <div>
                <h3 className="text-sm font-semibold mb-2">{t('stock.history')}</h3>
                {stockHistory.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6">
                    <Clock size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('stock.noHistory')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {stockHistory.map(entry => (
                      <div key={entry.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/20 border">
                        <div>
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">+{entry.quantity} {t('stock.units')}</p>
                          {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                          {entry.userName && <p className="text-xs text-muted-foreground">{t('stock.addedBy')}: {entry.userName}</p>}
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedProduct(null)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={18} /> {t('stock.addStock')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{selectedProduct?.name}</p>
            <div>
              <Label>{t('stock.quantity')}</Label>
              <Input type="number" min="1" value={addQty || ''} onChange={e => setAddQty(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>{t('stock.note')}</Label>
              <Input value={addNote} onChange={e => setAddNote(e.target.value)} placeholder={t('stock.note')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddStockOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddStock} disabled={addQty <= 0}>{t('stock.addStock')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
