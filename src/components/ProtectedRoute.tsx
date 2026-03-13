import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18nContext';
import { ShieldX } from 'lucide-react';

interface ProtectedRouteProps {
  permission: string;
  children: ReactNode;
}

/**
 * Route-level permission guard.
 * If the user lacks the required permission the component either
 * redirects to the first allowed page or shows an "Access Denied" banner.
 */
export default function ProtectedRoute({ permission, children }: ProtectedRouteProps) {
  const { hasPermission } = useAuth();
  const { t } = useI18n();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  // Try to redirect to the first permitted page
  const fallbacks = ['dashboard', 'pos', 'inventory'];
  for (const fb of fallbacks) {
    if (hasPermission(fb)) {
      const path = fb === 'dashboard' ? '/' : `/${fb}`;
      return <Navigate to={path} replace />;
    }
  }

  // Edge case: no permission at all – show denial screen
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <ShieldX size={48} className="text-destructive" />
      <h2 className="text-xl font-bold">{t('auth.accessDenied')}</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        {t('auth.noPermission')}
      </p>
    </div>
  );
}
