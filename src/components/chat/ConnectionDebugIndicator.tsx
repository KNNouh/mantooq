import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Activity
} from 'lucide-react';

interface ConnectionHealth {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'degraded';
  quality: number;
  latency: number;
  lastHeartbeat: number;
  consecutiveFailures: number;
}

interface ConnectionDebugIndicatorProps {
  connectionHealth: ConnectionHealth;
  retryCount: number;
  onForceRefresh: () => void;
  onReconnect: () => void;
  className?: string;
}

export const ConnectionDebugIndicator: React.FC<ConnectionDebugIndicatorProps> = ({
  connectionHealth,
  retryCount,
  onForceRefresh,
  onReconnect,
  className = ''
}) => {
  const getStatusIcon = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return <Wifi className="w-3 h-3" />;
      case 'connecting':
        return <Activity className="w-3 h-3 animate-pulse" />;
      case 'degraded':
        return <AlertTriangle className="w-3 h-3" />;
      case 'error':
      case 'disconnected':
        return <WifiOff className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusVariant = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return 'default';
      case 'connecting':
        return 'secondary';
      case 'degraded':
        return 'outline';
      case 'error':
      case 'disconnected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusText = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return 'Real-time';
      case 'connecting':
        return 'Connecting';
      case 'degraded':
        return 'Polling mode';
      case 'error':
        return 'Error';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const getTooltipContent = () => {
    const timeSinceHeartbeat = connectionHealth.lastHeartbeat > 0 
      ? Math.round((Date.now() - connectionHealth.lastHeartbeat) / 1000)
      : 0;

    return (
      <div className="space-y-1 text-xs">
        <div className="font-medium">Connection Status</div>
        <div>Status: {getStatusText()}</div>
        <div>Quality: {connectionHealth.quality}%</div>
        {connectionHealth.lastHeartbeat > 0 && (
          <div>Last activity: {timeSinceHeartbeat}s ago</div>
        )}
        {retryCount > 0 && (
          <div>Retries: {retryCount}</div>
        )}
        {connectionHealth.consecutiveFailures > 0 && (
          <div>Failures: {connectionHealth.consecutiveFailures}</div>
        )}
        {connectionHealth.status === 'degraded' && (
          <div className="text-amber-300 mt-1">
            Using polling - messages may have slight delay
          </div>
        )}
        {connectionHealth.status === 'error' && (
          <div className="text-red-300 mt-1">
            Connection failed - using backup polling
          </div>
        )}
      </div>
    );
  };

  // Only show in development or when there are connection issues
  const shouldShow = process.env.NODE_ENV === 'development' || 
                     connectionHealth.status === 'error' ||
                     connectionHealth.status === 'degraded' ||
                     retryCount > 0;

  if (!shouldShow) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={getStatusVariant()}
              className="gap-1 cursor-help"
            >
              {getStatusIcon()}
              {getStatusText()}
              {retryCount > 0 && ` (${retryCount})`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {(connectionHealth.status === 'error' || connectionHealth.status === 'degraded') && (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onForceRefresh}
            className="h-6 px-2 text-xs"
            title="Force refresh messages"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onReconnect}
            className="h-6 px-2 text-xs"
            title="Reconnect real-time"
          >
            <Wifi className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};