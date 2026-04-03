import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User, AlertCircle, KeyRound, ArrowLeft, Mail, ShieldCheck } from 'lucide-react';

export default function Login() {
  const { login, requestPasswordReset, verifyAndResetPassword } = useAuth();
  const { t, isRTL } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Password reset flow states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'code' | 'success'>('email');
  const [resetUsername, setResetUsername] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError(t('auth.bothRequired'));
      return;
    }
    setLoading(true);

    try {
      const success = await login(username.trim().toLowerCase(), password.trim());
      if (!success) {
        setError(t('auth.invalidCredentials'));
      }
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!resetUsername.trim() || !resetEmail.trim()) {
      setResetError(t('auth.fillAllFields'));
      return;
    }
    setResetLoading(true);

    try {
      const result = await requestPasswordReset(resetUsername.trim(), resetEmail.trim());
      if (result.success) {
        setResetStep('code');
      } else {
        setResetError(result.error || 'Failed to send verification code');
      }
    } catch (err) {
      setResetError('An error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    
    if (!verificationCode.trim()) {
      setResetError('Please enter the verification code');
      return;
    }
    
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setResetError('Please enter and confirm your new password');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 4) {
      setResetError('Password must be at least 4 characters');
      return;
    }

    setResetLoading(true);

    try {
      const result = await verifyAndResetPassword(resetUsername, verificationCode.trim(), newPassword);
      if (result.success) {
        setResetStep('success');
      } else {
        setResetError(result.error || 'Invalid verification code');
      }
    } catch (err) {
      setResetError('An error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const resetResetFlow = () => {
    setShowForgotPassword(false);
    setResetStep('email');
    setResetUsername('');
    setResetEmail('');
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
  };

  if (showForgotPassword) {
    return (
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-900 dark:to-blue-950">
        <div className="w-full max-w-md mx-4">
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
              <img src="./logo.png" alt="RIC Library" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">{t('app.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('auth.passwordRecovery')}</p>
          </div>

          <div className="bg-card rounded-xl shadow-lg border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <KeyRound size={18} />
              {t('auth.resetPassword')}
            </h2>

            {resetStep === 'email' && (
              <form onSubmit={handleRequestReset} className="space-y-4">
                {resetError && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle size={16} />
                    {resetError}
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-sm">
                  <p className="text-blue-800 dark:text-blue-300">
                    <Mail size={14} className="inline mr-1" />
                    Enter your username and email. We'll send a 6-digit verification code to your email.
                  </p>
                </div>

                <div>
                  <Label htmlFor="reset-username">{t('auth.username')}</Label>
                  <Input
                    id="reset-username"
                    name="reset-username"
                    autoComplete="username"
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
                    name="reset-email"
                    type="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>

                <Button type="submit" className="w-full h-11" disabled={resetLoading}>
                  {resetLoading ? 'Sending...' : 'Send Verification Code'}
                </Button>

                <Button type="button" variant="ghost" className="w-full" onClick={resetResetFlow}>
                  <ArrowLeft size={14} className={isRTL ? 'ml-2 rotate-180' : 'mr-2'} />
                  {t('auth.backToLogin')}
                </Button>
              </form>
            )}

            {resetStep === 'code' && (
              <form onSubmit={handleVerifyAndReset} className="space-y-4">
                {resetError && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle size={16} />
                    {resetError}
                  </div>
                )}

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-sm">
                  <p className="text-green-800 dark:text-green-300">
                    <ShieldCheck size={14} className="inline mr-1" />
                    A 6-digit code has been sent to <strong>{resetEmail}</strong>. The code expires in 1 hour.
                  </p>
                </div>

                <div>
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    name="verification-code"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                <Button type="submit" className="w-full h-11" disabled={resetLoading}>
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </Button>

                <Button type="button" variant="ghost" className="w-full" onClick={resetResetFlow}>
                  <ArrowLeft size={14} className={isRTL ? 'ml-2 rotate-180' : 'mr-2'} />
                  {t('auth.backToLogin')}
                </Button>
              </form>
            )}

            {resetStep === 'success' && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 text-sm">
                  <p className="font-medium text-green-800 dark:text-green-300">✓ Password Reset Successful!</p>
                  <p className="text-green-700 dark:text-green-400 mt-1">Your password has been changed. You can now log in with your new password.</p>
                </div>
                <Button className="w-full" onClick={resetResetFlow}>
                  <ArrowLeft size={16} className={isRTL ? 'ml-2 rotate-180' : 'mr-2'} />
                  {t('auth.backToLogin')}
                </Button>
              </div>
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
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <img src="./logo.png" alt="RIC Library" className="w-full h-full object-contain" />
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
                  name="username"
                  autoComplete="username"
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
                  name="password"
                  autoComplete="current-password"
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
        </div>
      </div>
    </div>
  );
}
