import { useEffect, useRef } from 'react';
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

export function useRealtimeSubscription({ 
  userId, 
  onMessage, 
  enabled = true 
}: UseRealtimeSubscriptionProps) {
  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!userId || !enabled) {
      // Clean up existing subscription
      if (channelRef.current) {
        console.log('🧹 Cleaning up realtime subscription - user/enabled changed');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
      return;
    }

    // Don't create multiple subscriptions
    if (isSubscribedRef.current) {
      return;
    }

    console.log('🔄 Creating stable real-time subscription for user:', userId);
    
    // Create a stable channel name
    const channelName = `messages-${userId}`;
    
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
          onMessage(newMessage);
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Real-time subscription status for ${channelName}:`, status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription established successfully');
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error');
          isSubscribedRef.current = false;
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ Real-time subscription timed out');
          isSubscribedRef.current = false;
        } else if (status === 'CLOSED') {
          console.log('🔒 Real-time subscription closed');
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('🧹 Cleaning up real-time subscription on unmount');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [userId, enabled]); // Only depend on userId and enabled

  // Cleanup function
  const cleanup = () => {
    if (channelRef.current) {
      console.log('🧹 Manual cleanup of real-time subscription');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      isSubscribedRef.current = false;
    }
  };

  return { cleanup, isSubscribed: isSubscribedRef.current };
}