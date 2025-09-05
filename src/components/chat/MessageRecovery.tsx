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

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRecovery(true);
    }, 15000); // Show after 15 seconds if connection issues persist

    return () => clearTimeout(timer);
  }, [conversationId]); // Reset timer when conversation changes

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
    <div className={`flex items-center justify-center p-3 ${className}`}>
      <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <span className="text-sm text-yellow-800 dark:text-yellow-200">
          ⚠️ Connection issues detected. Messages might be missing.
        </span>
        <Button
          onClick={recoverMessages}
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
          Recover Messages
        </Button>
      </div>
    </div>
  );
}