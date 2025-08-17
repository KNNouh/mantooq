import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Settings, LogOut, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useMultipleConversations } from '@/hooks/useMultipleConversations';
import { MessageSkeleton, ConversationSkeleton } from '@/components/ui/loading-skeleton';
import { AdminUpload } from './AdminUpload';
import { ConversationTabs } from './ConversationTabs';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const MultiChatInterface = memo(() => {
  const {
    user,
    signOut,
    userRoles
  } = useOptimizedAuth();

  const {
    tabs,
    activeTabId,
    conversations,
    loading: conversationsLoading,
    maxTabs,
    loadConversations,
    openConversationInTab,
    closeTab,
    setActiveTab,
    addMessage,
    createNewConversation,
    openNewConversationTab
  } = useMultipleConversations(user?.id || null);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get active tab
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Auto-scroll to bottom when new messages arrive in active tab
  useEffect(() => {
    if (activeTab) {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth'
      });
    }
  }, [activeTab?.messages]);

  // Load conversations when user changes
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Optimized message sending with better error handling
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || !user) return;
    
    const message = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      let conversationId = activeTab?.conversation.id;

      // Create new conversation if none exists or if it's a new tab
      if (!conversationId) {
        conversationId = await createNewConversation(message);
        
        // If we have an active new tab, update it with the new conversation
        if (activeTab && !activeTab.conversation.id) {
          const newConversation = conversations.find(c => c.id === conversationId);
          if (newConversation) {
            openConversationInTab(newConversation);
          }
        } else {
          // Open the new conversation in a tab
          const newConversation = conversations.find(c => c.id === conversationId);
          if (newConversation) {
            openConversationInTab(newConversation);
          }
        }
      }

      // Add user message
      await addMessage(conversationId, 'user', message);

      // Trigger webhook to get AI response
      supabase.functions.invoke('trigger-chat-response', {
        body: {
          message,
          conversationId
        }
      }).then(({ error }) => {
        if (error) {
          console.error('Error triggering chat response:', error);
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
  }, [inputMessage, isLoading, user, activeTab, createNewConversation, addMessage, conversations, openConversationInTab]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to continue</h2>
          <Button onClick={() => window.location.href = '/auth'}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="h-5 w-5" />
            <h2 className="font-semibold">Chat History</h2>
          </div>
          
          <Button 
            onClick={openNewConversationTab} 
            className="w-full mb-4" 
            variant="outline"
            disabled={tabs.length >= maxTabs}
          >
            New Chat {tabs.length >= maxTabs && '(Max reached)'}
          </Button>

          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-2">
              {conversationsLoading ? (
                <ConversationSkeleton />
              ) : (
                conversations.map(conversation => (
                  <button
                    key={conversation.id}
                    onClick={() => openConversationInTab(conversation)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      tabs.some(tab => tab.conversation.id === conversation.id)
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="truncate font-medium">{conversation.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(conversation.created_at).toLocaleDateString()}
                    </div>
                    {tabs.some(tab => tab.conversation.id === conversation.id) && (
                      <div className="text-xs text-primary font-medium mt-1">
                        Open in tab
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="mt-4 pt-4 border-t">
            <div className="flex gap-2">
              {userRoles.isAdmin && (
                <Button
                  onClick={() => window.location.href = '/admin'}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Admin
                </Button>
              )}
              <Button
                onClick={signOut}
                variant="outline"
                size="sm"
                className={userRoles.isAdmin ? 'flex-1' : 'w-full'}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with tabs */}
        <div className="border-b">
          <div className="p-4 pb-0">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">Chat Assistant</h1>
              {userRoles.isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpload(!showUpload)}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
              )}
            </div>
          </div>
          
          {tabs.length > 0 && (
            <ConversationTabs
              tabs={tabs}
              activeTabId={activeTabId}
              maxTabs={maxTabs}
              onTabSelect={setActiveTab}
              onTabClose={closeTab}
              onNewTab={openNewConversationTab}
            />
          )}
        </div>

        {showUpload && userRoles.isAdmin && (
          <div className="p-4 border-b bg-muted/50">
            <AdminUpload />
          </div>
        )}

        {/* Chat content */}
        {activeTab ? (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {activeTab.loadingMessages ? (
                  <MessageSkeleton />
                ) : (
                  activeTab.messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <div className="text-xs mt-1 opacity-70">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                        Thinking...
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !inputMessage.trim()}>
                  Send
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No conversation selected</h3>
              <p className="text-sm">
                Open a conversation from the sidebar or start a new chat
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

MultiChatInterface.displayName = 'MultiChatInterface';
export default MultiChatInterface;