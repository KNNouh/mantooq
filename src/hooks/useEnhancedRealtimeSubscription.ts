import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
}

interface UseEnhancedRealtimeSubscriptionProps {
  userId: string | null;
  onMessage: (message: Message) => void;
  enabled?: boolean;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'degraded';

interface ConnectionHealth {
  status: ConnectionStatus;
  quality: number; // 0-100
  latency: number;
  lastHeartbeat: number;
  consecutiveFailures: number;
}

export function useEnhancedRealtimeSubscription({ 
  userId, 
  onMessage, 
  enabled = true 
}: UseEnhancedRealtimeSubscriptionProps) {
  const channelRef = useRef<any>(null);
  const messageHandlerRef = useRef(onMessage);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    status: 'disconnected',
    quality: 0,
    latency: 0,
    lastHeartbeat: 0,
    consecutiveFailures: 0
  });
  
  const [retryCount, setRetryCount] = useState(0);
  const lastMessageId = useRef<string | null>(null);
  const lastPollTime = useRef<number>(0);
  const reconnectAttempts = useRef<number>(0);

  // Update message handler ref when it changes
  messageHandlerRef.current = onMessage;

  // Heartbeat monitoring
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const channel = channelRef.current;
      
      if (!channel) return;

      // Send heartbeat
      const heartbeatStart = now;
      
      // Simulate heartbeat by checking channel state
      const channelState = channel.state;
      const heartbeatEnd = Date.now();
      const latency = heartbeatEnd - heartbeatStart;

      setConnectionHealth(prev => {
        const timeSinceLastMessage = now - prev.lastHeartbeat;
        let quality = 100;
        
        // Reduce quality based on latency and time since last activity
        if (latency > 1000) quality -= 30;
        else if (latency > 500) quality -= 15;
        
        if (timeSinceLastMessage > 30000) quality -= 20; // No activity for 30s
        if (timeSinceLastMessage > 60000) quality -= 40; // No activity for 1min
        
        // Connection state assessment
        let status: ConnectionStatus = prev.status;
        if (channelState === 'joined' && quality > 70) status = 'connected';
        else if (channelState === 'joined' && quality > 40) status = 'degraded';
        else if (channelState === 'joining') status = 'connecting';
        else if (channelState === 'leaving' || channelState === 'closed') status = 'disconnected';
        else status = 'error';

        return {
          ...prev,
          status,
          quality: Math.max(0, quality),
          latency,
          lastHeartbeat: now
        };
      });

      // Trigger reconnection if quality is too low
      if (connectionHealth.quality < 30 && connectionHealth.status === 'connected') {
        console.log('⚠️ Connection quality degraded, triggering reconnection');
        attemptConnection(userId!, reconnectAttempts.current);
      }
    }, 10000); // Every 10 seconds
  }, [userId, connectionHealth.quality, connectionHealth.status]);

  // Backup polling for message recovery
  const startBackupPolling = useCallback(() => {
    if (!userId || pollingIntervalRef.current) return;

    pollingIntervalRef.current = setInterval(async () => {
      // Only poll if real-time connection is poor or disconnected
      if (connectionHealth.status === 'connected' && connectionHealth.quality > 50) {
        return;
      }

      try {
        const now = Date.now();
        const pollSince = Math.max(lastPollTime.current, now - 60000); // Last minute
        
        const { data, error } = await supabase
          .from('messages')
          .select('id, role, content, created_at, conversation_id')
          .eq('user_id', userId)
          .gt('created_at', new Date(pollSince).toISOString())
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Backup polling error:', error);
          return;
        }

        if (data && data.length > 0) {
          console.log(`📥 Backup polling recovered ${data.length} messages`);
          data.forEach(message => {
            if (message.id !== lastMessageId.current) {
              messageHandlerRef.current(message as Message);
              lastMessageId.current = message.id;
            }
          });
        }

        lastPollTime.current = now;
      } catch (error) {
        console.error('Backup polling failed:', error);
      }
    }, 15000); // Every 15 seconds
  }, [userId, connectionHealth.status, connectionHealth.quality]);

  const stopBackupPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = undefined;
    }
  }, []);

  const attemptConnection = useCallback((userId: string, attempt = 0) => {
    reconnectAttempts.current = attempt;
    
    if (channelRef.current) {
      console.log('🧹 Cleaning up existing subscription before retry');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnectionHealth(prev => ({ ...prev, status: 'connecting' }));
    setRetryCount(attempt);
    
    const channelName = `messages-${userId}-${Date.now()}`;
    console.log(`🔄 Attempting enhanced real-time connection (attempt ${attempt + 1}) for user:`, userId);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📨 New message received via realtime:', payload);
          const newMessage = payload.new as Message;
          
          // Enhanced duplicate prevention with timestamp check
          if (newMessage.id === lastMessageId.current) {
            console.log('🚫 Skipping duplicate message:', newMessage.id);
            return;
          }
          
          lastMessageId.current = newMessage.id;
          
          // Update connection health on successful message
          setConnectionHealth(prev => ({
            ...prev,
            lastHeartbeat: Date.now(),
            consecutiveFailures: 0,
            quality: Math.min(100, prev.quality + 10)
          }));
          
          // Immediate callback without delay to prevent message loss
          try {
            messageHandlerRef.current(newMessage);
          } catch (error) {
            console.error('Error handling realtime message:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Enhanced real-time subscription status for ${channelName}:`, status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Enhanced real-time subscription established successfully');
          setConnectionHealth(prev => ({
            ...prev,
            status: 'connected',
            quality: 100,
            consecutiveFailures: 0
          }));
          setRetryCount(0);
          reconnectAttempts.current = 0;
          
          // Start heartbeat monitoring
          startHeartbeat();
          
          // Start backup polling for redundancy
          startBackupPolling();
          
          // Clear any pending retry
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = undefined;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`❌ Enhanced real-time subscription ${status.toLowerCase()}`);
          
          setConnectionHealth(prev => ({
            ...prev,
            status: 'error',
            consecutiveFailures: prev.consecutiveFailures + 1
          }));
          
          // Enhanced retry logic with exponential backoff
          if (attempt < 5) { // Increased max attempts
            const delay = Math.min(1000 * Math.pow(1.5, attempt), 15000); // More aggressive retry
            console.log(`🔄 Retrying enhanced connection in ${delay}ms...`);
            
            retryTimeoutRef.current = setTimeout(() => {
              attemptConnection(userId, attempt + 1);
            }, delay);
          } else {
            console.error('❌ Max retry attempts reached, switching to backup polling mode');
            setConnectionHealth(prev => ({ ...prev, status: 'error' }));
            // Continue with backup polling only
            startBackupPolling();
          }
        } else if (status === 'CLOSED') {
          console.log('🔒 Enhanced real-time subscription closed');
          setConnectionHealth(prev => ({ ...prev, status: 'disconnected' }));
        }
      });

    channelRef.current = channel;
  }, [startHeartbeat, startBackupPolling]);

  useEffect(() => {
    // Clear any existing timeouts
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }

    if (!userId || !enabled) {
      // Clean up existing subscription
      if (channelRef.current) {
        console.log('🧹 Cleaning up enhanced realtime subscription - user/enabled changed');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      // Clear heartbeat and polling
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = undefined;
      }
      
      stopBackupPolling();
      
      setConnectionHealth({
        status: 'disconnected',
        quality: 0,
        latency: 0,
        lastHeartbeat: 0,
        consecutiveFailures: 0
      });
      setRetryCount(0);
      return;
    }

    // Start connection attempt
    attemptConnection(userId, 0);

    return () => {
      console.log('🧹 Cleaning up enhanced real-time subscription on unmount');
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = undefined;
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = undefined;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      stopBackupPolling();
      
      setConnectionHealth({
        status: 'disconnected',
        quality: 0,
        latency: 0,
        lastHeartbeat: 0,
        consecutiveFailures: 0
      });
    };
  }, [userId, enabled, attemptConnection, stopBackupPolling]);

  // Manual cleanup function
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    if (channelRef.current) {
      console.log('🧹 Manual cleanup of enhanced real-time subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    stopBackupPolling();
    
    setConnectionHealth({
      status: 'disconnected',
      quality: 0,
      latency: 0,
      lastHeartbeat: 0,
      consecutiveFailures: 0
    });
    setRetryCount(0);
    lastMessageId.current = null;
  }, [stopBackupPolling]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (userId && enabled) {
      cleanup();
      setTimeout(() => attemptConnection(userId, 0), 500);
    }
  }, [userId, enabled, cleanup, attemptConnection]);

  // Force refresh function for manual recovery
  const forceRefresh = useCallback(async () => {
    if (!userId) return;
    
    try {
      console.log('🔄 Force refreshing messages...');
      const { data, error } = await supabase
        .from('messages')
        .select('id, role, content, created_at, conversation_id')
        .eq('user_id', userId)
        .gt('created_at', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        console.log(`🔄 Force refresh recovered ${data.length} messages`);
        data.forEach(message => {
          messageHandlerRef.current(message as Message);
        });
      }
    } catch (error) {
      console.error('Force refresh failed:', error);
    }
  }, [userId]);

  return { 
    cleanup, 
    reconnect,
    forceRefresh,
    connectionStatus: connectionHealth.status,
    connectionHealth,
    retryCount,
    isConnected: connectionHealth.status === 'connected'
  };
}