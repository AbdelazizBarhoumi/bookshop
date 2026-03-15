/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { generateId, addAuditLog } from '@/lib/storage';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { Supplier, PurchaseOrder, PurchaseOrderItem, Product } from '@/types/pos';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Pencil, Trash2, Truck, Phone, Mail, MapPin, Package,
  ClipboardList, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

const emptySupplier: Partial<Supplier> = {
  name: '', contactPerson: '', phone: '', email: '', address: '', notes: '',
};

export default function Suppliers() {
  const { user } = useAuth();
  const { suppliers, purchaseOrders: orders, products, addSupplier, updateSupplier, deleteSupplier, addPurchaseOrder, receivePurchaseOrder } = useDataStore();
  const { t, formatCurrency, isRTL } = useI18n();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Partial<Supplier>>(emptySupplier);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  const openAdd = () => { setEditing(null); setForm(emptySupplier); setDialogOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm(s); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name?.trim()) { toast.error(t('suppliers.nameRequired')); return; }
    const now = new Date().toISOString();
    if (editing) {
      const updated = { ...editing, ...form, updatedAt: now } as Supplier;
      updateSupplier(updated);
      addAuditLog('supplier_edit', `Updated supplier "${updated.name}"`, user?.id, user?.displayName);
      toast.success(t('suppliers.supplierUpdated'));
    } else {
      const newSupplier: Supplier = {
        id: generateId(),
        name: form.name!.trim(),
        contactPerson: form.contactPerson || '',
        phone: form.phone || '',
        email: form.email || '',
        address: form.address || '',
        notes: form.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      addSupplier(newSupplier);
      addAuditLog('supplier_add', `Added supplier "${newSupplier.name}"`, user?.id, user?.displayName);
      toast.success(t('suppliers.supplierAdded'));
    }
    setDialogOpen(false);
  };

  const handleDelete = (s: Supplier) => {
    setDeleteConfirm(s);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteSupplier(deleteConfirm.id);
      addAuditLog('supplier_delete', `Deleted supplier "${deleteConfirm.name}"`, user?.id, user?.displayName);
      toast.success(t('suppliers.supplierDeleted'));
      setDeleteConfirm(null);
    }
  };

  const openCreateOrder = (s: Supplier) => {
    setSelectedSupplier(s);
    setOrderItems([]);
    setOrderNotes('');
    setOrderDialogOpen(true);
  };

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, { productId: '', productName: '', quantity: 1, unitCost: 0, total: 0 }]);
  };

  const updateOrderItem = (index: number, field: keyof PurchaseOrderItem, value: string | number) => {
    setOrderItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'productId') {
        const product = products.find(p => p.id === value);
        if (product) {
          updated.productName = product.name;
          updated.unitCost = product.cost;
          updated.total = updated.quantity * product.cost;
        }
      }
      if (field === 'quantity' || field === 'unitCost') {
        updated.total = Number(updated.quantity) * Number(updated.unitCost);
      }
      return updated;
    }));
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateOrder = () => {
    if (!selectedSupplier || orderItems.length === 0) {
      toast.error(t('suppliers.addAtLeastOne'));
      return;
    }
    const validItems = orderItems.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) { toast.error(t('suppliers.selectProducts')); return; }

    const now = new Date().toISOString();
    const order: PurchaseOrder = {
      id: generateId(),
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      items: validItems,
      totalAmount: validItems.reduce((s, i) => s + i.total, 0),
      status: 'pending',
      orderDate: now,
      notes: orderNotes,
      createdAt: now,
      updatedAt: now,
    };
    addPurchaseOrder(order);
    addAuditLog('purchase_order_create', `Created PO for ${selectedSupplier.name}: ${formatCurrency(order.totalAmount)}`, user?.id, user?.displayName);
    setOrderDialogOpen(false);
    toast.success(t('suppliers.orderCreated'));
  };

  const handleReceiveOrder = (orderId: string) => {
    receivePurchaseOrder(orderId);
    addAuditLog('purchase_order_receive', `Received PO #${orderId.slice(-6).toUpperCase()}`, user?.id, user?.displayName);
    toast.success(t('suppliers.orderReceived'));
  };

  const supplierOrders = (supplierId: string) => orders.filter(o => o.supplierId === supplierId);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="text-amber-500" />;
      case 'received': return <CheckCircle size={14} className="text-green-500" />;
      case 'cancelled': return <XCircle size={14} className="text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('suppliers.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('suppliers.suppliersCount', { count: suppliers.length })} · {t('suppliers.pendingOrders', { count: orders.filter(o => o.status === 'pending').length })}</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} /> {t('suppliers.add')}
        </Button>
      </div>

      <Tabs defaultValue="suppliers" dir={isRTL ? 'rtl' : 'ltr'}>
        <TabsList>
          <TabsTrigger value="suppliers" className="gap-1"><Truck size={14} /> {t('suppliers.title')}</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1"><ClipboardList size={14} /> {t('suppliers.purchaseOrders')}</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
            <Input placeholder={t('suppliers.searchSuppliers')} value={search} onChange={e => setSearch(e.target.value)} className={isRTL ? 'pr-9' : 'pl-9'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(s => (
              <div key={s.id} className="pos-card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      {s.contactPerson && <p className="text-xs text-muted-foreground">{s.contactPerson}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(s)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {s.phone && <p className="flex items-center gap-1"><Phone size={10} /> {s.phone}</p>}
                  {s.email && <p className="flex items-center gap-1"><Mail size={10} /> {s.email}</p>}
                  {s.address && <p className="flex items-center gap-1"><MapPin size={10} /> {s.address}</p>}
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {supplierOrders(s.id).length} {t('suppliers.orders')} · {supplierOrders(s.id).filter(o => o.status === 'pending').length} {t('suppliers.pending')}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openCreateOrder(s)}>
                    <Package size={12} /> {t('suppliers.newOrder')}
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full pos-card p-12 flex flex-col items-center text-muted-foreground">
                <Truck size={48} className="opacity-30 mb-3" />
                <p>{t('suppliers.noSuppliersFound')}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-3">
          {orders.length === 0 ? (
            <div className="pos-card p-12 flex flex-col items-center text-muted-foreground">
              <ClipboardList size={48} className="opacity-30 mb-3" />
              <p>{t('suppliers.noPurchaseOrders')}</p>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} className={`pos-card p-4 ${order.status === 'cancelled' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground">#{order.id.slice(-6).toUpperCase()}</span>
                      <span className="flex items-center gap-1 text-xs">
                        {statusIcon(order.status)} {t(`suppliers.orderStatus.${order.status}`)}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1">{order.supplierName}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('suppliers.ordered')}: {new Date(order.orderDate).toLocaleDateString()}
                      {order.receivedDate && ` · ${t('suppliers.received')}: ${new Date(order.receivedDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(order.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">{order.items.length} {t('suppliers.items')}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t space-y-1">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.productName} × {item.quantity}</span>
                      <span className="font-medium">{Math.round(item.total)}</span>
                    </div>
                  ))}
                </div>
                {order.status === 'pending' && (
                  <div className="mt-3 pt-2 border-t flex justify-end">
                    <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleReceiveOrder(order.id)}>
                      <CheckCircle size={12} /> {t('suppliers.markReceived')}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('suppliers.editSupplier') : t('suppliers.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('suppliers.companyName')} *</Label>
              <Input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t('suppliers.supplierName')} />
            </div>
            <div>
              <Label>{t('suppliers.contactPerson')}</Label>
              <Input value={form.contactPerson || ''} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} placeholder={t('suppliers.contactName')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('suppliers.phone')}</Label>
                <Input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder={t('suppliers.phone')} />
              </div>
              <div>
                <Label>{t('suppliers.email')}</Label>
                <Input value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder={t('suppliers.email')} />
              </div>
            </div>
            <div>
              <Label>{t('suppliers.address')}</Label>
              <Input value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder={t('suppliers.address')} />
            </div>
            <div>
              <Label>{t('suppliers.notes')}</Label>
              <Input value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('suppliers.notesOptional')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.update') : t('suppliers.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('suppliers.createPurchaseOrder')} — {selectedSupplier?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {orderItems.map((item, i) => (
              <div key={i} className="flex items-end gap-2 p-3 rounded-lg bg-muted/30">
                <div className="flex-1">
                  <Label className="text-xs">{t('inventory.product')}</Label>
                  <Select value={item.productId} onValueChange={v => updateOrderItem(i, 'productId', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('suppliers.selectProduct')} /></SelectTrigger>
                    <SelectContent>
                      {products.filter(p => p.category !== 'services').map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-16">
                  <Label className="text-xs">{t('suppliers.qty')}</Label>
                  <Input type="number" min="1" className="h-8 text-xs" value={item.quantity} onChange={e => updateOrderItem(i, 'quantity', parseInt(e.target.value) || 1)} />
                </div>
                <div className="w-20">
                  <Label className="text-xs">{t('suppliers.cost')}</Label>
                  <Input type="number" step="0.001" min="0" className="h-8 text-xs" value={item.unitCost} onChange={e => updateOrderItem(i, 'unitCost', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="w-20 text-right">
                  <p className="text-xs text-muted-foreground">{t('suppliers.total')}</p>
                  <p className="text-sm font-medium">{Math.round(item.total)}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeOrderItem(i)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
            <Button variant="outline" className="w-full gap-2" onClick={addOrderItem}>
              <Plus size={14} /> {t('suppliers.addItem')}
            </Button>
            <div>
              <Label>{t('suppliers.notes')}</Label>
              <Input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder={t('suppliers.orderNotes')} />
            </div>
            {orderItems.length > 0 && (
              <div className="p-3 rounded-lg bg-muted flex justify-between">
                <span className="font-medium">{t('suppliers.orderTotal')}</span>
                <span className="text-lg font-bold">{formatCurrency(orderItems.reduce((s, i) => s + i.total, 0))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOrderDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateOrder}>{t('suppliers.createOrder')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={t('confirm.deleteSupplier')}
        description={t('confirm.deleteSupplierDesc')}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
