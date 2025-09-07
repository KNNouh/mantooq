import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEnhancedRealtimeSubscription } from './useEnhancedRealtimeSubscription';
import { useConversationPersistence } from './useConversationPersistence';

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
  logId?: string;
}

interface ConnectionHealth {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'degraded';
  quality: number;
  latency: number;
  lastHeartbeat: number;
  consecutiveFailures: number;
}

interface UseImprovedMultipleConversationsReturn {
  tabs: ConversationTab[];
  activeTabId: string | null;
  conversations: Conversation[];
  loading: boolean;
  loadingState: LoadingState;
  maxTabs: number;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' | 'degraded';
  connectionHealth: ConnectionHealth;
  retryCount: number;
  isConnected: boolean;
  reconnect: () => void;
  forceRefresh: () => void;
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

  // Initialize persistence hooks
  const { saveState, loadState, createSnapshot } = useConversationPersistence(userId);

  // Clear loading state helper
  const clearLoadingState = useCallback(() => {
    setLoadingState({ isLoading: false });
  }, []);

  // Handle incoming realtime messages with improved reliability
  const handleRealtimeMessage = useCallback((newMessage: Message) => {
    console.log('📨 Processing realtime message for all tabs:', newMessage);

    setTabs(prev => {
      let wasUpdated = false;
      const updatedTabs = prev.map(tab => {
        // Check if this message belongs to this tab's conversation
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
          
          console.log(`✅ Added message to tab ${tab.id} (${tab.conversation.title}):`, newMessage.content.slice(0, 50));
          wasUpdated = true;
          
          return {
            ...tab,
            messages: updatedMessages,
            // Only increment unread for assistant messages in non-active tabs
            unreadCount: tab.id !== activeTabId && newMessage.role === 'assistant' 
              ? tab.unreadCount + 1 
              : tab.unreadCount
          };
        }
        return tab;
      });

      if (wasUpdated) {
        console.log('🔄 Tabs updated with new message');
      } else {
        console.log('⚠️ Message conversation not found in any open tab:', newMessage.conversation_id);
        // Log all open conversation IDs for debugging
        console.log('📂 Open conversation IDs:', prev.map(tab => ({ id: tab.conversation.id, title: tab.conversation.title })));
      }

      return updatedTabs;
    });

    // Clear loading state for assistant messages immediately after state update
    if (newMessage.role === 'assistant') {
      console.log('🛑 Assistant message received, clearing loading state');
      setLoadingState({ isLoading: false });
    }
  }, [activeTabId]);

  // Set up enhanced realtime subscription with connection monitoring
  const { connectionStatus, connectionHealth, retryCount, reconnect, forceRefresh, isConnected } = useEnhancedRealtimeSubscription({
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
      console.log('💾 Adding message to database...');
      
      // Immediately add user message to local state for instant UI update
      if (role === 'user') {
        const tempMessage = {
          id: `temp-${Date.now()}`, // Temporary ID
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

      // Replace temporary message with real one for user messages
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

      console.log('✅ Message added to database successfully');
    } catch (error) {
      console.error('❌ Failed to add message:', error);
      
      // Remove temporary message on error
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

  // Auto-save state every 30 seconds and on changes
  useEffect(() => {
    if (userId && tabs.length > 0) {
      saveState(tabs, activeTabId);
    }
  }, [tabs, activeTabId, userId, saveState]);

  // Create snapshots every 2 minutes
  useEffect(() => {
    if (!userId || tabs.length === 0) return;

    const snapshotInterval = setInterval(() => {
      createSnapshot(tabs, activeTabId);
    }, 120000); // 2 minutes

    return () => clearInterval(snapshotInterval);
  }, [userId, tabs, activeTabId, createSnapshot]);

  // Load conversations and restore state when userId changes
  useEffect(() => {
    if (userId) {
      loadConversations();
      
      // Try to restore state from localStorage
      const savedState = loadState();
      if (savedState && savedState.tabs.length > 0) {
        console.log('🔄 Restoring conversation state from localStorage');
        setTabs(savedState.tabs);
        setActiveTabId(savedState.activeTabId);
      }
    } else {
      setConversations([]);
      setTabs([]);
      setActiveTabId(null);
      clearLoadingState();
    }
  }, [userId, loadConversations, clearLoadingState, loadState]);

  const memoizedReturn = useMemo(() => ({
    tabs,
    activeTabId,
    conversations,
    loading,
    loadingState,
    maxTabs: MAX_TABS,
    connectionStatus,
    connectionHealth,
    retryCount,
    isConnected,
    reconnect,
    forceRefresh,
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
    connectionHealth,
    retryCount,
    isConnected,
    reconnect,
    forceRefresh,
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