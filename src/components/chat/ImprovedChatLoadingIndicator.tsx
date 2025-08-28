import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { MessageCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface ImprovedChatLoadingIndicatorProps {
  conversationId: string;
  onRetry?: () => void;
  onTimeout?: () => void;
}

const ImprovedChatLoadingIndicator: React.FC<ImprovedChatLoadingIndicatorProps> = ({
  conversationId,
  onRetry,
  onTimeout
}) => {
  const { language } = useLanguage();
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  const stages = [
    { label: 'Processing your message...', labelAr: 'معالجة رسالتك...', progress: 25 },
    { label: 'Generating response...', labelAr: 'إنشاء الرد...', progress: 65 },
    { label: 'Finalizing...', labelAr: 'اللمسات الأخيرة...', progress: 90 }
  ];

  // Timer management with cleanup
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        
        // Progress stages
        if (newTime === 15 && currentStage === 0) {
          setCurrentStage(1);
        } else if (newTime === 45 && currentStage === 1) {
          setCurrentStage(2);
        } else if (newTime >= 90) {
          setIsTimedOut(true);
          onTimeout?.();
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStage, onTimeout]);

  // Smooth progress animation
  useEffect(() => {
    const targetProgress = stages[currentStage]?.progress || 10;
    
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev < targetProgress) {
          return Math.min(prev + 2, targetProgress);
        }
        return prev;
      });
    }, 100);

    return () => clearInterval(progressTimer);
  }, [currentStage]);

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

  const currentStageData = stages[currentStage] || stages[0];

  return (
    <div className={`flex ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
      <div className="bg-muted/80 backdrop-blur-sm p-4 rounded-lg border max-w-sm w-full">
        <div className="space-y-3">
          {/* Stage indicator */}
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full flex-shrink-0"></div>
            <MessageCircle className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium text-foreground/90 min-w-0">
              {language === 'ar' ? currentStageData.labelAr : currentStageData.label}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}%</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(elapsedTime)}</span>
              </div>
            </div>
          </div>

          {/* Warning for long requests */}
          {elapsedTime > 30 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              <span>
                {language === 'ar' ? 'يستغرق وقتاً أطول من المعتاد...' : 'Taking longer than usual...'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImprovedChatLoadingIndicator;