import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
}

interface MessageRecoveryProps {
  conversationId: string;
  userId: string;
  lastMessageId?: string;
  onMessagesRecovered: (messages: Message[]) => void;
  className?: string;
}

/**
 * Component to handle message recovery when real-time fails
 */
export function MessageRecovery({ 
  conversationId, 
  userId, 
  lastMessageId, 
  onMessagesRecovered,
  className = ""
}: MessageRecoveryProps) {
  const [isRecovering, setIsRecovering] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  // Auto-show recovery option after 10 seconds if no new messages
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRecovery(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [conversationId]);

  const recoverMessages = useCallback(async () => {
    if (!conversationId || !userId) return;
    
    setIsRecovering(true);
    try {
      let query = supabase
        .from('messages')
        .select('id, role, content, created_at, conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      // Only get messages after the last known message
      if (lastMessageId) {
        query = query.gt('created_at', 
          new Date(Date.now() - 5 * 60 * 1000).toISOString() // Last 5 minutes
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error recovering messages:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log(`📥 Recovered ${data.length} messages`);
        onMessagesRecovered(data);
        setShowRecovery(false);
      }
    } catch (error) {
      console.error('Message recovery error:', error);
    } finally {
      setIsRecovering(false);
    }
  }, [conversationId, userId, lastMessageId, onMessagesRecovered]);

  if (!showRecovery) return null;

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm text-amber-800 dark:text-amber-200">
          رسالة محتملة مفقودة؟
        </span>
        <Button
          onClick={recoverMessages}
          disabled={isRecovering}
          size="sm"
          variant="outline"
          className="ml-2"
        >
          {isRecovering ? (
            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          استرداد
        </Button>
      </div>
    </div>
  );
}