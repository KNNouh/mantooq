import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Scale, BookOpen, Users, Clock, Gavel } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/ui/language-switcher';

const Home = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  return (
    <div className={`min-h-screen bg-gradient-subtle ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className={`flex items-center ${language === 'ar' ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
            <div className="flex items-center justify-center">
              <img 
                src="/lovable-uploads/5ac7ae81-9a0f-4618-995a-d9837ee86dbf.png" 
                alt="منطوق - Mantooq" 
                className="w-16 h-16 object-contain dark:hidden" 
              />
              <img 
                src="/lovable-uploads/38c37bca-eb39-4f3c-a215-f82eef9f74ac.png" 
                alt="منطوق - Mantooq" 
                className="w-16 h-16 object-contain hidden dark:block" 
              />
            </div>
          </div>
          
          <div className="flex gap-3 items-center">
            <LanguageSwitcher />
            <Button 
              variant="outline" 
              onClick={() => navigate('/auth')}
              className="border-primary/20"
            >
              {t('auth.login')}
            </Button>
            <Button 
              onClick={() => navigate('/auth')}
              className="bg-gradient-mantooq hover:opacity-90 transition-opacity"
            >
              {t('auth.start')}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full mb-6 bg-gradient-to-br from-primary/10 to-mantooq-gold/10 backdrop-blur-sm">
              <img 
                src="/lovable-uploads/5ac7ae81-9a0f-4618-995a-d9837ee86dbf.png" 
                alt="منطوق - Mantooq" 
                className="w-28 h-28 object-contain dark:hidden drop-shadow-xl" 
              />
              <img 
                src="/lovable-uploads/38c37bca-eb39-4f3c-a215-f82eef9f74ac.png" 
                alt="منطوق - Mantooq" 
                className="w-28 h-28 object-contain hidden dark:block drop-shadow-xl" 
              />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-mantooq bg-clip-text text-transparent">
              {t('hero.title')}
            </span>
          </h1>
          
          <h2 className="text-2xl md:text-3xl font-semibold text-primary mb-4">
            {t('hero.subtitle')}
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-4xl mx-auto leading-relaxed">
            {t('hero.description')}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="bg-gradient-mantooq hover:opacity-90 transition-opacity text-lg px-8 py-3"
            >
              <MessageCircle className={`w-5 h-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {t('hero.start_chat')}
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-primary/20 text-lg px-8 py-3"
            >
              <BookOpen className={`w-5 h-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {t('hero.learn_more')}
            </Button>
          </div>

          {/* Brand Pattern */}
          <div className="flex justify-center items-center space-x-4 text-mantooq-gold">
            <div className="w-2 h-2 bg-mantooq-gold rounded-full"></div>
            <div className="w-3 h-3 bg-mantooq-gold rounded-full"></div>
            <div className="w-4 h-4 bg-mantooq-gold rounded-full"></div>
            <div className="text-2xl">✦</div>
            <div className="w-4 h-4 bg-mantooq-gold rounded-full"></div>
            <div className="w-3 h-3 bg-mantooq-gold rounded-full"></div>
            <div className="w-2 h-2 bg-mantooq-gold rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-mantooq bg-clip-text text-transparent">
              {t('features.title')}
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="border-primary/10 hover:border-primary/20 transition-colors group">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Scale className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">{t('features.legal_expertise.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">
                {t('features.legal_expertise.desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 hover:border-primary/20 transition-colors group">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">{t('features.qatar_law.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">
                {t('features.qatar_law.desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 hover:border-primary/20 transition-colors group">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">{t('features.instant_response.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">
                {t('features.instant_response.desc')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-card/50 py-16 border-y">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">24/7</div>
              <p className="text-muted-foreground">{t('stats.available')}</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">99.9%</div>
              <p className="text-muted-foreground">{t('stats.accuracy')}</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">1</div>
              <p className="text-muted-foreground">{t('stats.laws')}</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">∞</div>
              <p className="text-muted-foreground">{t('stats.unlimited')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            <span className="bg-gradient-mantooq bg-clip-text text-transparent">
              {t('cta.title')}
            </span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            {t('cta.subtitle')}
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="bg-gradient-mantooq hover:opacity-90 transition-opacity text-lg px-8 py-4"
          >
            <Gavel className={`w-5 h-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {t('cta.join')}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <div className={`flex items-center justify-center ${language === 'ar' ? 'space-x-reverse space-x-3' : 'space-x-3'} mb-4`}>
            <div className="flex items-center justify-center">
              <img 
                src="/lovable-uploads/5ac7ae81-9a0f-4618-995a-d9837ee86dbf.png" 
                alt="منطوق - Mantooq" 
                className="w-12 h-12 object-contain dark:hidden" 
              />
              <img 
                src="/lovable-uploads/38c37bca-eb39-4f3c-a215-f82eef9f74ac.png" 
                alt="منطوق - Mantooq" 
                className="w-12 h-12 object-contain hidden dark:block" 
              />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;