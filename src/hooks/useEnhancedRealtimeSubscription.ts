import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
  user_id: string;
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

  // Heartbeat monitoring - simplified without aggressive reconnection
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const channel = channelRef.current;
      
      if (!channel) return;

      // Check channel state
      const channelState = channel.state;
      const latency = 50; // Simple fixed latency for now

      setConnectionHealth(prev => {
        const timeSinceLastMessage = now - prev.lastHeartbeat;
        let quality = 100;
        
        // Reduce quality based on time since last activity only
        if (timeSinceLastMessage > 60000) quality = 60; // No activity for 1min
        else if (timeSinceLastMessage > 30000) quality = 80; // No activity for 30s
        
        // Connection state assessment based on actual channel state
        let status: ConnectionStatus = prev.status;
        if (channelState === 'joined') status = 'connected';
        else if (channelState === 'joining') status = 'connecting';
        else if (channelState === 'leaving' || channelState === 'closed') status = 'disconnected';
        else status = 'error';

        // Only update if there's a meaningful change
        if (status === prev.status && Math.abs(quality - prev.quality) < 10) {
          return prev;
        }

        return {
          ...prev,
          status,
          quality: Math.max(0, quality),
          latency,
          lastHeartbeat: now
        };
      });
    }, 30000); // Every 30 seconds - less frequent
  }, []);

  // Enhanced backup polling to detect n8n direct inserts
  const startBackupPolling = useCallback(() => {
    if (!userId || pollingIntervalRef.current) return;

    console.log('🔄 Starting enhanced backup polling for n8n message recovery');
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const now = Date.now();
        const pollSince = Math.max(lastPollTime.current, now - 120000); // Last 2 minutes for better coverage
        
        const { data, error } = await supabase
          .from('messages')
          .select('id, role, content, created_at, conversation_id, user_id')
          .eq('user_id', userId)
          .gt('created_at', new Date(pollSince).toISOString())
          .order('created_at', { ascending: true });

        if (error) {
          console.error('📡 Backup polling error:', error);
          return;
        }

        if (data && data.length > 0) {
          console.log(`🎯 Backup polling found ${data.length} messages (checking for n8n inserts)`);
          let newMessagesFound = 0;
          
          data.forEach(message => {
            if (message.id !== lastMessageId.current) {
              console.log(`📨 Recovered message via polling: ${message.role} - ${message.content?.slice(0, 50)}...`);
              messageHandlerRef.current({
                ...message,
                _source: 'polling' // Add source indicator for debugging
              } as Message & { _source: string });
              lastMessageId.current = message.id;
              newMessagesFound++;
            }
          });
          
          if (newMessagesFound > 0) {
            console.log(`✅ Backup polling recovered ${newMessagesFound} new messages from n8n`);
            
            // Update connection health to indicate polling recovery
            setConnectionHealth(prev => ({
              ...prev,
              status: 'degraded', // Show degraded status when using polling
              quality: 70, // Lower quality for polling mode
              lastHeartbeat: now
            }));
          }
        } else {
          console.log('📡 Backup polling: No new messages found');
        }

        lastPollTime.current = now;
      } catch (error) {
        console.error('📡 Backup polling failed:', error);
      }
    }, 15000); // Every 15 seconds for better n8n message detection
  }, [userId]);

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
          // Remove user_id filter to catch ALL messages, then filter in handler
        },
        (payload) => {
          console.log('📨 Raw message received via realtime:', payload);
          const newMessage = payload.new as Message;
          
          // Filter messages for current user in the handler
          if (newMessage.user_id !== userId) {
            console.log('🔄 Message not for current user, skipping');
            return;
          }
          
          console.log('✅ Processing message for user:', userId, newMessage);
          
          // Simplified duplicate prevention - only check ID
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
            console.log('🚀 Calling message handler for:', newMessage.content?.slice(0, 50));
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
          
          // Keep backup polling running to catch n8n direct inserts
          // Real-time might miss messages inserted directly by n8n without callback
          if (!pollingIntervalRef.current) {
            console.log('🔄 Starting backup polling alongside real-time for n8n message detection');
            startBackupPolling();
          }
          
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
          
          // Simplified retry logic with linear backoff
          if (attempt < 3) { // Reduced max attempts
            const delay = 2000 + (attempt * 1000); // Linear backoff: 2s, 3s, 4s
            console.log(`🔄 Retrying enhanced connection in ${delay}ms...`);
            
            retryTimeoutRef.current = setTimeout(() => {
              attemptConnection(userId, attempt + 1);
            }, delay);
          } else {
            console.error('❌ Max retry attempts reached, switching to backup polling mode');
            setConnectionHealth(prev => ({ ...prev, status: 'error' }));
            // Start backup polling only as fallback
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
  }, [userId, enabled]); // Removed circular dependencies

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
        .select('id, role, content, created_at, conversation_id, user_id')
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