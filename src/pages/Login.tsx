import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react';

export default function Login() {
  const { login, resetPassword } = useAuth();
  const { t, isRTL } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetResult, setResetResult] = useState<{ success: boolean; newPassword?: string; error?: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError(t('auth.bothRequired'));
      return;
    }
    setLoading(true);

    setTimeout(() => {
      // make login more forgiving: trim whitespace and normalize case for username, trim password
      const success = login(username.trim().toLowerCase(), password.trim());
      if (!success) {
        setError(t('auth.invalidCredentials'));
      }
      setLoading(false);
    }, 300);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUsername.trim() || !resetEmail.trim()) {
      setResetResult({ success: false, error: t('auth.fillAllFields') });
      return;
    }
    const result = resetPassword(resetUsername.trim(), resetEmail.trim());
    setResetResult(result);
  };

  if (showForgotPassword) {
    return (
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-900 dark:to-blue-950">
        <div className="w-full max-w-md mx-4">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-black mx-auto mb-4">
              S
            </div>
            <h1 className="text-3xl font-bold text-foreground">{t('app.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('auth.passwordRecovery')}</p>
          </div>

          <div className="bg-card rounded-xl shadow-lg border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <KeyRound size={18} />
              {t('auth.resetPassword')}
            </h2>

            {resetResult?.success ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 text-sm">
                  <p className="font-medium text-green-800 dark:text-green-300">{t('auth.resetSuccess')}</p>
                  <p className="text-green-700 dark:text-green-400 mt-1">{t('auth.newTempPassword')}</p>
                  <p className="font-mono font-bold text-green-900 dark:text-green-200 mt-1 bg-green-100 dark:bg-green-800/30 px-3 py-1.5 rounded">{resetResult.newPassword}</p>
                  <p className="text-green-600 dark:text-green-400 mt-2 text-xs">{t('auth.changeAfterLogin')}</p>
                </div>
                <Button className="w-full" onClick={() => { setShowForgotPassword(false); setResetResult(null); }}>
                  <ArrowLeft size={16} className={isRTL ? 'ml-2 rotate-180' : 'mr-2'} />
                  {t('auth.backToLogin')}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {resetResult?.error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle size={16} />
                    {resetResult.error}
                  </div>
                )}

                <div>
                  <Label htmlFor="reset-username">{t('auth.username')}</Label>
                  <Input
                    id="reset-username"
                    value={resetUsername}
                    onChange={e => setResetUsername(e.target.value)}
                    placeholder={t('auth.enterUsername')}
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="reset-email">{t('common.email')}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder={t('auth.enterAccountEmail')}
                  />
                </div>

                <Button type="submit" className="w-full h-11">
                  {t('auth.resetPassword')}
                </Button>

                <Button type="button" variant="ghost" className="w-full" onClick={() => { setShowForgotPassword(false); setResetResult(null); }}>
                  <ArrowLeft size={14} className={isRTL ? 'ml-2 rotate-180' : 'mr-2'} />
                  {t('auth.backToLogin')}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-900 dark:to-blue-950">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-black mx-auto mb-4">
            S
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t('app.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('auth.bookshopManagement')}</p>
        </div>

        <div className="bg-card rounded-xl shadow-lg border p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock size={18} />
            {t('auth.signIn')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="username">{t('auth.username')}</Label>
              <div className="relative mt-1">
                <User size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
                <Input
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={t('auth.enterUsername')}
                  className={isRTL ? 'pr-9' : 'pl-9'}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setShowForgotPassword(true)}
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
              <div className="relative mt-1">
                <Lock size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('auth.enterPassword')}
                  className={isRTL ? 'pr-9' : 'pl-9'}
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              {t('auth.defaultCredentials')}
            </p>
            <button
              type="button"
              className="text-xs text-primary hover:underline block mx-auto"
              onClick={() => {
                if (window.confirm(t('auth.confirmReset'))) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
            >
              {t('auth.resetApp')}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {t('auth.offlineApp')}
        </p>
      </div>
    </div>
  );
}
