import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Shield, Globe, Users, Star, Zap } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-qatar rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-qatar bg-clip-text text-transparent">
                Qatar AI Assistant
              </h1>
              <p className="text-xs text-muted-foreground">مساعد قطر الذكي</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/auth')}
              className="border-primary/20"
            >
              تسجيل الدخول
            </Button>
            <Button 
              onClick={() => navigate('/auth')}
              className="bg-gradient-qatar hover:opacity-90 transition-opacity"
            >
              ابدأ الآن
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-qatar rounded-full mb-6">
              <Star className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-qatar bg-clip-text text-transparent">
              مرحباً بك في مساعد قطر الذكي
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Your intelligent assistant powered by advanced AI technology, designed to serve the people of Qatar with cultural understanding and excellence.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="bg-gradient-qatar hover:opacity-90 transition-opacity text-lg px-8 py-3"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              ابدأ المحادثة الآن
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-primary/20 text-lg px-8 py-3"
            >
              <Globe className="w-5 h-5 mr-2" />
              تعرف على المزيد
            </Button>
          </div>

          {/* Cultural Pattern */}
          <div className="flex justify-center items-center space-x-4 text-cultural-gold">
            <div className="w-2 h-2 bg-cultural-gold rounded-full"></div>
            <div className="w-3 h-3 bg-cultural-gold rounded-full"></div>
            <div className="w-4 h-4 bg-cultural-gold rounded-full"></div>
            <div className="text-2xl">✦</div>
            <div className="w-4 h-4 bg-cultural-gold rounded-full"></div>
            <div className="w-3 h-3 bg-cultural-gold rounded-full"></div>
            <div className="w-2 h-2 bg-cultural-gold rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-qatar bg-clip-text text-transparent">
              لماذا تختار مساعد قطر الذكي؟
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience the perfect blend of cutting-edge AI technology and deep cultural understanding
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="border-primary/10 hover:border-primary/20 transition-colors group">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">الأمان والخصوصية</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">
                Your conversations are protected with enterprise-grade security, ensuring complete privacy and data protection.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 hover:border-primary/20 transition-colors group">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">الثقافة القطرية</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">
                Deeply understands Qatari culture, traditions, and values, providing culturally appropriate responses.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 hover:border-primary/20 transition-colors group">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">استجابة فورية</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">
                Get instant, intelligent responses powered by the latest AI technology for efficient communication.
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
              <p className="text-muted-foreground">متاح دائماً</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">99.9%</div>
              <p className="text-muted-foreground">موثوقية عالية</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">2</div>
              <p className="text-muted-foreground">لغتان</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">∞</div>
              <p className="text-muted-foreground">إمكانيات لا محدودة</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            <span className="bg-gradient-qatar bg-clip-text text-transparent">
              ابدأ رحلتك مع الذكاء الاصطناعي
            </span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of users who trust Qatar AI Assistant for their daily needs
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="bg-gradient-qatar hover:opacity-90 transition-opacity text-lg px-8 py-4"
          >
            <Users className="w-5 h-5 mr-2" />
            انضم إلينا الآن
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-qatar rounded-lg flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-primary">Qatar AI Assistant</span>
          </div>
          <p className="text-muted-foreground text-sm">
            © 2024 Qatar AI Assistant. Made with ❤️ for the people of Qatar.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;