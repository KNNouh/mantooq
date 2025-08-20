import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface ConversationTab {
  id: string;
  conversation: Conversation;
  messages: Message[];
  loadingMessages: boolean;
  unreadCount: number;
}

interface UseMultipleConversationsReturn {
  tabs: ConversationTab[];
  activeTabId: string | null;
  conversations: Conversation[];
  loading: boolean;
  maxTabs: number;
  loadConversations: () => Promise<void>;
  openConversationInTab: (conversation: Conversation) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  addMessage: (conversationId: string, role: 'user' | 'assistant', content: string) => Promise<void>;
  createNewConversation: (firstMessage: string) => Promise<string>;
  openNewConversationTab: () => void;
  deleteConversation: (conversationId: string) => Promise<void>;
}

const MAX_TABS = 3;

export function useMultipleConversations(
  userId: string | null, 
  onAssistantMessage?: (conversationId: string) => void
): UseMultipleConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tabs, setTabs] = useState<ConversationTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadMessages = useCallback(async (conversationId: string): Promise<Message[]> => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading messages:', error);
      return [];
    }
  }, []);

  const openConversationInTab = useCallback(async (conversation: Conversation) => {
    // Check if conversation is already open in a tab
    const existingTab = tabs.find(tab => tab.conversation.id === conversation.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // Check if we've reached max tabs
    if (tabs.length >= MAX_TABS) {
      // Close the oldest tab that's not active
      const oldestTab = tabs.find(tab => tab.id !== activeTabId);
      if (oldestTab) {
        setTabs(prev => prev.filter(tab => tab.id !== oldestTab.id));
      } else {
        // All tabs are active, can't open new one
        return;
      }
    }

    const newTabId = `tab-${conversation.id}-${Date.now()}`;
    const newTab: ConversationTab = {
      id: newTabId,
      conversation,
      messages: [],
      loadingMessages: true,
      unreadCount: 0
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);

    // Load messages for the tab
    const messages = await loadMessages(conversation.id);
    setTabs(prev => prev.map(tab => 
      tab.id === newTabId 
        ? { ...tab, messages, loadingMessages: false }
        : tab
    ));
  }, [tabs, activeTabId, loadMessages]);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const updatedTabs = prev.filter(tab => tab.id !== tabId);
      
      // If we're closing the active tab, switch to another tab
      if (activeTabId === tabId) {
        const newActiveTab = updatedTabs.length > 0 ? updatedTabs[0].id : null;
        setActiveTabId(newActiveTab);
      }
      
      return updatedTabs;
    });
  }, [activeTabId]);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    // Reset unread count for the active tab
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, unreadCount: 0 }
        : tab
    ));
  }, []);

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

      const newMessage = data as Message;
      
      // Update the tab that contains this conversation
      setTabs(prev => prev.map(tab => {
        if (tab.conversation.id === conversationId) {
          // Check if message already exists to avoid duplicates
          const exists = tab.messages.some(msg => msg.id === newMessage.id);
          if (!exists) {
            const updatedMessages = [...tab.messages, newMessage];
            return {
              ...tab,
              messages: updatedMessages,
              // Only increase unread count if it's not the active tab and it's an assistant message
              unreadCount: tab.id !== activeTabId && role === 'assistant' 
                ? tab.unreadCount + 1 
                : tab.unreadCount
            };
          }
        }
        return tab;
      }));

    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }, [userId, activeTabId]);

  const createNewConversation = useCallback(async (firstMessage: string): Promise<string> => {
    if (!userId) throw new Error('User not authenticated');

    try {
      // Check current conversation count
      const { count, error: countError } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        throw countError;
      }

      if (count && count >= 3) {
        throw new Error('يمكنك إنشاء 3 محادثات كحد أقصى. يرجى حذف محادثة موجودة لإنشاء محادثة جديدة.');
      }

      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
        })
        .select()
        .single();

      if (convError) throw convError;
      
      // Refresh conversations list
      await loadConversations();
      
      return convData.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }, [userId, loadConversations]);

  const openNewConversationTab = useCallback(() => {
    if (tabs.length >= MAX_TABS) return;

    const newTabId = `new-tab-${Date.now()}`;
    const newTab: ConversationTab = {
      id: newTabId,
      conversation: {
        id: '',
        title: 'New Chat',
        created_at: new Date().toISOString()
      },
      messages: [],
      loadingMessages: false,
      unreadCount: 0
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  }, [tabs.length]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!userId) throw new Error('User not authenticated');

    try {
      // Delete the conversation (messages will cascade delete)
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;

      // Remove conversation from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));

      // Close any tabs that were using this conversation
      setTabs(prev => {
        const filteredTabs = prev.filter(tab => tab.conversation.id !== conversationId);
        
        // If we removed the active tab, switch to another tab or clear active
        if (activeTabId && prev.find(tab => tab.id === activeTabId)?.conversation.id === conversationId) {
          const newActiveTab = filteredTabs.length > 0 ? filteredTabs[0].id : null;
          setActiveTabId(newActiveTab);
        }
        
        return filteredTabs;
      });

    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }, [userId, activeTabId]);

  // Load conversations when userId changes
  useEffect(() => {
    if (userId) {
      loadConversations();
    } else {
      setConversations([]);
      setTabs([]);
      setActiveTabId(null);
    }
  }, [userId, loadConversations]);

  // Real-time subscription for all open conversations with improved handling
  useEffect(() => {
    if (!userId) return;

    console.log('🔄 Setting up real-time subscription for multiple conversations');
    
    // Create a unique channel name to avoid conflicts
    const channelName = `multi-messages-${userId}-${Date.now()}`;
    
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
          
          // Handle all message types - user and assistant
          setTabs(prev => prev.map(tab => {
            if (tab.conversation.id === newMessage.conversation_id) {
              // Enhanced duplicate check with timestamp and ID
              const messageExists = tab.messages.some(msg => 
                msg.id === newMessage.id || 
                (msg.content === newMessage.content && 
                 Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 1000)
              );
              
              if (messageExists) {
                console.log('🔄 Duplicate message detected, skipping:', newMessage.id);
                return tab;
              }
              
              const updatedMessages = [...tab.messages, newMessage].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              
              console.log(`✅ Added message to tab ${tab.id}:`, newMessage.content.slice(0, 50));
              
              // If this is an assistant message, notify parent to clear loading state
              if (newMessage.role === 'assistant' && onAssistantMessage) {
                console.log('🛑 Assistant message received, clearing loading state for conversation:', newMessage.conversation_id);
                onAssistantMessage(newMessage.conversation_id);
              }
              
              return {
                ...tab,
                messages: updatedMessages,
                // Only increase unread count for assistant messages and if it's not the active tab
                unreadCount: tab.id !== activeTabId && newMessage.role === 'assistant' 
                  ? tab.unreadCount + 1 
                  : tab.unreadCount
              };
            }
            return tab;
          }));
        }
      )
      .subscribe((status) => {
        console.log(`🔌 Real-time subscription status for ${channelName}:`, status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription established successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ Real-time subscription timed out');
        }
      });

    return () => {
      console.log(`🧹 Cleaning up real-time subscription: ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [userId, onAssistantMessage, activeTabId]); // Include onAssistantMessage for proper deps

  const memoizedReturn = useMemo(() => ({
    tabs,
    activeTabId,
    conversations,
    loading,
    maxTabs: MAX_TABS,
    loadConversations,
    openConversationInTab,
    closeTab,
    setActiveTab,
    addMessage,
    createNewConversation,
    openNewConversationTab,
    deleteConversation
  }), [
    tabs,
    activeTabId,
    conversations,
    loading,
    loadConversations,
    openConversationInTab,
    closeTab,
    setActiveTab,
    addMessage,
    createNewConversation,
    openNewConversationTab,
    deleteConversation
  ]);

  return memoizedReturn;
}