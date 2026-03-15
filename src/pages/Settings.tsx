/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { getUsers, addUser, updateUser, deleteUser, generateId, exportAllData, getAuditLogs, addAuditLog } from '@/lib/storage';
import { AppSettings, DEFAULT_SETTINGS, User, UserRole, ROLE_LABELS, ROLE_I18N_KEYS, AuditLog } from '@/types/pos';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18nContext';
import { useDataStore } from '@/lib/dataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, Download, Upload, UserPlus, Trash2, Store, Shield, Database, Printer, Settings as SettingsIcon, Sun, Moon, ScrollText, Clock, Globe, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { Locale } from '@/lib/i18n';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function Settings() {
  const { user: currentUser } = useAuth();
  const { t, formatCurrency, isRTL, setLanguage, locale } = useI18n();
  const { settings, saveSettings, importAllData } = useDataStore();
  const isOwner = currentUser?.role === 'owner';
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [users, setUsers] = useState<User[]>([]);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', displayName: '', role: 'cashier' as UserRole, email: '' });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<{ id: string; displayName: string; role: UserRole; email: string; password: string }>({ id: '', displayName: '', role: 'cashier', email: '', password: '' });

  useEffect(() => {
    setLocalSettings(settings);
    // Load users from main process (never exposes passwordHash)
    if (window.electronAPI?.users) {
      window.electronAPI.users.getAll().then((safeUsers) => {
        setUsers(safeUsers as unknown as User[]);
      });
    } else {
      setUsers(getUsers());
    }
    setAuditLogs(getAuditLogs());
  }, [settings]);

  const handleSaveSettings = () => {
    saveSettings(localSettings);
    addAuditLog('settings_change', 'Settings updated', currentUser?.id, currentUser?.displayName);
    // Apply theme
    if (localSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Apply language
    setLanguage(localSettings.language as Locale);
    toast.success(t('settings.settingsUpdated'));
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  // User management — owner only
  const handleAddUser = async () => {
    if (!isOwner) { toast.error(t('auth.ownerOnly')); return; }
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast.error(t('settings.usernamePasswordRequired'));
      return;
    }
    try {
      if (window.electronAPI?.users) {
        // Password hashing happens in the main process (secure)
        const result = await window.electronAPI.users.create({
          username: newUser.username.trim(),
          password: newUser.password,
          displayName: newUser.displayName.trim() || newUser.username.trim(),
          role: newUser.role,
          email: newUser.email.trim() || undefined,
        });
        if (!result.success) {
          toast.error(result.error || 'Failed to create user');
          return;
        }
        // Refresh user list from main process
        const allUsers = await window.electronAPI.users.getAll();
        setUsers(allUsers as unknown as User[]);
        addAuditLog('user_add', `Created user "${result.user?.displayName}" (${newUser.role})`, currentUser?.id, currentUser?.displayName);
      } else {
        // Browser-only dev fallback
        const user: User = {
          id: generateId(),
          username: newUser.username.trim(),
          passwordHash: '',  // browser dev fallback — no real hash
          displayName: newUser.displayName.trim() || newUser.username.trim(),
          role: newUser.role,
          email: newUser.email.trim() || undefined,
          createdAt: new Date().toISOString(),
        };
        setUsers(addUser(user));
        addAuditLog('user_add', `Created user "${user.displayName}" (${user.role})`, currentUser?.id, currentUser?.displayName);
      }
      setAddUserOpen(false);
      setNewUser({ username: '', password: '', displayName: '', role: 'cashier', email: '' });
      toast.success(t('settings.userCreated'));
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
      else toast.error(String(e));
    }
  };

  const handleDeleteUser = (id: string) => {
    if (!isOwner) { toast.error(t('auth.ownerOnly')); return; }
    if (id === currentUser?.id) {
      toast.error(t('settings.cantDeleteSelf'));
      return;
    }
    setDeleteUserConfirm(id);
  };

  const confirmDeleteUser = async () => {
    if (deleteUserConfirm) {
      const u = users.find(usr => usr.id === deleteUserConfirm);
      if (window.electronAPI?.users) {
        await window.electronAPI.users.delete(deleteUserConfirm);
        const allUsers = await window.electronAPI.users.getAll();
        setUsers(allUsers as unknown as User[]);
      } else {
        setUsers(deleteUser(deleteUserConfirm));
      }
      addAuditLog('user_delete', `Deleted user "${u?.displayName || deleteUserConfirm}"`, currentUser?.id, currentUser?.displayName);
      toast.success(t('settings.userDeleted'));
      setDeleteUserConfirm(null);
    }
  };

  const handleOpenEditUser = (u: User) => {
    if (!isOwner) { toast.error(t('auth.ownerOnly')); return; }
    setEditUser({ id: u.id, displayName: u.displayName, role: u.role, email: u.email || '', password: '' });
    setEditUserOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!isOwner) { toast.error(t('auth.ownerOnly')); return; }
    try {
      if (window.electronAPI?.users) {
        const result = await window.electronAPI.users.update(editUser.id, {
          displayName: editUser.displayName.trim(),
          role: editUser.role,
          email: editUser.email.trim() || undefined,
          password: editUser.password || undefined,
        });
        if (!result.success) {
          toast.error(result.error || 'Failed to update user');
          return;
        }
        const allUsers = await window.electronAPI.users.getAll();
        setUsers(allUsers as unknown as User[]);
      } else {
        // Browser-only dev fallback
        const existing = users.find(u => u.id === editUser.id);
        if (existing) {
          const updated: User = {
            ...existing,
            displayName: editUser.displayName.trim() || existing.displayName,
            role: editUser.role,
            email: editUser.email.trim() || undefined,
          };
          setUsers(updateUser(updated));
        }
      }
      addAuditLog('user_add', `Updated user "${editUser.displayName}"`, currentUser?.id, currentUser?.displayName);
      setEditUserOpen(false);
      toast.success(t('settings.userUpdated'));
    } catch (e: unknown) {
      if (e instanceof Error) toast.error(e.message);
      else toast.error(String(e));
    }
  };

  // Backup & Restore — owner only
  const handleBackup = async () => {
    if (!isOwner) { toast.error(t('auth.ownerOnly')); return; }
    const data = exportAllData();
    const json = JSON.stringify(data, null, 2);

    if (window.electronAPI) {
      const result = await window.electronAPI.backupData(json);
      if (result.success) toast.success(t('settings.backupSaved', { path: result.path || '' }));
    } else {
      // Fallback for browser
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `riadhlibrary-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('settings.backupDownloaded'));
    }
  };

  const handleRestore = async () => {
    if (!isOwner) { toast.error(t('auth.ownerOnly')); return; }
    if (window.electronAPI) {
      const result = await window.electronAPI.restoreData();
      if (result.success && result.data) {
        try {
          const data = JSON.parse(result.data);
          importAllData(data);
          setLocalSettings(settings);
          if (window.electronAPI?.users) {
            window.electronAPI.users.getAll().then(u => setUsers(u as unknown as User[]));
          } else {
            setUsers(getUsers());
          }
          toast.success(t('settings.dataRestored'));
        } catch {
          toast.error(t('settings.invalidBackup'));
        }
      }
    } else {
      // Fallback: file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result as string);
            importAllData(data);
            setLocalSettings(settings);
            if (window.electronAPI?.users) {
              window.electronAPI.users.getAll().then(u => setUsers(u as unknown as User[]));
            } else {
              setUsers(getUsers());
            }
            toast.success(t('settings.dataRestored'));
          } catch {
            toast.error(t('settings.invalidBackup'));
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
  };

  const handleAutoBackup = async () => {
    if (window.electronAPI) {
      const data = exportAllData();
      const json = JSON.stringify(data, null, 2);
      const result = await window.electronAPI.autoBackup(json);
      if (result.success) toast.success(t('settings.autoBackupSaved'));
    }
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('settings.configureStore')}</p>
      </div>

      <Tabs defaultValue="store" className="w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="overflow-x-auto -mx-6 px-6">
          <TabsList className="inline-flex w-auto min-w-full max-w-none">
            <TabsTrigger value="store" className="gap-1"><Store size={14} /> {t('settings.store')}</TabsTrigger>
            {isOwner && <TabsTrigger value="users" className="gap-1"><Shield size={14} /> {t('settings.users')}</TabsTrigger>}
            <TabsTrigger value="printing" className="gap-1"><Printer size={14} /> {t('settings.printing')}</TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1"><Sun size={14} /> {t('settings.theme')}</TabsTrigger>
            <TabsTrigger value="language" className="gap-1"><Globe size={14} /> {t('settings.language')}</TabsTrigger>
            {isOwner && <TabsTrigger value="backup" className="gap-1"><Database size={14} /> {t('settings.backup')}</TabsTrigger>}
            {isOwner && <TabsTrigger value="audit" className="gap-1"><ScrollText size={14} /> {t('settings.auditLogs')}</TabsTrigger>}
          </TabsList>
        </div>

        {/* Store Settings */}
        <TabsContent value="store" className="mt-4">
          <div className="pos-card p-6 max-w-2xl space-y-4">
            <h3 className="font-semibold text-lg">{t('settings.storeInfo')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t('settings.storeName')}</Label>
                <Input value={localSettings.storeName} onChange={e => updateSetting('storeName', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>{t('settings.storeAddress')}</Label>
                <Input value={localSettings.storeAddress} onChange={e => updateSetting('storeAddress', e.target.value)} />
              </div>
              <div>
                <Label>{t('settings.storePhone')}</Label>
                <Input value={localSettings.storePhone} onChange={e => updateSetting('storePhone', e.target.value)} />
              </div>
              <div>
                <Label>{t('settings.currencySymbol')}</Label>
                <Input value={localSettings.currencySymbol} onChange={e => updateSetting('currencySymbol', e.target.value)} />
              </div>
              <div>
                <Label>{t('settings.storeEmailLabel')}</Label>
                <Input value={localSettings.storeEmail || ''} onChange={e => updateSetting('storeEmail', e.target.value)} placeholder={t('settings.storeEmailPlaceholder')} />
              </div>
              <div>
                <Label>{t('settings.sessionTimeout')}</Label>
                <Input type="number" min="1" max="120" value={localSettings.sessionTimeoutMinutes} onChange={e => updateSetting('sessionTimeoutMinutes', parseInt(e.target.value) || 10)} />
              </div>
              <div className="col-span-2">
                <Label>{t('settings.receiptFooter')}</Label>
                <Input value={localSettings.receiptFooter} onChange={e => updateSetting('receiptFooter', e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSaveSettings} className="gap-2">
              <Save size={16} /> {t('settings.save')}
            </Button>
          </div>
        </TabsContent>

        {/* User Management */}
        <TabsContent value="users" className="mt-4">
          <div className="pos-card p-6 max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{t('settings.userAccounts')}</h3>
              <Button onClick={() => setAddUserOpen(true)} size="sm" className="gap-2">
                <UserPlus size={14} /> {t('settings.addUser')}
              </Button>
            </div>
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{u.displayName}</p>
                    <p className="text-sm text-muted-foreground">@{u.username} · {t(ROLE_I18N_KEYS[u.role])}</p>
                    {u.lastLogin && (
                      <p className="text-xs text-muted-foreground">{t('settings.lastLogin')}: {new Date(u.lastLogin).toLocaleString()}</p>
                    )}
                  </div>
                  {u.id !== currentUser?.id && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteUser(u.id)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEditUser(u)}>
                    <Edit2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('settings.addNewUser')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t('auth.username')}</Label>
                  <Input value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} placeholder={t('auth.username')} />
                </div>
                <div>
                  <Label>{t('auth.password')}</Label>
                  <Input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder={t('auth.password')} />
                </div>
                <div>
                  <Label>{t('settings.displayName')}</Label>
                  <Input value={newUser.displayName} onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))} placeholder={t('settings.displayName')} />
                </div>
                <div>
                  <Label>{t('settings.emailRecovery')}</Label>
                  <Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="user@example.com" />
                </div>
                <div>
                  <Label>{t('settings.role')}</Label>
                  <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v as UserRole }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(ROLE_I18N_KEYS).map(k => (
                        <SelectItem key={k} value={k}>{t(ROLE_I18N_KEYS[k as UserRole])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setAddUserOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={handleAddUser}>{t('settings.createUser')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('settings.editUser')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t('settings.displayName')}</Label>
                  <Input value={editUser.displayName} onChange={e => setEditUser(p => ({ ...p, displayName: e.target.value }))} placeholder={t('settings.displayName')} />
                </div>
                <div>
                  <Label>{t('settings.emailRecovery')}</Label>
                  <Input type="email" value={editUser.email} onChange={e => setEditUser(p => ({ ...p, email: e.target.value }))} placeholder="user@example.com" />
                </div>
                <div>
                  <Label>{t('settings.role')}</Label>
                  <Select value={editUser.role} onValueChange={v => setEditUser(p => ({ ...p, role: v as UserRole }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(ROLE_I18N_KEYS).map(k => (
                        <SelectItem key={k} value={k}>{t(ROLE_I18N_KEYS[k as UserRole])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('settings.newPassword')}</Label>
                  <Input type="password" value={editUser.password} onChange={e => setEditUser(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setEditUserOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={handleUpdateUser}>{t('settings.saveUser')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Printing Settings */}
        <TabsContent value="printing" className="mt-4">
          <div className="pos-card p-6 max-w-2xl space-y-4">
            <h3 className="font-semibold text-lg">{t('settings.printingPrices')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('settings.bwPrice')}</Label>
                <Input type="number" step="0.001" min="0" value={localSettings.bwPricePerPage} onChange={e => updateSetting('bwPricePerPage', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>{t('settings.colorPrice')}</Label>
                <Input type="number" step="0.001" min="0" value={localSettings.colorPricePerPage} onChange={e => updateSetting('colorPricePerPage', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>{t('settings.spiralPrice')}</Label>
                <Input type="number" step="0.001" min="0" value={localSettings.spiralBindingPrice} onChange={e => updateSetting('spiralBindingPrice', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>{t('settings.staplePrice')}</Label>
                <Input type="number" step="0.001" min="0" value={localSettings.stapleBindingPrice} onChange={e => updateSetting('stapleBindingPrice', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <Button onClick={handleSaveSettings} className="gap-2">
              <Save size={16} /> {t('settings.save')}
            </Button>
          </div>
        </TabsContent>

        {/* Backup & Restore */}
        <TabsContent value="backup" className="mt-4">
          <div className="pos-card p-6 max-w-2xl space-y-6">
            <h3 className="font-semibold text-lg">{t('settings.backupRestore')}</h3>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
              <div>
                <p className="font-medium">{t('settings.autoBackupLabel')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.autoBackupDesc')}</p>
              </div>
              <Switch
                checked={localSettings.autoBackup}
                onCheckedChange={checked => {
                  updateSetting('autoBackup', checked);
                  saveSettings({ ...localSettings, autoBackup: checked });
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button variant="outline" className="gap-2 h-auto py-4" onClick={handleBackup}>
                <Download size={18} />
                <div className="text-start">
                  <p className="text-sm font-medium">{t('settings.manualBackup')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.saveToFile')}</p>
                </div>
              </Button>
              <Button variant="outline" className="gap-2 h-auto py-4" onClick={handleRestore}>
                <Upload size={18} />
                <div className="text-start">
                  <p className="text-sm font-medium">{t('settings.restore')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.fromBackup')}</p>
                </div>
              </Button>
              {window.electronAPI && (
                <Button variant="outline" className="gap-2 h-auto py-4" onClick={handleAutoBackup}>
                  <Database size={18} />
                  <div className="text-start">
                    <p className="text-sm font-medium">{t('settings.quickBackup')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.toAppData')}</p>
                  </div>
                </Button>
              )}
            </div>

            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">{t('settings.important')}</p>
              <p className="text-amber-700 dark:text-amber-400 mt-1">
                {t('settings.restoreWarning')}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          <div className="pos-card p-6 max-w-2xl space-y-6">
            <h3 className="font-semibold text-lg">{t('settings.theme')}</h3>
            <p className="text-sm text-muted-foreground">{t('settings.chooseTheme')}</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                className={`p-6 rounded-lg border-2 flex flex-col items-center gap-3 transition-colors ${localSettings.theme !== 'dark' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
                onClick={() => {
                  updateSetting('theme', 'light');
                  saveSettings({ ...localSettings, theme: 'light' });
                  document.documentElement.classList.remove('dark');
                }}
              >
                <Sun size={32} className="text-amber-500" />
                <span className="font-medium">{t('settings.light')}</span>
              </button>
              <button
                className={`p-6 rounded-lg border-2 flex flex-col items-center gap-3 transition-colors ${localSettings.theme === 'dark' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
                onClick={() => {
                  updateSetting('theme', 'dark');
                  saveSettings({ ...localSettings, theme: 'dark' });
                  document.documentElement.classList.add('dark');
                }}
              >
                <Moon size={32} className="text-indigo-500" />
                <span className="font-medium">{t('settings.dark')}</span>
              </button>
            </div>
          </div>
        </TabsContent>

        {/* Language Settings */}
        <TabsContent value="language" className="mt-4">
          <div className="pos-card p-6 max-w-2xl space-y-6">
            <h3 className="font-semibold text-lg">{t('settings.language')}</h3>
            <p className="text-sm text-muted-foreground">{t('settings.chooseLanguage')}</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                className={`p-6 rounded-lg border-2 flex flex-col items-center gap-3 transition-colors ${localSettings.language === 'en' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
                onClick={() => {
                  updateSetting('language', 'en');
                  saveSettings({ ...localSettings, language: 'en' });
                  setLanguage('en');
                }}
              >
                <Globe size={32} className="text-blue-500" />
                <span className="font-medium">English</span>
                <span className="text-xs text-muted-foreground">{t('settings.ltr')}</span>
              </button>
              <button
                className={`p-6 rounded-lg border-2 flex flex-col items-center gap-3 transition-colors ${localSettings.language === 'ar' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}`}
                onClick={() => {
                  updateSetting('language', 'ar');
                  saveSettings({ ...localSettings, language: 'ar' });
                  setLanguage('ar');
                }}
              >
                <Globe size={32} className="text-green-500" />
                <span className="font-medium">العربية</span>
                <span className="text-xs text-muted-foreground">{t('settings.rtl')}</span>
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <div className="pos-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2"><ScrollText size={18} /> {t('settings.auditLogs')}</h3>
              <p className="text-sm text-muted-foreground">{auditLogs.length} {t('settings.entries')}</p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settings.timestamp')}</TableHead>
                    <TableHead>{t('settings.action')}</TableHead>
                    <TableHead>{t('settings.user')}</TableHead>
                    <TableHead>{t('settings.details')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t('settings.noAuditLogs')}</TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.slice(0, 100).map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.userName || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.details}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* User Delete Confirmation */}
      <ConfirmDialog
        open={deleteUserConfirm !== null}
        onOpenChange={(open) => !open && setDeleteUserConfirm(null)}
        title={t('confirm.deleteUser')}
        description={t('confirm.deleteUserDesc')}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDeleteUser}
      />
    </div>
  );
}
