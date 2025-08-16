import { useAuth } from '@/components/auth/AuthProvider';
import OptimizedChatInterface from '@/components/chat/OptimizedChatInterface';
import Home from './Home';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-qatar rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-6 h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h1 className="text-2xl font-semibold mb-2">جاري التحميل...</h1>
          <p className="text-muted-foreground">يرجى الانتظار بينما نحمل جلستك</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Home />;
  }

  return <OptimizedChatInterface />;
};

export default Index;
