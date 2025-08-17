import React from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-muted-foreground" />
      <div className="flex bg-muted rounded-lg p-1">
        <Button
          variant={language === 'ar' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setLanguage('ar')}
          className={`text-xs px-3 py-1 ${
            language === 'ar' 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-background'
          }`}
        >
          ع
        </Button>
        <Button
          variant={language === 'en' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setLanguage('en')}
          className={`text-xs px-3 py-1 ${
            language === 'en' 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-background'
          }`}
        >
          EN
        </Button>
      </div>
    </div>
  );
};

export default LanguageSwitcher;