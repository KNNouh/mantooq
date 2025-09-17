import React, { useState, useEffect } from 'react';
import { MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface OptimizedChatLoadingIndicatorProps {
  conversationId: string;
  onRetry?: () => void;
  onTimeout?: () => void;
}

const OptimizedChatLoadingIndicator: React.FC<OptimizedChatLoadingIndicatorProps> = ({
  conversationId,
  onRetry,
  onTimeout
}) => {
  const { language } = useLanguage();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Simple timer with 30 second timeout (reduced from 90s)
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        
        if (newTime >= 30) {
          setIsTimedOut(true);
          onTimeout?.();
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeout]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isTimedOut) {
    return (
      <div className={`flex ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg max-w-sm">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <span className="text-sm font-medium text-destructive">
              {language === 'ar' ? 'انتهت مهلة الطلب' : 'Request Timed Out'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ar' 
              ? 'الطلب استغرق وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.'
              : 'The request took longer than expected. Please try again.'
            }
          </p>
          {onRetry && (
            <Button 
              onClick={onRetry} 
              size="sm" 
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
      <div className="bg-muted/80 backdrop-blur-sm p-4 rounded-lg border max-w-sm w-full">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full flex-shrink-0"></div>
          <MessageCircle className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-foreground/90">
              {language === 'ar' ? 'جاري التفكير...' : 'Thinking...'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>

        {/* Warning for requests taking longer than usual */}
        {elapsedTime > 15 && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mt-2">
            <AlertCircle className="h-3 w-3" />
            <span>
              {language === 'ar' ? 'يستغرق وقتاً أطول من المعتاد...' : 'Taking longer than usual...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizedChatLoadingIndicator;