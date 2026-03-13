import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18nContext";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-6xl font-black text-muted-foreground/30">404</div>
        <h1 className="text-2xl font-bold">{t('notFound.title')}</h1>
        <p className="text-muted-foreground">{t('notFound.message')}</p>
        <Button asChild>
          <Link to="/" className="gap-2">
            <Home size={16} />
            {t('notFound.returnHome')}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
