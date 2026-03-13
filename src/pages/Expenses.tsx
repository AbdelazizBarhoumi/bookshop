import { useState, useMemo } from 'react';
import { generateId, addAuditLog } from '@/lib/storage';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import {
  Expense, ExpenseCategory, ExpensePaymentStatus, ExpenseRecurring,
  EXPENSE_CATEGORY_I18N_KEYS, EXPENSE_PAYMENT_STATUS_I18N_KEYS, EXPENSE_RECURRING_I18N_KEYS,
} from '@/types/pos';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Pencil, Trash2, Receipt, Calendar, TrendingDown,
  DollarSign, Filter, CheckCircle2, Clock, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

const SUPPLIER_NONE = '__none__';

const emptyExpense: Partial<Expense> = {
  description: '',
  category: 'other',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  notes: '',
  paymentStatus: 'paid',
  recurring: 'none',
};

export default function Expenses() {
  const { user } = useAuth();
  const { expenses, suppliers, addExpense, updateExpense, deleteExpense } = useDataStore();
  const { t, formatCurrency, isRTL, locale } = useI18n();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Partial<Expense>>(emptyExpense);
  const [deleteConfirm, setDeleteConfirm] = useState<Expense | null>(null);

  // Available months from existing data
  const months = useMemo(() => {
    const monthSet = new Set<string>();
    expenses.forEach(e => {
      const d = new Date(e.date);
      monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(monthSet).sort().reverse();
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const q = search.toLowerCase();
      const matchSearch = !search || e.description.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q));
      const matchCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const matchMonth = monthFilter === 'all' || e.date.startsWith(monthFilter);
      const matchStatus = statusFilter === 'all' || (e.paymentStatus || 'paid') === statusFilter;
      return matchSearch && matchCategory && matchMonth && matchStatus;
    });
  }, [expenses, search, categoryFilter, monthFilter, statusFilter]);

  // Summary totals
  const monthlySummary = useMemo(() => {
    const totals: Record<string, number> = {};
    let paidTotal = 0;
    let pendingTotal = 0;
    filtered.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
      if ((e.paymentStatus || 'paid') === 'paid') paidTotal += e.amount;
      else pendingTotal += e.amount;
    });
    const total = paidTotal + pendingTotal;
    return { totals, total, paidTotal, pendingTotal };
  }, [filtered]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyExpense, date: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm(e);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.description?.trim()) { toast.error(t('expenses.descriptionRequired')); return; }
    if (!form.amount || form.amount <= 0) { toast.error(t('expenses.amountPositive')); return; }
    const now = new Date().toISOString();
    if (editing) {
      const updated: Expense = {
        ...editing,
        ...form,
        paymentStatus: form.paymentStatus || editing.paymentStatus || 'paid',
        recurring: form.recurring || editing.recurring || 'none',
        updatedAt: now,
      } as Expense;
      updateExpense(updated);
      addAuditLog('expense_edit', `Updated expense "${updated.description}"`, user?.id, user?.displayName);
      toast.success(t('expenses.expenseUpdated'));
    } else {
      const newExpense: Expense = {
        id: generateId(),
        description: form.description!.trim(),
        category: (form.category || 'other') as ExpenseCategory,
        amount: form.amount!,
        date: form.date || now.slice(0, 10),
        supplierId: form.supplierId,
        supplierName: form.supplierName,
        notes: form.notes || '',
        paymentStatus: (form.paymentStatus || 'paid') as ExpensePaymentStatus,
        recurring: (form.recurring || 'none') as ExpenseRecurring,
        createdAt: now,
        updatedAt: now,
      };
      addExpense(newExpense);
      addAuditLog('expense_add', `Added expense "${newExpense.description}": ${formatCurrency(newExpense.amount)}`, user?.id, user?.displayName);
      toast.success(t('expenses.expenseAdded'));
    }
    setDialogOpen(false);
  };

  const handleDelete = (e: Expense) => setDeleteConfirm(e);

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteExpense(deleteConfirm.id);
      addAuditLog('expense_delete', `Deleted expense "${deleteConfirm.description}"`, user?.id, user?.displayName);
      toast.success(t('expenses.expenseDeleted'));
      setDeleteConfirm(null);
    }
  };

  const togglePaymentStatus = (e: Expense) => {
    const newStatus: ExpensePaymentStatus = (e.paymentStatus || 'paid') === 'paid' ? 'pending' : 'paid';
    const updated = { ...e, paymentStatus: newStatus, updatedAt: new Date().toISOString() };
    updateExpense(updated);
    toast.success(newStatus === 'paid' ? t('expense.markedPaid') : t('expense.markedPending'));
  };

  const categoryColors: Record<string, string> = {
    rent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    utilities: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    supplies: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    salary: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    marketing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    transport: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    insurance: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300',
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('expenses.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('expenses.expensesTracked', { count: expenses.length })}</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} /> {t('expenses.add')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="pos-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('expenses.totalExpenses')}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(monthlySummary.total)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted text-red-600">
              <TrendingDown size={20} />
            </div>
          </div>
        </div>
        <div className="pos-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('expense.paid')}</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(monthlySummary.paidTotal)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted text-green-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>
        <div className="pos-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('expense.pending')}</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{formatCurrency(monthlySummary.pendingTotal)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted text-amber-600">
              <Clock size={20} />
            </div>
          </div>
        </div>
        {Object.entries(monthlySummary.totals).slice(0, 1).map(([cat, total]) => (
          <div key={cat} className="pos-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t(EXPENSE_CATEGORY_I18N_KEYS[cat as ExpenseCategory])}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(total)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted text-amber-600">
                <DollarSign size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
          <Input placeholder={t('expenses.searchExpenses')} value={search} onChange={e => setSearch(e.target.value)} className={isRTL ? 'pr-9' : 'pl-9'} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter size={14} className={isRTL ? 'ml-1' : 'mr-1'} />
            <SelectValue placeholder={t('expenses.category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('expenses.allCategories')}</SelectItem>
            {Object.entries(EXPENSE_CATEGORY_I18N_KEYS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{t(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('expense.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('expense.allStatuses')}</SelectItem>
            <SelectItem value="paid">{t('expense.paid')}</SelectItem>
            <SelectItem value="pending">{t('expense.pending')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[160px]">
            <Calendar size={14} className={isRTL ? 'ml-1' : 'mr-1'} />
            <SelectValue placeholder={t('expenses.date')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('expenses.allMonths')}</SelectItem>
            {months.map(m => (
              <SelectItem key={m} value={m}>
                {new Date(m + '-01').toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expense List */}
      {filtered.length === 0 ? (
        <div className="pos-card p-12 flex flex-col items-center text-muted-foreground">
          <Receipt size={48} className="opacity-30 mb-3" />
          <p>{t('expenses.noExpensesFound')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className={`pos-card p-4 flex items-center gap-4 ${(e.paymentStatus || 'paid') === 'pending' ? 'border-l-4 border-l-amber-500' : ''}`}>
              <div className={`px-2.5 py-1 rounded-md text-xs font-medium ${categoryColors[e.category] || categoryColors.other}`}>
                {t(EXPENSE_CATEGORY_I18N_KEYS[e.category])}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{e.description}</p>
                  {e.recurring && e.recurring !== 'none' && (
                    <Badge variant="outline" className="text-xs gap-1 py-0 h-5">
                      <RefreshCw size={10} />
                      {t(EXPENSE_RECURRING_I18N_KEYS[e.recurring])}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.date).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {e.supplierName && ` · ${e.supplierName}`}
                </p>
              </div>
              <Badge
                variant={(e.paymentStatus || 'paid') === 'paid' ? 'default' : 'secondary'}
                className={`cursor-pointer text-xs ${(e.paymentStatus || 'paid') === 'paid' ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300'}`}
                onClick={() => togglePaymentStatus(e)}
              >
                {(e.paymentStatus || 'paid') === 'paid' ? <CheckCircle2 size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
                {t(EXPENSE_PAYMENT_STATUS_I18N_KEYS[(e.paymentStatus || 'paid') as ExpensePaymentStatus])}
              </Badge>
              <p className="text-lg font-bold text-red-600 shrink-0">{formatCurrency(e.amount)}</p>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(e)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('expenses.editExpense') : t('expenses.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('expenses.description')} *</Label>
              <Input value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={t('expenses.whatExpense')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('expenses.category')}</Label>
                <Select value={form.category || 'other'} onValueChange={v => setForm(p => ({ ...p, category: v as ExpenseCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_CATEGORY_I18N_KEYS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{t(v)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('expenses.amountCurrency', { currency: t('common.currency') })} *</Label>
                <Input type="number" step="0.001" min="0" value={form.amount || ''} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('expenses.date')}</Label>
                <Input type="date" value={form.date || ''} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <Label>{t('expenses.supplierOptional')}</Label>
                <Select
                  value={form.supplierId || SUPPLIER_NONE}
                  onValueChange={v => {
                    if (v === SUPPLIER_NONE) {
                      setForm(p => ({ ...p, supplierId: undefined, supplierName: undefined }));
                    } else {
                      const sup = suppliers.find(s => s.id === v);
                      setForm(p => ({ ...p, supplierId: v, supplierName: sup?.name || undefined }));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder={t('expenses.none')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SUPPLIER_NONE}>{t('expenses.none')}</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('expense.paymentStatusLabel')}</Label>
                <Select value={form.paymentStatus || 'paid'} onValueChange={v => setForm(p => ({ ...p, paymentStatus: v as ExpensePaymentStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_PAYMENT_STATUS_I18N_KEYS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{t(v)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('expense.recurringLabel')}</Label>
                <Select value={form.recurring || 'none'} onValueChange={v => setForm(p => ({ ...p, recurring: v as ExpenseRecurring }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_RECURRING_I18N_KEYS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{t(v)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('common.notes')}</Label>
              <Input value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('expenses.optionalNotes')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.update') : t('expenses.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={t('confirm.deleteExpense')}
        description={t('confirm.deleteExpenseDesc')}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
