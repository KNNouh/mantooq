import { useEffect, useCallback } from 'react';

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

interface ConversationState {
  tabs: ConversationTab[];
  activeTabId: string | null;
  lastSyncTimestamp: number;
}

export function useConversationPersistence(userId: string | null) {
  const STORAGE_KEY = `chat_state_${userId}`;
  const SYNC_INTERVAL = 30000; // 30 seconds

  const saveState = useCallback((tabs: ConversationTab[], activeTabId: string | null) => {
    if (!userId) return;

    const state: ConversationState = {
      tabs,
      activeTabId,
      lastSyncTimestamp: Date.now()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      console.log('💾 Conversation state saved to localStorage');
    } catch (error) {
      console.error('Failed to save conversation state:', error);
    }
  }, [userId, STORAGE_KEY]);

  const loadState = useCallback((): ConversationState | null => {
    if (!userId) return null;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const state = JSON.parse(saved) as ConversationState;
      
      // Check if state is not too old (max 1 hour)
      const maxAge = 60 * 60 * 1000; // 1 hour
      if (Date.now() - state.lastSyncTimestamp > maxAge) {
        console.log('🗑️ Conversation state expired, clearing');
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      console.log('📂 Conversation state loaded from localStorage');
      return state;
    } catch (error) {
      console.error('Failed to load conversation state:', error);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }, [userId, STORAGE_KEY]);

  const clearState = useCallback(() => {
    if (!userId) return;
    
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('🗑️ Conversation state cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear conversation state:', error);
    }
  }, [userId, STORAGE_KEY]);

  const createSnapshot = useCallback((tabs: ConversationTab[], activeTabId: string | null) => {
    const snapshotKey = `${STORAGE_KEY}_snapshot_${Date.now()}`;
    const state: ConversationState = {
      tabs,
      activeTabId,
      lastSyncTimestamp: Date.now()
    };

    try {
      localStorage.setItem(snapshotKey, JSON.stringify(state));
      
      // Keep only last 3 snapshots
      const allKeys = Object.keys(localStorage).filter(key => 
        key.startsWith(`${STORAGE_KEY}_snapshot_`)
      );
      
      if (allKeys.length > 3) {
        allKeys.sort().slice(0, -3).forEach(key => {
          localStorage.removeItem(key);
        });
      }
      
      console.log('📸 Conversation snapshot created');
    } catch (error) {
      console.error('Failed to create conversation snapshot:', error);
    }
  }, [userId, STORAGE_KEY]);

  const getLatestSnapshot = useCallback((): ConversationState | null => {
    if (!userId) return null;

    try {
      const allKeys = Object.keys(localStorage).filter(key => 
        key.startsWith(`${STORAGE_KEY}_snapshot_`)
      );
      
      if (allKeys.length === 0) return null;
      
      const latestKey = allKeys.sort().pop();
      if (!latestKey) return null;
      
      const saved = localStorage.getItem(latestKey);
      if (!saved) return null;
      
      const state = JSON.parse(saved) as ConversationState;
      console.log('📸 Latest conversation snapshot retrieved');
      return state;
    } catch (error) {
      console.error('Failed to get latest snapshot:', error);
      return null;
    }
  }, [userId, STORAGE_KEY]);

  // Auto-save state every 30 seconds
  useEffect(() => {
    if (!userId) return;

    const intervalId = setInterval(() => {
      // This will be called from the parent component
      console.log('⏰ Auto-save interval triggered');
    }, SYNC_INTERVAL);

    return () => clearInterval(intervalId);
  }, [userId, SYNC_INTERVAL]);

  // Clear state when user changes
  useEffect(() => {
    if (!userId) {
      // Clear any existing state when user logs out
      const allKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('chat_state_') || key.includes('_snapshot_')
      );
      allKeys.forEach(key => localStorage.removeItem(key));
    }
  }, [userId]);

  return {
    saveState,
    loadState,
    clearState,
    createSnapshot,
    getLatestSnapshot
  };
}
