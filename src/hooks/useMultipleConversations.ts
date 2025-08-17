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
}

const MAX_TABS = 3;

export function useMultipleConversations(userId: string | null): UseMultipleConversationsReturn {
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

  // Real-time subscription for all open conversations - optimized to prevent constant recreations
  useEffect(() => {
    if (!userId) return;

    console.log('Setting up real-time subscription for multiple conversations');
    
    const channel = supabase
      .channel('multi-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('New message received via realtime:', payload);
          const newMessage = payload.new as Message;
          
          // Only add assistant messages to prevent duplicates
          if (newMessage.role === 'assistant') {
            setTabs(prev => prev.map(tab => {
              if (tab.conversation.id === newMessage.conversation_id) {
                // Check if message already exists to prevent duplicates
                if (tab.messages.find(msg => msg.id === newMessage.id)) {
                  return tab;
                }
                
                const updatedMessages = [...tab.messages, newMessage];
                return {
                  ...tab,
                  messages: updatedMessages,
                  // Increase unread count if it's not the active tab
                  unreadCount: tab.id !== activeTabId ? tab.unreadCount + 1 : tab.unreadCount
                };
              }
              return tab;
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('Multi-conversation real-time subscription status:', status);
      });

    return () => {
      console.log('Cleaning up multi-conversation real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [userId]); // Only depend on userId to prevent constant re-subscriptions

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
    openNewConversationTab
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
    openNewConversationTab
  ]);

  return memoizedReturn;
}