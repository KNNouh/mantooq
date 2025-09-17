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

interface UseOptimizedRealtimeSubscriptionProps {
  userId: string | null;
  onMessage: (message: Message) => void;
  enabled?: boolean;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useOptimizedRealtimeSubscription({ 
  userId, 
  onMessage, 
  enabled = true 
}: UseOptimizedRealtimeSubscriptionProps) {
  const channelRef = useRef<any>(null);
  const messageHandlerRef = useRef(onMessage);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  const lastMessageId = useRef<string | null>(null);

  // Update message handler ref when it changes
  messageHandlerRef.current = onMessage;

  const attemptConnection = useCallback((userId: string, attempt = 0) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnectionStatus('connecting');
    setRetryCount(attempt);
    
    const channelName = `messages-${userId}`;
    console.log('🔌 Setting up realtime subscription for user:', userId, 'channel:', channelName);
    
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
          console.log('📨 Realtime message received:', payload);
          const newMessage = payload.new as Message;
          
          // Simple duplicate prevention
          if (newMessage.id === lastMessageId.current) {
            console.log('🚫 Duplicate message detected, skipping:', newMessage.id);
            return;
          }
          
          lastMessageId.current = newMessage.id;
          console.log('✅ Processing new message:', newMessage.role, newMessage.content?.slice(0, 50) + '...');
          
          try {
            messageHandlerRef.current(newMessage);
          } catch (error) {
            console.error('Error handling realtime message:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setRetryCount(0);
          
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = undefined;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error');
          
          // Exponential backoff with max 3 attempts
          if (attempt < 2) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
            
            retryTimeoutRef.current = setTimeout(() => {
              attemptConnection(userId, attempt + 1);
            }, delay);
          }
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;
  }, []);

  useEffect(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }

    if (!userId || !enabled) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setConnectionStatus('disconnected');
      setRetryCount(0);
      return;
    }

    attemptConnection(userId, 0);

    return () => {
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

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setConnectionStatus('disconnected');
    setRetryCount(0);
    lastMessageId.current = null;
  }, []);

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