import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
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
  logId?: string;
}

interface UseImprovedMultipleConversationsReturn {
  tabs: ConversationTab[];
  activeTabId: string | null;
  conversations: Conversation[];
  loading: boolean;
  loadingState: LoadingState;
  maxTabs: number;
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

export function useImprovedMultipleConversations(
  userId: string | null
): UseImprovedMultipleConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tabs, setTabs] = useState<ConversationTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false });

  // Clear loading state helper
  const clearLoadingState = useCallback(() => {
    setLoadingState({ isLoading: false });
  }, []);

  // Handle incoming realtime messages with proper dependency management
  const handleRealtimeMessage = useCallback((newMessage: Message) => {
    console.log('📨 Processing realtime message:', newMessage);

    setTabs(prev => {
      let wasUpdated = false;
      const updatedTabs = prev.map(tab => {
        if (tab.conversation.id === newMessage.conversation_id) {
          // Simple ID-based duplicate check
          const messageExists = tab.messages.some(msg => msg.id === newMessage.id);
          
          if (messageExists) {
            console.log('🔄 Duplicate message detected, skipping:', newMessage.id);
            return tab;
          }
          
          const updatedMessages = [...tab.messages, newMessage].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          
          console.log(`✅ Added message to tab ${tab.id}:`, newMessage.content.slice(0, 50));
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

    // Clear loading state for assistant messages immediately after state update
    if (newMessage.role === 'assistant') {
      console.log('🛑 Assistant message received, clearing loading state');
      setLoadingState({ isLoading: false });
    }
  }, [activeTabId]); // Include activeTabId dependency

  // Set up realtime subscription with connection monitoring
  const { connectionStatus, retryCount, reconnect, isConnected } = useRealtimeSubscription({
    userId,
    onMessage: handleRealtimeMessage,
    enabled: !!userId
  });

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
        .select('id, role, content, created_at, conversation_id')
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

    // Check if we've reached max tabs and close oldest inactive tab
    if (tabs.length >= MAX_TABS) {
      const oldestInactiveTab = tabs.find(tab => tab.id !== activeTabId);
      if (oldestInactiveTab) {
        setTabs(prev => prev.filter(tab => tab.id !== oldestInactiveTab.id));
      } else {
        return; // All tabs are active, can't open new one
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
      console.log('✅ Message added to database:', newMessage.id);

      // For user messages, update local state immediately for better UX
      if (role === 'user') {
        setTabs(prev => prev.map(tab => {
          if (tab.conversation.id === conversationId) {
            const messageExists = tab.messages.some(msg => msg.id === newMessage.id);
            if (!messageExists) {
              const updatedMessages = [...tab.messages, newMessage].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return { ...tab, messages: updatedMessages };
            }
          }
          return tab;
        }));
      }
      
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }, [userId]);

  const createNewConversation = useCallback(async (firstMessage: string): Promise<string> => {
    if (!userId) throw new Error('User not authenticated');

    try {
      // Check current conversation count
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
      clearLoadingState();
    }
  }, [userId, loadConversations, clearLoadingState]);

  const memoizedReturn = useMemo(() => ({
    tabs,
    activeTabId,
    conversations,
    loading,
    loadingState,
    maxTabs: MAX_TABS,
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