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
          <DialogTitle className={`text-3xl font-bold mb-6 ${language === 'ar' ? 'text-right arabic-text' : 'text-left'} text-foreground`}>
            {t('hero.learn_more')}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className={`h-[60vh] ${language === 'ar' ? 'pl-4' : 'pr-4'}`}>
          <div className={`space-y-8 ${language === 'ar' ? 'text-right arabic-text' : 'text-left'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            {/* Platform Introduction */}
            <section>
              <h3 className={`text-2xl font-bold mb-4 text-primary ${language === 'ar' ? 'arabic-text' : ''}`}>
                {t('about.platform_intro')}
              </h3>
              <p className={`text-lg leading-loose text-muted-foreground whitespace-pre-line ${language === 'ar' ? 'arabic-text' : ''}`}>
                {t('about.platform_desc')}
              </p>
            </section>

            {/* Why Mantqooq */}
            <section>
              <h3 className={`text-2xl font-bold mb-4 text-primary ${language === 'ar' ? 'arabic-text' : ''}`}>
                {t('about.why_mantqooq')}
              </h3>
              <p className={`text-lg leading-loose text-muted-foreground whitespace-pre-line ${language === 'ar' ? 'arabic-text' : ''}`}>
                {t('about.why_desc')}
              </p>
            </section>

            {/* Meaning and Values */}
            <section>
              <h4 className={`text-xl font-semibold mb-4 text-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                {t('about.meaning_title')}
              </h4>
              <ul className={`space-y-3 ${language === 'ar' ? 'arabic-list' : ''}`} style={language === 'ar' ? { direction: 'rtl', textAlign: 'right' } : {}}>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.meaning.clarity')}
                </li>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.meaning.accuracy')}
                </li>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.meaning.reliability')}
                </li>
              </ul>
            </section>

            {/* Commitment */}
            <section>
              <p className={`text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                {t('about.commitment')}
              </p>
            </section>

            {/* Platform Features */}
            <section>
              <h3 className={`text-2xl font-bold mb-4 text-primary ${language === 'ar' ? 'arabic-text' : ''}`}>
                {t('about.features_title')}
              </h3>
              <ul className={`space-y-3 ${language === 'ar' ? 'arabic-list' : ''}`} style={language === 'ar' ? { direction: 'rtl', textAlign: 'right' } : {}}>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.features.ui')}
                </li>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.features.search')}
                </li>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.features.coverage')}
                </li>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.features.updates')}
                </li>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.features.support')}
                </li>
              </ul>
            </section>

            {/* Suggested Usage */}
            <section>
              <h3 className={`text-2xl font-bold mb-4 text-primary ${language === 'ar' ? 'arabic-text' : ''}`}>
                {t('about.usage_title')}
              </h3>
              <ul className={`space-y-3 ${language === 'ar' ? 'arabic-list' : ''}`} style={language === 'ar' ? { direction: 'rtl', textAlign: 'right' } : {}}>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.usage.meetings')}
                </li>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.usage.audit')}
                </li>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
                  {t('about.usage.decision')}
                </li>
                <li className={`arabic-list-item text-lg leading-loose text-muted-foreground ${language === 'ar' ? 'arabic-text' : ''}`}>
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