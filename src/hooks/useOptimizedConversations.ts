import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id?: string;
  user_id: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface UseOptimizedConversationsReturn {
  conversations: Conversation[];
  messages: Message[];
  currentConversationId: string | null;
  loading: boolean;
  loadingMessages: boolean;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  selectConversation: (conversation: Conversation) => void;
  addMessage: (conversationId: string, role: 'user' | 'assistant', content: string) => Promise<void>;
  createNewConversation: (firstMessage: string) => Promise<string>;
  clearCurrentConversation: () => void;
}

// Cache for conversations and messages
const conversationsCache = new Map<string, { data: Conversation[]; timestamp: number }>();
const messagesCache = new Map<string, { data: Message[]; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export function useOptimizedConversations(userId: string | null): UseOptimizedConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!userId) return;

    // Check cache first
    const cacheKey = `conversations_${userId}`;
    const cached = conversationsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setConversations(cached.data);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const conversationsData = data || [];
      
      // Cache the result
      conversationsCache.set(cacheKey, {
        data: conversationsData,
        timestamp: Date.now()
      });
      
      setConversations(conversationsData);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    // Always fetch fresh messages for real-time conversations
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, role, content, created_at, conversation_id, user_id')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesData = data || [];
      
      // Update cache with fresh data
      messagesCache.set(conversationId, {
        data: messagesData,
        timestamp: Date.now()
      });
      
      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const selectConversation = useCallback((conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    loadMessages(conversation.id);
  }, [loadMessages]);

  const addMessage = useCallback(async (conversationId: string, role: 'user' | 'assistant', content: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role,
          content
        })
        .select()
        .single();

      if (error) throw error;

      // Update messages state immediately and invalidate cache
      const newMessage = data as Message;
      setMessages(prev => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some(msg => msg.id === newMessage.id);
        if (!exists) {
          const updated = [...prev, newMessage];
          // Update cache with new message list
          messagesCache.set(conversationId, {
            data: updated,
            timestamp: Date.now()
          });
          return updated;
        }
        return prev;
      });
      
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }, [userId]);

  const createNewConversation = useCallback(async (firstMessage: string): Promise<string> => {
    if (!userId) throw new Error('User not authenticated');

    try {
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
        })
        .select()
        .single();

      if (convError) throw convError;

      // Invalidate conversations cache
      const cacheKey = `conversations_${userId}`;
      conversationsCache.delete(cacheKey);
      
      // Refresh conversations list
      await loadConversations();
      
      return convData.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }, [userId, loadConversations]);

  const clearCurrentConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
  }, []);

  // Load conversations when userId changes with recovery support
  useEffect(() => {
    if (userId) {
      loadConversations();
    } else {
      setConversations([]);
      setMessages([]);
      setCurrentConversationId(null);
    }
  }, [userId, loadConversations]);

  // Add periodic state refresh to prevent expiration
  useEffect(() => {
    if (!userId) return;

    const refreshInterval = setInterval(() => {
      console.log('🔄 Periodic state refresh to prevent expiration');
      // This helps prevent localStorage expiration by updating timestamp
      if (conversations.length > 0 || messages.length > 0) {
        // Trigger a cache update to refresh timestamp
        const cacheKey = `conversations_${userId}`;
        const cached = conversationsCache.get(cacheKey);
        if (cached) {
          conversationsCache.set(cacheKey, {
            data: cached.data,
            timestamp: Date.now()
          });
        }
      }
    }, 20 * 60 * 1000); // Refresh every 20 minutes

    return () => clearInterval(refreshInterval);
  }, [userId, conversations.length, messages.length]);

  // Real-time subscription for messages - improved reliability
  useEffect(() => {
    if (!userId) return;

    console.log('🔌 Setting up optimized real-time subscription for user:', userId);
    
    const channel = supabase
      .channel(`messages-optimized-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // Remove filter to catch all messages, then filter in handler
        },
        (payload) => {
          console.log('📨 Raw message received in optimized subscription:', payload);
          const newMessage = payload.new as Message;
          
          // Filter for current user
          if (newMessage.user_id !== userId) {
            console.log('🔄 Message not for current user, skipping');
            return;
          }
          
          console.log('✅ Processing message in optimized subscription:', newMessage);
          
          // Add all messages (both user and assistant) to current conversation if it matches
          if (currentConversationId && newMessage.conversation_id === currentConversationId) {
            console.log('📝 Adding message to current conversation:', newMessage.content?.slice(0, 50));
            
            setMessages(prevMessages => {
              // Check if message already exists to prevent duplicates
              if (prevMessages.find(msg => msg.id === newMessage.id)) {
                console.log('🚫 Duplicate message detected in optimized subscription');
                return prevMessages;
              }
              return [...prevMessages, newMessage].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });

            // Update cache immediately
            if (messagesCache.has(currentConversationId)) {
              const cached = messagesCache.get(currentConversationId);
              if (cached && !cached.data.find(msg => msg.id === newMessage.id)) {
                messagesCache.set(currentConversationId, {
                  data: [...cached.data, newMessage].sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  ),
                  timestamp: Date.now()
                });
              }
            }
          } else {
            console.log('⚠️ Message not for current conversation:', {
              messageConversationId: newMessage.conversation_id,
              currentConversationId
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('🔌 Optimized real-time subscription status:', status);
      });

    return () => {
      console.log('🧹 Cleaning up optimized real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [userId, currentConversationId]);

  const memoizedReturn = useMemo(() => ({
    conversations,
    messages,
    currentConversationId,
    loading,
    loadingMessages,
    loadConversations,
    loadMessages,
    selectConversation,
    addMessage,
    createNewConversation,
    clearCurrentConversation
  }), [
    conversations,
    messages,
    currentConversationId,
    loading,
    loadingMessages,
    loadConversations,
    loadMessages,
    selectConversation,
    addMessage,
    createNewConversation,
    clearCurrentConversation
  ]);

  return memoizedReturn;
}