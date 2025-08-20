import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { MessageCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatLoadingIndicatorProps {
  conversationId: string;
  logId?: string;
  onRetry?: () => void;
  onTimeout?: () => void;
}

type LoadingStage = 'sending' | 'processing' | 'generating' | 'finalizing';

interface ProgressStage {
  key: LoadingStage;
  label: string;
  labelAr: string;
  progress: number;
}

const ChatLoadingIndicator: React.FC<ChatLoadingIndicatorProps> = ({
  conversationId,
  logId,
  onRetry,
  onTimeout
}) => {
  const { language, t } = useLanguage();
  const [currentStage, setCurrentStage] = useState<LoadingStage>('sending');
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Progress stages configuration
  const stages: ProgressStage[] = [
    { key: 'sending', label: 'Sending message...', labelAr: 'إرسال الرسالة...', progress: 10 },
    { key: 'processing', label: 'Processing request...', labelAr: 'معالجة الطلب...', progress: 40 },
    { key: 'generating', label: 'Generating response...', labelAr: 'إنشاء الرد...', progress: 80 },
    { key: 'finalizing', label: 'Finalizing...', labelAr: 'اللمسات الأخيرة...', progress: 95 }
  ];

  const getCurrentStageData = () => stages.find(s => s.key === currentStage) || stages[0];
  const currentStageData = getCurrentStageData();

  // Timer management
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        
        // Progressive warnings and timeout
        if (newTime === 60 && !showWarning) {
          setShowWarning(true);
          setCurrentStage('generating');
          setProgress(65);
        } else if (newTime === 90) {
          setCurrentStage('finalizing');
          setProgress(90);
        } else if (newTime >= 120) {
          setIsTimedOut(true);
          setErrorMessage('Request timed out. Please try again.');
          onTimeout?.();
          clearInterval(timer);
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeout, showWarning]);

  // Real-time webhook log tracking
  useEffect(() => {
    if (!logId) return;

    const channel = supabase
      .channel('webhook-progress')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_webhook_log',
          filter: `id=eq.${logId}`
        },
        (payload) => {
          const newData = payload.new as any;
          
          // Update stage based on webhook response
          if (newData.webhook_response && !newData.error_message) {
            setCurrentStage('processing');
            setProgress(40);
          }
          
          // Handle errors
          if (newData.error_message) {
            setErrorMessage(newData.error_message);
            setIsTimedOut(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [logId]);

  // Smooth progress animation
  useEffect(() => {
    const targetProgress = currentStageData.progress;
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev < targetProgress) {
          return Math.min(prev + 1, targetProgress);
        }
        return prev;
      });
    }, 50);

    return () => clearInterval(progressTimer);
  }, [currentStageData.progress]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getWarningMessage = () => {
    if (elapsedTime >= 90) {
      return language === 'ar' ? 'جاري الانتهاء...' : 'Almost ready...';
    }
    if (elapsedTime >= 60) {
      return language === 'ar' ? 'يستغرق وقتاً أطول من المعتاد...' : 'Taking longer than usual...';
    }
    return null;
  };

  if (isTimedOut) {
    return (
      <div className={`flex ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl max-w-sm">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {language === 'ar' ? 'انتهت مهلة الطلب' : 'Request Timed Out'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {errorMessage || (language === 'ar' 
              ? 'الطلب استغرق وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.'
              : 'The request took longer than expected. Please try again.'
            )}
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
      <div className="bg-muted/80 backdrop-blur-sm p-4 rounded-2xl border border-border/50 shadow-sm max-w-sm w-full">
        <div className="space-y-3">
          {/* Stage indicator with icon */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="animate-spin h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full"></div>
              <div className="absolute inset-0 animate-pulse">
                <div className="h-5 w-5 border-2 border-transparent border-t-primary/50 rounded-full"></div>
              </div>
            </div>
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground/90">
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

          {/* Warning message */}
          {showWarning && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              <span>{getWarningMessage()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatLoadingIndicator;