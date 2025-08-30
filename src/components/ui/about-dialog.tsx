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
              <ul className={`space-y-2 text-muted-foreground ${language === 'ar' ? 'arabic-list' : ''}`} style={language === 'ar' ? { direction: 'rtl', textAlign: 'right' } : {}}>
                <li className="arabic-list-item">
                  {t('about.meaning.clarity')}
                </li>
                <li className="arabic-list-item">
                  {t('about.meaning.accuracy')}
                </li>
                <li className="arabic-list-item">
                  {t('about.meaning.reliability')}
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
              <ul className={`space-y-2 text-muted-foreground ${language === 'ar' ? 'arabic-list' : ''}`} style={language === 'ar' ? { direction: 'rtl', textAlign: 'right' } : {}}>
                <li className="arabic-list-item">
                  {t('about.features.ui')}
                </li>
                <li className="arabic-list-item">
                  {t('about.features.search')}
                </li>
                <li className="arabic-list-item">
                  {t('about.features.coverage')}
                </li>
                <li className="arabic-list-item">
                  {t('about.features.updates')}
                </li>
                <li className="arabic-list-item">
                  {t('about.features.support')}
                </li>
              </ul>
            </section>

            {/* Suggested Usage */}
            <section>
              <h3 className="text-xl font-bold mb-3 text-primary">
                {t('about.usage_title')}
              </h3>
              <ul className={`space-y-2 text-muted-foreground ${language === 'ar' ? 'arabic-list' : ''}`} style={language === 'ar' ? { direction: 'rtl', textAlign: 'right' } : {}}>
                <li className="arabic-list-item">
                  {t('about.usage.meetings')}
                </li>
                <li className="arabic-list-item">
                  {t('about.usage.audit')}
                </li>
                <li className="arabic-list-item">
                  {t('about.usage.decision')}
                </li>
                <li className="arabic-list-item">
                  {t('about.usage.compliance')}
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