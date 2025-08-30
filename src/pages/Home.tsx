import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Scale, BookOpen, Users, Clock, Gavel } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/ui/language-switcher';
import AboutDialog from '@/components/ui/about-dialog';

const Home = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  return (
    <div className={`min-h-screen bg-gradient-subtle ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50" role="banner">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className={`flex items-center ${language === 'ar' ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
            <div className="flex items-center justify-center">
              <img 
                src="/lovable-uploads/5ac7ae81-9a0f-4618-995a-d9837ee86dbf.png" 
                alt="منطوق - Mantooq" 
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain dark:hidden" 
              />
              <img 
                src="/lovable-uploads/38c37bca-eb39-4f3c-a215-f82eef9f74ac.png" 
                alt="منطوق - Mantooq" 
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain hidden dark:block" 
              />
            </div>
          </div>
          
          <div className="flex gap-2 sm:gap-3 items-center">
            <LanguageSwitcher />
            <Button 
              variant="outline" 
              onClick={() => navigate('/auth')}
              className="border-primary/20 touch-target text-sm sm:text-base"
              size="sm"
              aria-label={t('auth.login')}
            >
              <span className="hidden sm:inline">{t('auth.login')}</span>
              <span className="sm:hidden">دخول</span>
            </Button>
            <Button 
              onClick={() => navigate('/auth')}
              className="bg-gradient-mantooq hover:opacity-90 transition-opacity touch-target text-sm sm:text-base"
              size="sm"
              aria-label={t('auth.start')}
            >
              <span className="hidden sm:inline">{t('auth.start')}</span>
              <span className="sm:hidden">ابدأ</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-8 sm:py-16 text-center" id="main-content" role="main">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-full mb-4 sm:mb-6 bg-gradient-to-br from-primary/10 to-mantooq-gold/10 backdrop-blur-sm">
              <img 
                src="/lovable-uploads/5ac7ae81-9a0f-4618-995a-d9837ee86dbf.png" 
                alt="منطوق - Mantooq" 
                className="w-20 h-20 sm:w-28 sm:h-28 object-contain dark:hidden drop-shadow-xl" 
              />
              <img 
                src="/lovable-uploads/38c37bca-eb39-4f3c-a215-f82eef9f74ac.png" 
                alt="منطوق - Mantooq" 
                className="w-20 h-20 sm:w-28 sm:h-28 object-contain hidden dark:block drop-shadow-xl" 
              />
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 leading-tight text-[hsl(var(--text-gray-dark))]">
            {t('hero.title')}
          </h1>
          
          <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-3 sm:mb-4 text-[hsl(var(--text-blue-primary))]">
            {t('hero.subtitle')}
          </h2>
          
          <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 max-w-4xl mx-auto leading-relaxed text-[hsl(var(--text-blue-secondary))] px-4">
            {t('hero.description')}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-8 sm:mb-12 px-4">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="bg-gradient-mantooq hover:opacity-90 transition-opacity text-base sm:text-lg px-6 sm:px-8 py-3 w-full sm:w-auto touch-target"
              aria-label={t('hero.start_chat')}
            >
              <MessageCircle className={`w-5 h-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {t('hero.start_chat')}
            </Button>
            <AboutDialog>
              <Button 
                variant="outline" 
                size="lg"
                className="border-primary/20 text-base sm:text-lg px-6 sm:px-8 py-3 w-full sm:w-auto touch-target"
                aria-label={t('hero.learn_more')}
              >
                <BookOpen className={`w-5 h-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                {t('hero.learn_more')}
              </Button>
            </AboutDialog>
          </div>

          {/* Brand Pattern */}
          <div className="flex justify-center items-center space-x-2 sm:space-x-4 text-mantooq-gold" aria-hidden="true">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-mantooq-gold rounded-full"></div>
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-mantooq-gold rounded-full"></div>
            <div className="w-2.5 h-2.5 sm:w-4 sm:h-4 bg-mantooq-gold rounded-full"></div>
            <div className="text-lg sm:text-2xl">✦</div>
            <div className="w-2.5 h-2.5 sm:w-4 sm:h-4 bg-mantooq-gold rounded-full"></div>
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-mantooq-gold rounded-full"></div>
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-mantooq-gold rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16" role="region" aria-labelledby="features-heading">
        <div className="text-center mb-8 sm:mb-12">
          <h2 id="features-heading" className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-foreground">
            {t('features.title')}
          </h2>
        </div>

        <div className="grid gap-6 sm:gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          <Card className="border-primary/10 hover:border-primary/20 transition-all duration-200 group touch-target">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors" aria-hidden="true">
                <Scale className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
              <CardTitle className="text-lg sm:text-xl">{t('features.legal_expertise.title')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground text-center leading-relaxed text-sm sm:text-base">
                {t('features.legal_expertise.desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 hover:border-primary/20 transition-all duration-200 group touch-target">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors" aria-hidden="true">
                <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
              <CardTitle className="text-lg sm:text-xl">{t('features.qatar_law.title')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground text-center leading-relaxed text-sm sm:text-base">
                {t('features.qatar_law.desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 hover:border-primary/20 transition-all duration-200 group touch-target md:col-span-1 sm:col-span-1">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors" aria-hidden="true">
                <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
              <CardTitle className="text-lg sm:text-xl">{t('features.instant_response.title')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground text-center leading-relaxed text-sm sm:text-base">
                {t('features.instant_response.desc')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-card/50 py-12 sm:py-16 border-y" role="region" aria-labelledby="stats-heading">
        <div className="container mx-auto px-4">
          <h2 id="stats-heading" className="sr-only">Application Statistics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center max-w-4xl mx-auto">
            <div className="touch-target">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-2" role="text" aria-label="Available 24 hours a day, 7 days a week">24/7</div>
              <p className="text-muted-foreground text-sm sm:text-base">{t('stats.available')}</p>
            </div>
            <div className="touch-target">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-2" role="text" aria-label="99.9% accuracy rate">99.9%</div>
              <p className="text-muted-foreground text-sm sm:text-base">{t('stats.accuracy')}</p>
            </div>
            <div className="touch-target">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-2" role="text" aria-label="Unlimited consultations">∞</div>
              <p className="text-muted-foreground text-sm sm:text-base">{t('stats.unlimited')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-6 sm:py-8" role="contentinfo">
        <div className="container mx-auto px-4 text-center">
          <div className={`flex items-center justify-center ${language === 'ar' ? 'space-x-reverse space-x-3' : 'space-x-3'} mb-4`}>
            <div className="flex items-center justify-center">
              <img 
                src="/lovable-uploads/5ac7ae81-9a0f-4618-995a-d9837ee86dbf.png" 
                alt="منطوق - Mantooq" 
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain dark:hidden" 
              />
              <img 
                src="/lovable-uploads/38c37bca-eb39-4f3c-a215-f82eef9f74ac.png" 
                alt="منطوق - Mantooq" 
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain hidden dark:block" 
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;