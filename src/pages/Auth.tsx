import React from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            العودة للرئيسية
          </Button>
          
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-qatar rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="text-right">
              <h1 className="text-xl font-bold bg-gradient-qatar bg-clip-text text-transparent">
                Qatar AI Assistant
              </h1>
              <p className="text-xs text-muted-foreground">مساعد قطر الذكي</p>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-2">مرحباً بك</h2>
          <p className="text-muted-foreground">
            سجل دخولك أو أنشئ حساباً جديداً للبدء
          </p>
        </div>

        {/* Auth Form */}
        <AuthForm />

        {/* Cultural Pattern */}
        <div className="flex justify-center items-center space-x-4 text-cultural-gold mt-8">
          <div className="w-1 h-1 bg-cultural-gold rounded-full"></div>
          <div className="w-2 h-2 bg-cultural-gold rounded-full"></div>
          <div className="text-lg">✦</div>
          <div className="w-2 h-2 bg-cultural-gold rounded-full"></div>
          <div className="w-1 h-1 bg-cultural-gold rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default Auth;