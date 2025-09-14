import React from 'react';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Signal, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
interface ConnectionHealth {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'degraded';
  quality: number;
  latency: number;
  lastHeartbeat: number;
  consecutiveFailures: number;
}
interface EnhancedConnectionStatusProps {
  connectionHealth: ConnectionHealth;
  retryCount: number;
  onReconnect: () => void;
  onForceRefresh?: () => void;
  className?: string;
}
export function EnhancedConnectionStatus({
  connectionHealth,
  retryCount,
  onReconnect,
  onForceRefresh,
  className
}: EnhancedConnectionStatusProps) {
  const getStatusIcon = () => {
    switch (connectionHealth.status) {
      case 'connected':
        if (connectionHealth.quality > 80) {
          return <CheckCircle className="h-4 w-4 text-green-500" />;
        } else if (connectionHealth.quality > 50) {
          return <Signal className="h-4 w-4 text-yellow-500" />;
        } else {
          return <Signal className="h-4 w-4 text-orange-500" />;
        }
      case 'degraded':
        return <Signal className="h-4 w-4 text-orange-500" />;
      case 'connecting':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'disconnected':
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };
  const getStatusText = () => {
    switch (connectionHealth.status) {
      case 'connected':
        if (connectionHealth.quality > 80) {
          return 'Connected';
        } else if (connectionHealth.quality > 50) {
          return `Connected (${connectionHealth.quality}%)`;
        } else {
          return `Poor (${connectionHealth.quality}%)`;
        }
      case 'degraded':
        return `Degraded (${connectionHealth.quality}%)`;
      case 'connecting':
        return retryCount > 0 ? `Reconnecting (${retryCount})` : 'Connecting';
      case 'error':
        return `Error (${connectionHealth.consecutiveFailures} failures)`;
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };
  const getStatusColor = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return connectionHealth.quality > 80 ? 'text-green-600 dark:text-green-400' : connectionHealth.quality > 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-600 dark:text-orange-400';
      case 'degraded':
        return 'text-orange-600 dark:text-orange-400';
      case 'connecting':
        return 'text-blue-600 dark:text-blue-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'disconnected':
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };
  const shouldShowActions = connectionHealth.status === 'error' || connectionHealth.status === 'disconnected';
  const timeSinceLastHeartbeat = connectionHealth.lastHeartbeat > 0 ? Math.floor((Date.now() - connectionHealth.lastHeartbeat) / 1000) : 0;
  return <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        
      </div>

      {/* Detailed info for degraded connections only */}
      {connectionHealth.status === 'degraded' && <div className="text-xs text-muted-foreground">
          {connectionHealth.latency > 0 && `${connectionHealth.latency}ms`}
          {timeSinceLastHeartbeat > 60 && ` • ${timeSinceLastHeartbeat}s ago`}
        </div>}

      {/* Action buttons for poor connections */}
      {shouldShowActions && <div className="flex gap-1">
          <Button onClick={onReconnect} size="sm" variant="outline" className="h-6 px-2 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            Reconnect
          </Button>
          
          {onForceRefresh && (connectionHealth.status === 'error' || connectionHealth.status === 'disconnected') && <Button onClick={onForceRefresh} size="sm" variant="default" className="h-6 px-2 text-xs bg-primary hover:bg-primary/90">
              Refresh
            </Button>}
        </div>}
    </div>;
}