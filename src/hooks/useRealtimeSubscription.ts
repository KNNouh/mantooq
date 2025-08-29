import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
}

interface UseRealtimeSubscriptionProps {
  userId: string | null;
  onMessage: (message: Message) => void;
  enabled?: boolean;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useRealtimeSubscription({ 
  userId, 
  onMessage, 
  enabled = true 
}: UseRealtimeSubscriptionProps) {
  const channelRef = useRef<any>(null);
  const messageHandlerRef = useRef(onMessage);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [retryCount, setRetryCount] = useState(0);

  // Update message handler ref when it changes
  messageHandlerRef.current = onMessage;

  // Stable retry function with exponential backoff
  const attemptConnection = useCallback((userId: string, attempt = 0) => {
    if (channelRef.current) {
      console.log('🧹 Cleaning up existing subscription before retry');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnectionStatus('connecting');
    setRetryCount(attempt);
    
    const channelName = `messages-${userId}-${Date.now()}`;
    console.log(`🔄 Attempting real-time connection (attempt ${attempt + 1}) for user:`, userId);
    
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
          // Use ref to avoid dependency issues
          messageHandlerRef.current(newMessage);
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Real-time subscription status for ${channelName}:`, status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription established successfully');
          setConnectionStatus('connected');
          setRetryCount(0);
          
          // Clear any pending retry
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = undefined;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`❌ Real-time subscription ${status.toLowerCase()}`);
          setConnectionStatus('error');
          
          // Retry with exponential backoff (max 5 attempts)
          if (attempt < 4) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.log(`🔄 Retrying connection in ${delay}ms...`);
            
            retryTimeoutRef.current = setTimeout(() => {
              attemptConnection(userId, attempt + 1);
            }, delay);
          } else {
            console.error('❌ Max retry attempts reached');
            setConnectionStatus('error');
          }
        } else if (status === 'CLOSED') {
          console.log('🔒 Real-time subscription closed');
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;
  }, []);

  useEffect(() => {
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }

    if (!userId || !enabled) {
      // Clean up existing subscription
      if (channelRef.current) {
        console.log('🧹 Cleaning up realtime subscription - user/enabled changed');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setConnectionStatus('disconnected');
      setRetryCount(0);
      return;
    }

    // Start connection attempt
    attemptConnection(userId, 0);

    return () => {
      console.log('🧹 Cleaning up real-time subscription on unmount');
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = undefined;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setConnectionStatus('disconnected');
    };
  }, [userId, enabled, attemptConnection]);

  // Manual cleanup function
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
    if (channelRef.current) {
      console.log('🧹 Manual cleanup of real-time subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setConnectionStatus('disconnected');
    setRetryCount(0);
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (userId && enabled) {
      cleanup();
      setTimeout(() => attemptConnection(userId, 0), 500);
    }
  }, [userId, enabled, cleanup, attemptConnection]);

  return { 
    cleanup, 
    reconnect,
    connectionStatus,
    retryCount,
    isConnected: connectionStatus === 'connected'
  };
}