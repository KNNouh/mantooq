import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
}

interface UseMessageSyncProps {
  userId: string | null;
  onMessage: (message: Message) => void;
  enabled?: boolean;
}

/**
 * Hook to handle message synchronization and ensure messages don't disappear
 * Provides backup polling mechanism if real-time fails
 */
export function useMessageSync({ userId, onMessage, enabled = true }: UseMessageSyncProps) {
  const lastMessageId = useRef<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout>();

  // Backup polling mechanism to ensure messages aren't lost
  const pollForNewMessages = useCallback(async () => {
    if (!userId || !enabled) return;

    try {
      let query = supabase
        .from('messages')
        .select('id, role, content, created_at, conversation_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (lastMessageId.current) {
        query = query.gt('id', lastMessageId.current);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error polling for messages:', error);
        return;
      }

      if (data && data.length > 0) {
        // Process messages in chronological order
        const newMessages = data.reverse();
        
        for (const message of newMessages) {
          if (message.id !== lastMessageId.current) {
            console.log('📥 Backup polling found message:', message.id);
            onMessage(message);
            lastMessageId.current = message.id;
          }
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, [userId, enabled, onMessage]);

  // Start polling when enabled
  useEffect(() => {
    if (!enabled || !userId) {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = undefined;
      }
      return;
    }

    // Poll every 3 seconds as backup
    pollInterval.current = setInterval(pollForNewMessages, 3000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = undefined;
      }
    };
  }, [enabled, userId, pollForNewMessages]);

  return {
    pollForNewMessages
  };
}