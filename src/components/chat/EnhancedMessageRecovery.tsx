import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Wifi, WifiOff, Signal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
}

interface ConnectionHealth {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'degraded';
  quality: number;
  latency: number;
  lastHeartbeat: number;
  consecutiveFailures: number;
}

interface EnhancedMessageRecoveryProps {
  conversationId: string;
  userId: string;
  lastMessageId?: string;
  connectionHealth: ConnectionHealth;
  onMessagesRecovered: (messages: Message[]) => void;
  onForceRefresh?: () => void;
  className?: string;
}

export function EnhancedMessageRecovery({ 
  conversationId, 
  userId, 
  lastMessageId, 
  connectionHealth,
  onMessagesRecovered,
  onForceRefresh,
  className = ""
}: EnhancedMessageRecoveryProps) {
  const [isRecovering, setIsRecovering] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [autoRecoveryAttempts, setAutoRecoveryAttempts] = useState(0);
  const [lastRecoveryTime, setLastRecoveryTime] = useState(0);

  // Auto-show recovery based on connection health
  useEffect(() => {
    const shouldShow = connectionHealth.status === 'error' || 
                      connectionHealth.status === 'degraded' ||
                      (connectionHealth.status === 'disconnected' && connectionHealth.consecutiveFailures > 0) ||
                      connectionHealth.quality < 50;

    if (shouldShow && !showRecovery) {
      const delay = connectionHealth.status === 'error' ? 5000 : 10000;
      const timer = setTimeout(() => {
        setShowRecovery(true);
      }, delay);
      return () => clearTimeout(timer);
    } else if (!shouldShow && showRecovery) {
      setShowRecovery(false);
      setAutoRecoveryAttempts(0);
    }
  }, [connectionHealth, showRecovery]);

  // Auto-recovery for critical connection issues
  useEffect(() => {
    if (connectionHealth.status === 'error' && 
        connectionHealth.consecutiveFailures >= 3 && 
        autoRecoveryAttempts < 2 &&
        Date.now() - lastRecoveryTime > 30000) { // Wait 30s between auto-recoveries
      
      console.log('🚨 Critical connection issues detected, attempting auto-recovery');
      recoverMessages(true);
    }
  }, [connectionHealth, autoRecoveryAttempts, lastRecoveryTime]);

  const recoverMessages = useCallback(async (isAutoRecovery = false) => {
    if (!conversationId || !userId || isRecovering) return;
    
    setIsRecovering(true);
    if (isAutoRecovery) {
      setAutoRecoveryAttempts(prev => prev + 1);
    }
    setLastRecoveryTime(Date.now());

    try {
      let query = supabase
        .from('messages')
        .select('id, role, content, created_at, conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      // Get messages from the last 10 minutes or since last known message
      const lookbackTime = connectionHealth.status === 'error' ? 600000 : 300000; // 10min or 5min
      const since = Math.max(
        Date.now() - lookbackTime,
        lastMessageId ? Date.now() - 180000 : 0 // 3 minutes if we have lastMessageId
      );

      query = query.gt('created_at', new Date(since).toISOString());

      const { data, error } = await query;

      if (error) {
        console.error('Error recovering messages:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log(`📥 ${isAutoRecovery ? 'Auto-' : ''}Recovered ${data.length} messages`);
        onMessagesRecovered(data);
        
        if (!isAutoRecovery) {
          setShowRecovery(false);
        }
      } else if (!isAutoRecovery) {
        console.log('📭 No new messages found during recovery');
      }
    } catch (error) {
      console.error('Message recovery error:', error);
    } finally {
      setIsRecovering(false);
    }
  }, [conversationId, userId, lastMessageId, connectionHealth.status, isRecovering, onMessagesRecovered]);

  const handleForceRefresh = useCallback(async () => {
    if (onForceRefresh) {
      onForceRefresh();
    }
    await recoverMessages();
  }, [onForceRefresh, recoverMessages]);

  const getConnectionIcon = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return connectionHealth.quality > 80 ? 
          <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" /> :
          <Signal className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case 'degraded':
        return <Signal className="h-4 w-4 text-orange-600 dark:text-orange-400" />;
      case 'connecting':
        return <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />;
      default:
        return <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
  };

  const getStatusMessage = () => {
    if (connectionHealth.status === 'connected' && connectionHealth.quality > 80) {
      return null; // Don't show anything for good connections
    }

    if (connectionHealth.status === 'error') {
      return `🚨 Connection lost. ${connectionHealth.consecutiveFailures} failed attempts.`;
    }
    
    if (connectionHealth.status === 'degraded') {
      return `⚠️ Poor connection quality (${connectionHealth.quality}%). Messages may be delayed.`;
    }
    
    if (connectionHealth.status === 'disconnected') {
      return '🔌 Disconnected. Attempting to reconnect...';
    }
    
    if (connectionHealth.status === 'connecting') {
      return '🔄 Connecting...';
    }
    
    return `⚠️ Connection issues detected. Quality: ${connectionHealth.quality}%`;
  };

  const statusMessage = getStatusMessage();
  
  if (!showRecovery && !statusMessage) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Connection Status */}
      {statusMessage && (
        <div className="flex items-center justify-center p-2">
          <div className="flex items-center gap-2 bg-muted/50 border rounded-lg px-3 py-2 text-sm">
            {getConnectionIcon()}
            <span className="text-muted-foreground">
              {statusMessage}
            </span>
          </div>
        </div>
      )}

      {/* Recovery Actions */}
      {showRecovery && (
        <div className="flex items-center justify-center p-3">
          <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              {connectionHealth.status === 'error' ? 
                '🚨 Connection failed. Messages may be missing.' :
                '⚠️ Poor connection detected. Messages might be missing.'
              }
            </span>
            <div className="flex gap-2">
              <Button
                onClick={() => recoverMessages()}
                disabled={isRecovering}
                size="sm"
                variant="outline"
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-600 dark:text-yellow-200 dark:hover:bg-yellow-900/20"
              >
                {isRecovering ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Recover
              </Button>
              <Button
                onClick={handleForceRefresh}
                disabled={isRecovering}
                size="sm"
                variant="default"
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Force Refresh
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-recovery indicator */}
      {autoRecoveryAttempts > 0 && (
        <div className="flex items-center justify-center p-1">
          <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
            Auto-recovery attempts: {autoRecoveryAttempts}/2
          </div>
        </div>
      )}
    </div>
  );
}