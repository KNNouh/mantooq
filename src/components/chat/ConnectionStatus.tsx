import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConnectionStatusProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  retryCount?: number;
  onReconnect?: () => void;
  className?: string;
}

export function ConnectionStatus({ 
  status, 
  retryCount = 0, 
  onReconnect, 
  className = '' 
}: ConnectionStatusProps) {
  const { language, t } = useLanguage();

  if (status === 'connected') {
    return null; // Don't show anything when connected
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'connecting':
        return {
          icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          text: language === 'ar' ? 'جاري الاتصال...' : 'Connecting...',
          variant: 'secondary' as const,
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          textColor: 'text-blue-700 dark:text-blue-300'
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: language === 'ar' 
            ? `خطأ في الاتصال (المحاولة ${retryCount + 1})` 
            : `Connection error (attempt ${retryCount + 1})`,
          variant: 'destructive' as const,
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          textColor: 'text-red-700 dark:text-red-300'
        };
      default:
        return {
          icon: <WifiOff className="h-4 w-4" />,
          text: language === 'ar' ? 'غير متصل' : 'Disconnected',
          variant: 'outline' as const,
          bgColor: 'bg-gray-50 dark:bg-gray-950/20',
          textColor: 'text-gray-700 dark:text-gray-300'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center gap-2 p-2 rounded-md ${config.bgColor} ${className}`}>
      <div className={`flex items-center gap-2 ${config.textColor}`}>
        {config.icon}
        <span className="text-sm font-medium">{config.text}</span>
      </div>
      
      {(status === 'error' || status === 'disconnected') && onReconnect && (
        <Button
          onClick={onReconnect}
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
        </Button>
      )}
    </div>
  );
}