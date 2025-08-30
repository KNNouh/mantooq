import React from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <a href="#auth-form" className="skip-link">
        Skip to authentication form
      </a>
      
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="absolute top-4 left-4 text-muted-foreground hover:text-foreground touch-target"
            size="sm"
            aria-label="العودة للرئيسية"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">العودة للرئيسية</span>
            <span className="sm:hidden">العودة</span>
          </Button>
          
          <div className="flex items-center justify-center space-x-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-qatar rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <div className="text-right">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-qatar bg-clip-text text-transparent">
                Qatar AI Assistant
              </h1>
              <p className="text-xs text-muted-foreground">مساعد قطر الذكي</p>
            </div>
          </div>
          
          <h2 className="text-xl sm:text-2xl font-bold mb-2">مرحباً بك</h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            سجل دخولك أو أنشئ حساباً جديداً للبدء
          </p>
        </div>

        {/* Auth Form */}
        <div id="auth-form">
          <AuthForm />
        </div>

        {/* Cultural Pattern */}
        <div className="flex justify-center items-center space-x-2 sm:space-x-4 text-cultural-gold mt-6 sm:mt-8" aria-hidden="true">
          <div className="w-1 h-1 bg-cultural-gold rounded-full"></div>
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cultural-gold rounded-full"></div>
          <div className="text-base sm:text-lg">✦</div>
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cultural-gold rounded-full"></div>
          <div className="w-1 h-1 bg-cultural-gold rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default Auth;