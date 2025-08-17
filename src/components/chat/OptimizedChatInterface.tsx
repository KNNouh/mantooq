import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Plus, Settings, LogOut, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useOptimizedConversations } from '@/hooks/useOptimizedConversations';
import { MessageSkeleton, ConversationSkeleton } from '@/components/ui/loading-skeleton';
import { AdminUpload } from './AdminUpload';
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
interface Conversation {
  id: string;
  title: string;
  created_at: string;
}
const OptimizedChatInterface = memo(() => {
  const {
    user,
    signOut,
    userRoles
  } = useOptimizedAuth();
  const {
    conversations,
    messages,
    currentConversationId,
    loading: conversationsLoading,
    loadingMessages,
    loadConversations,
    loadMessages,
    selectConversation,
    addMessage,
    createNewConversation,
    clearCurrentConversation
  } = useOptimizedConversations(user?.id || null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages]);

  // Real-time subscription for new messages in current conversation
  useEffect(() => {
    if (!currentConversationId || !user) return;
    const channel = supabase.channel(`messages-realtime-${currentConversationId}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${currentConversationId}`
    }, payload => {
      console.log('Real-time message received:', payload);
      const newMessage = payload.new as Message;

      // Update messages via the hook (this will trigger a re-fetch)
      if (newMessage.role === 'assistant') {
        // Refresh messages when assistant responds
        loadMessages(currentConversationId);
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentConversationId, user, loadMessages]);

  // Load conversations when user changes
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Set current conversation when selecting one
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId, loadMessages]);

  // Optimized message sending with better error handling
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || !user) return;
    const message = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    try {
      let conversationId = currentConversationId;

      // Create new conversation if none exists
      if (!conversationId) {
        conversationId = await createNewConversation(message);
        // Don't call selectConversation here, it will trigger loadMessages
        // which we don't want since we're about to add the message
      }

      // Add user message
      await addMessage(conversationId, 'user', message);

      // Trigger webhook to get AI response - now async so UI responds immediately
      supabase.functions.invoke('trigger-chat-response', {
        body: {
          message,
          conversationId
        }
      }).then(({
        error
      }) => {
        if (error) {
          console.error('Error triggering chat response:', error);
          // Add error message to chat
          addMessage(conversationId!, 'assistant', 'Sorry, I encountered an error. Please try again.');
        }
      }).catch(error => {
        console.error('Webhook error:', error);
      });
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, user, currentConversationId, createNewConversation, addMessage]);
  const startNewConversation = useCallback(() => {
    clearCurrentConversation();
  }, [clearCurrentConversation]);
  if (!user) {
    return <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to continue</h2>
          <Button onClick={() => window.location.href = '/auth'}>
            Sign In
          </Button>
        </div>
      </div>;
  }
  return <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="h-5 w-5" />
            <h2 className="font-semibold">Chat History</h2>
          </div>
          
          <Button onClick={startNewConversation} className="w-full mb-4" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>

          <div className="space-y-2 flex-1">
            {conversationsLoading ? <ConversationSkeleton /> : conversations.map(conversation => <button key={conversation.id} onClick={() => selectConversation(conversation)} className={`w-full text-left p-3 rounded-lg border transition-colors ${currentConversationId === conversation.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                  <div className="truncate font-medium">{conversation.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(conversation.created_at).toLocaleDateString()}
                  </div>
                </button>)}
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex gap-2">
              {userRoles.isAdmin && <Button onClick={() => window.location.href = '/admin'} variant="outline" size="sm" className="flex-1">
                  <Settings className="h-4 w-4 mr-1" />
                  Admin
                </Button>}
              <Button onClick={signOut} variant="outline" size="sm" className={userRoles.isAdmin ? 'flex-1' : 'w-full'}>
                <LogOut className="h-4 w-4 mr-1" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Chat Assistant</h1>
            <div className="flex gap-2">
              {userRoles.isAdmin}
            </div>
          </div>
        </div>

        {showUpload && userRoles.isAdmin && <div className="p-4 border-b bg-muted/50">
            <AdminUpload />
          </div>}

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {loadingMessages ? <MessageSkeleton /> : messages.map(message => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>)}
            {isLoading && <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                    Thinking...
                  </div>
                </div>
              </div>}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input value={inputMessage} onChange={e => setInputMessage(e.target.value)} placeholder="Type your message..." className="flex-1" disabled={isLoading} />
            <Button type="submit" disabled={isLoading || !inputMessage.trim()}>
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>;
});
OptimizedChatInterface.displayName = 'OptimizedChatInterface';
export default OptimizedChatInterface;