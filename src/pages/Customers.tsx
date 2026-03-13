import { useState, useMemo } from 'react';
import { generateId } from '@/lib/storage';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { Customer, Transaction } from '@/types/pos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Users, Star, Phone, Mail, History, Gift } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

const emptyCustomer: Partial<Customer> = {
  name: '', phone: '', email: '', notes: '',
};

export default function Customers() {
  const { customers, transactions, addCustomer, updateCustomer, deleteCustomer } = useDataStore();
  const { t, formatCurrency, isRTL } = useI18n();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>(emptyCustomer);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const customerTransactions = useMemo(() => {
    if (!selectedCustomer) return [];
    return transactions.filter(tx => tx.customerId === selectedCustomer.id);
  }, [selectedCustomer, transactions]);

  const openAdd = () => { setEditing(null); setForm(emptyCustomer); setDialogOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm(c); setDialogOpen(true); };
  const openHistory = (c: Customer) => { setSelectedCustomer(c); setHistoryOpen(true); };
  const openRedeem = (c: Customer) => { setSelectedCustomer(c); setRedeemPoints(0); setRedeemOpen(true); };

  const handleSave = () => {
    if (!form.name?.trim()) { toast.error(t('customers.nameRequired')); return; }
    const now = new Date().toISOString();
    if (editing) {
      const updated = { ...editing, ...form, updatedAt: now } as Customer;
      updateCustomer(updated);
      toast.success(t('customers.customerUpdated'));
    } else {
      const newCustomer: Customer = {
        id: generateId(),
        name: form.name!.trim(),
        phone: form.phone || '',
        email: form.email || '',
        notes: form.notes || '',
        loyaltyPoints: 0,
        totalSpent: 0,
        purchaseCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      addCustomer(newCustomer);
      toast.success(t('customers.customerAdded'));
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteCustomer(deleteConfirm);
      toast.success(t('customers.customerDeleted'));
      setDeleteConfirm(null);
    }
  };

  const handleRedeemPoints = () => {
    if (!selectedCustomer) return;
    if (redeemPoints <= 0 || redeemPoints > selectedCustomer.loyaltyPoints) {
      toast.error(t('customers.validAmount', { max: selectedCustomer.loyaltyPoints }));
      return;
    }
    const updated = {
      ...selectedCustomer,
      loyaltyPoints: selectedCustomer.loyaltyPoints - redeemPoints,
      updatedAt: new Date().toISOString(),
    };
    updateCustomer(updated);
    setSelectedCustomer(updated);
    setRedeemOpen(false);
    toast.success(t('customers.redeemed', { points: redeemPoints, amount: formatCurrency(redeemPoints * 0.01) }));
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('customers.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('customers.customersCount', { count: customers.length })}</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} /> {t('customers.add')}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
        <Input placeholder={t('customers.searchCustomers')} value={search} onChange={e => setSearch(e.target.value)} className={isRTL ? 'pr-9' : 'pl-9'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="pos-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{c.name}</p>
                  {c.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone size={10} /> {c.phone}
                    </p>
                  )}
                  {c.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail size={10} /> {c.email}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistory(c)} title={t('customers.purchaseHistory')}>
                  <History size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-lg font-bold">{c.purchaseCount}</p>
                <p className="text-xs text-muted-foreground">{t('customers.purchases')}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-lg font-bold">{formatCurrency(c.totalSpent)}</p>
                <p className="text-xs text-muted-foreground">{t('customers.totalCurrency', { currency: t('common.currency') })}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 cursor-pointer hover:bg-accent/10 transition-colors" onClick={() => c.loyaltyPoints > 0 && openRedeem(c)} title={c.loyaltyPoints > 0 ? t('customers.redeemPoints') : undefined}>
                <p className="text-lg font-bold flex items-center justify-center gap-1">
                  <Star size={12} className="text-yellow-500" /> {c.loyaltyPoints}
                </p>
                <p className="text-xs text-muted-foreground">{t('customers.points')}</p>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full pos-card p-12 flex flex-col items-center text-muted-foreground">
            <Users size={48} className="opacity-30 mb-3" />
            <p>{t('customers.noCustomersFound')}</p>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('customers.editCustomer') : t('customers.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('common.name')}</Label><Input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t('customers.customerName')} /></div>
            <div><Label>{t('common.phone')}</Label><Input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder={t('customers.phoneNumber')} /></div>
            <div><Label>{t('common.email')}</Label><Input value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder={t('customers.emailAddress')} /></div>
            <div><Label>{t('common.notes')}</Label><Input value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('customers.notesOptional')} /></div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.update') : t('customers.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History size={18} />{selectedCustomer?.name} — {t('customers.purchaseHistory')}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {customerTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t('customers.noPurchaseHistory')}</p>
            ) : (
              customerTransactions.map(tx => (
                <div key={tx.id} className={`p-3 rounded-lg border ${tx.refunded ? 'opacity-60 border-red-200' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-muted-foreground">#{tx.id.slice(-6).toUpperCase()}</span>
                      {tx.refunded && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{t('customers.refunded')}</span>}
                    </div>
                    <span className="font-bold">{formatCurrency(tx.total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(tx.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {tx.items.map((item, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {item.product.name} × {item.quantity} — {formatCurrency(item.product.price * item.quantity)}
                      </p>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Loyalty Points Redemption Dialog */}
      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gift size={18} /> {t('customers.redeemPoints')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('customers.pointsAvailable', { name: selectedCustomer?.name || '', points: selectedCustomer?.loyaltyPoints || 0 })}
            </p>
            <p className="text-xs text-muted-foreground">{t('customers.pointValue', { currency: t('common.currency') })}</p>
            <div>
              <Label>{t('customers.pointsToRedeem')}</Label>
              <Input
                type="number"
                min="1"
                max={selectedCustomer?.loyaltyPoints || 0}
                value={redeemPoints || ''}
                onChange={e => setRedeemPoints(parseInt(e.target.value) || 0)}
                placeholder={t('customers.enterPoints')}
              />
              {redeemPoints > 0 && (
                <p className="text-sm text-green-600 mt-1">
                  {t('customers.discountValue', { amount: formatCurrency(redeemPoints * 0.01) })}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRedeemOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleRedeemPoints}>{t('customers.redeemPoints')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={t('confirm.deleteCustomer')}
        description={t('confirm.deleteCustomerDesc')}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
