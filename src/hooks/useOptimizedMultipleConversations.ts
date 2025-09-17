import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedRealtimeSubscription } from './useOptimizedRealtimeSubscription';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
  user_id: string;
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

interface LoadingState {
  isLoading: boolean;
  conversationId?: string;
}

interface UseOptimizedMultipleConversationsReturn {
  tabs: ConversationTab[];
  activeTabId: string | null;
  conversations: Conversation[];
  loading: boolean;
  loadingState: LoadingState;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  retryCount: number;
  isConnected: boolean;
  reconnect: () => void;
  loadConversations: () => Promise<void>;
  openConversationInTab: (conversation: Conversation) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  addMessage: (conversationId: string, role: 'user' | 'assistant', content: string) => Promise<void>;
  createNewConversation: (firstMessage: string) => Promise<string>;
  openNewConversationTab: () => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  setLoadingState: (state: LoadingState) => void;
  clearLoadingState: () => void;
}

const MAX_TABS = 3;
const STORAGE_KEY_PREFIX = 'chat_state';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useOptimizedMultipleConversations(
  userId: string | null
): UseOptimizedMultipleConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tabs, setTabs] = useState<ConversationTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false });

  const clearLoadingState = useCallback(() => {
    setLoadingState({ isLoading: false });
  }, []);

  // Handle incoming realtime messages
  const handleRealtimeMessage = useCallback((newMessage: Message) => {
    setTabs(prev => {
      let wasUpdated = false;
      const updatedTabs = prev.map(tab => {
        if (tab.conversation.id === newMessage.conversation_id) {
          // Simple duplicate check
          const messageExists = tab.messages.some(msg => msg.id === newMessage.id);
          
          if (messageExists) {
            return tab;
          }
          
          const updatedMessages = [...tab.messages, newMessage].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          
          wasUpdated = true;
          
          return {
            ...tab,
            messages: updatedMessages,
            unreadCount: tab.id !== activeTabId && newMessage.role === 'assistant' 
              ? tab.unreadCount + 1 
              : tab.unreadCount
          };
        }
        return tab;
      });

      return updatedTabs;
    });

    // Clear loading state for assistant messages
    if (newMessage.role === 'assistant') {
      setLoadingState({ isLoading: false });
    }
  }, [activeTabId]);

  // Optimized realtime subscription - no backup polling or heartbeat
  const { connectionStatus, retryCount, reconnect, isConnected } = useOptimizedRealtimeSubscription({
    userId,
    onMessage: handleRealtimeMessage,
    enabled: !!userId
  });

  const loadConversations = useCallback(async () => {
    if (!userId) return;

    // Check cache first
    const cacheKey = `${STORAGE_KEY_PREFIX}_conversations_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setConversations(data);
          return;
        }
      } catch (error) {
        // Invalid cache, continue with fresh fetch
      }
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
      setConversations(conversationsData);
      
      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify({
        data: conversationsData,
        timestamp: Date.now()
      }));
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
        .select('id, role, content, created_at, conversation_id, user_id')
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
    // Check if conversation is already open
    const existingTab = tabs.find(tab => tab.conversation.id === conversation.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // Close oldest tab if at max capacity
    if (tabs.length >= MAX_TABS) {
      const oldestInactiveTab = tabs.find(tab => tab.id !== activeTabId);
      if (oldestInactiveTab) {
        setTabs(prev => prev.filter(tab => tab.id !== oldestInactiveTab.id));
      } else {
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
      
      if (activeTabId === tabId) {
        const newActiveTab = updatedTabs.length > 0 ? updatedTabs[0].id : null;
        setActiveTabId(newActiveTab);
      }
      
      return updatedTabs;
    });
  }, [activeTabId]);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    // Reset unread count
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, unreadCount: 0 }
        : tab
    ));
  }, []);

  const addMessage = useCallback(async (conversationId: string, role: 'user' | 'assistant', content: string) => {
    if (!userId) return;

    try {
      // Optimistic UI update for user messages
      if (role === 'user') {
        const tempMessage = {
          id: `temp-${Date.now()}`,
          conversation_id: conversationId,
          content,
          role,
          created_at: new Date().toISOString(),
          user_id: userId
        };
        
        setTabs(prevTabs => 
          prevTabs.map(tab => {
            if (tab.conversation.id === conversationId) {
              return {
                ...tab,
                messages: [...tab.messages, tempMessage]
              };
            }
            return tab;
          })
        );
      }
      
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

      // Replace temp message with real one
      if (role === 'user' && data) {
        setTabs(prevTabs => 
          prevTabs.map(tab => {
            if (tab.conversation.id === conversationId) {
              return {
                ...tab,
                messages: tab.messages.map(msg => 
                  msg.id.startsWith('temp-') ? data : msg
                )
              };
            }
            return tab;
          })
        );
      }
    } catch (error) {
      console.error('Failed to add message:', error);
      
      // Remove temp message on error
      if (role === 'user') {
        setTabs(prevTabs => 
          prevTabs.map(tab => {
            if (tab.conversation.id === conversationId) {
              return {
                ...tab,
                messages: tab.messages.filter(msg => !msg.id.startsWith('temp-'))
              };
            }
            return tab;
          })
        );
      }
      
      throw error;
    }
  }, [userId]);

  const createNewConversation = useCallback(async (firstMessage: string): Promise<string> => {
    if (!userId) throw new Error('User not authenticated');

    try {
      // Check conversation limit
      const { count, error: countError } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) throw countError;

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
      
      // Refresh conversations and clear cache
      const cacheKey = `${STORAGE_KEY_PREFIX}_conversations_${userId}`;
      localStorage.removeItem(cacheKey);
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
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;

      // Clear cache and update state
      const cacheKey = `${STORAGE_KEY_PREFIX}_conversations_${userId}`;
      localStorage.removeItem(cacheKey);
      
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));

      // Close related tabs
      setTabs(prev => {
        const filteredTabs = prev.filter(tab => tab.conversation.id !== conversationId);
        
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

  // Debounced state persistence - only save every 5 minutes or on major changes
  useEffect(() => {
    if (!userId || tabs.length === 0) return;

    const saveState = () => {
      const state = { tabs, activeTabId, timestamp: Date.now() };
      const stateKey = `${STORAGE_KEY_PREFIX}_state_${userId}`;
      try {
        localStorage.setItem(stateKey, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save state:', error);
      }
    };

    const timeoutId = setTimeout(saveState, 5 * 60 * 1000); // Save every 5 minutes
    return () => clearTimeout(timeoutId);
  }, [userId, tabs, activeTabId]);

  // Load conversations and restore state on userId change
  useEffect(() => {
    if (userId) {
      loadConversations();
      
      // Try to restore state
      const stateKey = `${STORAGE_KEY_PREFIX}_state_${userId}`;
      try {
        const saved = localStorage.getItem(stateKey);
        if (saved) {
          const { tabs: savedTabs, activeTabId: savedActiveTabId, timestamp } = JSON.parse(saved);
          
          // Only restore if less than 24 hours old
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            setTabs(savedTabs || []);
            setActiveTabId(savedActiveTabId);
          }
        }
      } catch (error) {
        console.error('Failed to restore state:', error);
      }
    } else {
      setConversations([]);
      setTabs([]);
      setActiveTabId(null);
      clearLoadingState();
    }
  }, [userId, loadConversations, clearLoadingState]);

  const memoizedReturn = useMemo(() => ({
    tabs,
    activeTabId,
    conversations,
    loading,
    loadingState,
    connectionStatus,
    retryCount,
    isConnected,
    reconnect,
    loadConversations,
    openConversationInTab,
    closeTab,
    setActiveTab,
    addMessage,
    createNewConversation,
    openNewConversationTab,
    deleteConversation,
    setLoadingState,
    clearLoadingState
  }), [
    tabs,
    activeTabId,
    conversations,
    loading,
    loadingState,
    connectionStatus,
    retryCount,
    isConnected,
    reconnect,
    loadConversations,
    openConversationInTab,
    closeTab,
    setActiveTab,
    addMessage,
    createNewConversation,
    openNewConversationTab,
    deleteConversation,
    setLoadingState,
    clearLoadingState
  ]);

  return memoizedReturn;
}