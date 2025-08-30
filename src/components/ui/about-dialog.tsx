import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from '@/contexts/LanguageContext';

interface AboutDialogProps {
  children: React.ReactNode;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { language, t } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className={`max-w-4xl max-h-[80vh] ${language === 'ar' ? 'text-right direction-rtl' : 'text-left'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className={`text-2xl font-bold mb-4 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {t('hero.learn_more')}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className={`h-[60vh] ${language === 'ar' ? 'pl-4' : 'pr-4'}`}>
          <div className={`space-y-6 ${language === 'ar' ? 'text-right arabic-text' : 'text-left'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            {/* Platform Introduction */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-primary">
                {t('about.platform_intro')}
              </h3>
              <p className="leading-relaxed text-muted-foreground whitespace-pre-line">
                {t('about.platform_desc')}
              </p>
            </section>

            {/* Why Mantqooq */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-primary">
                {t('about.why_mantqooq')}
              </h3>
              <p className="leading-relaxed text-muted-foreground whitespace-pre-line">
                {t('about.why_desc')}
              </p>
            </section>

            {/* Meaning and Values */}
            <section>
              <h4 className="text-lg font-semibold mb-3 text-foreground">
                {t('about.meaning_title')}
              </h4>
              <ul className={`space-y-2 text-muted-foreground ${language === 'ar' ? 'list-rtl' : ''}`}>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.meaning.clarity')}</span>
                </li>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.meaning.accuracy')}</span>
                </li>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.meaning.reliability')}</span>
                </li>
              </ul>
            </section>

            {/* Commitment */}
            <section>
              <p className="leading-relaxed text-muted-foreground">
                {t('about.commitment')}
              </p>
            </section>

            {/* Platform Features */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-primary">
                {t('about.features_title')}
              </h3>
              <ul className={`space-y-2 text-muted-foreground ${language === 'ar' ? 'list-rtl' : ''}`}>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.features.ui')}</span>
                </li>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.features.search')}</span>
                </li>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.features.coverage')}</span>
                </li>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.features.updates')}</span>
                </li>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.features.support')}</span>
                </li>
              </ul>
            </section>

            {/* Suggested Usage */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-primary">
                {t('about.usage_title')}
              </h3>
              <ul className={`space-y-2 text-muted-foreground ${language === 'ar' ? 'list-rtl' : ''}`}>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.usage.meetings')}</span>
                </li>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.usage.audit')}</span>
                </li>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.usage.decision')}</span>
                </li>
                <li className={`flex items-start gap-2 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="text-primary mt-1">•</span>
                  <span>{t('about.usage.compliance')}</span>
                </li>
              </ul>
            </section>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AboutDialog;