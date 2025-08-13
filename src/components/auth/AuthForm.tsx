import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from './AuthProvider';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const AuthForm: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await signIn(formData.email, formData.password);
      toast({
        title: 'نجح تسجيل الدخول',
        description: 'تم تسجيل دخولك بنجاح.',
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'خطأ في تسجيل الدخول',
        description: error.message === 'Invalid login credentials' ? 
          'بيانات الدخول غير صحيحة' : 
          error.message || 'فشل تسجيل الدخول',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {},
          captchaToken: undefined,
          emailRedirectTo: undefined
        }
      });
      
      if (error) throw error;
      
      // If signup is successful and session exists, user is automatically signed in
      if (data.session) {
        toast({
          title: 'تم إنشاء الحساب بنجاح',
          description: 'تم تسجيل دخولك تلقائياً.',
        });
        navigate('/');
      } else {
        toast({
          title: 'تم إنشاء الحساب',
          description: 'تم إنشاء حسابك بنجاح.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'خطأ في إنشاء الحساب',
        description: error.message === 'User already registered' ?
          'المستخدم مسجل بالفعل' :
          error.message || 'فشل إنشاء الحساب',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full border-primary/10 shadow-lg">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl font-bold">
          <span className="bg-gradient-qatar bg-clip-text text-transparent">
            تسجيل الدخول
          </span>
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          سجل دخولك أو أنشئ حساباً جديداً للمتابعة
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50">
            <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              تسجيل الدخول
            </TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              حساب جديد
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="space-y-4 mt-6">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-right">البريد الإلكتروني</Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  placeholder="أدخل بريدك الإلكتروني"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="border-primary/20 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password" className="text-right">كلمة المرور</Label>
                <Input
                  id="signin-password"
                  name="password"
                  type="password"
                  placeholder="أدخل كلمة المرور"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="border-primary/20 focus:border-primary"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-qatar hover:opacity-90 transition-opacity" 
                disabled={loading}
              >
                {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4 mt-6">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-right">البريد الإلكتروني</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="أدخل بريدك الإلكتروني"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="border-primary/20 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-right">كلمة المرور</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  placeholder="أنشئ كلمة مرور (6 أحرف على الأقل)"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="border-primary/20 focus:border-primary"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-qatar hover:opacity-90 transition-opacity" 
                disabled={loading}
              >
                {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب جديد'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};