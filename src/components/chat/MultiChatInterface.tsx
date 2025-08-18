import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useMultipleConversations } from '@/hooks/useMultipleConversations';
import { MessageSkeleton, ConversationSkeleton } from '@/components/ui/loading-skeleton';
import { ConversationTabs } from './ConversationTabs';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/ui/language-switcher';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
}

const MultiChatInterface = memo(() => {
  const {
    user,
    signOut,
    userRoles
  } = useOptimizedAuth();

  const { toast } = useToast();
  const { language, t } = useLanguage();

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
  const [conversationLoadingStates, setConversationLoadingStates] = useState<Record<string, boolean>>({});
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

  // Real-time subscription for assistant messages to stop loading
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `role=eq.assistant`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Stop loading for this conversation when assistant responds
          setConversationLoadingStates(prev => ({
            ...prev,
            [newMessage.conversation_id]: false
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Optimized message sending with better error handling and conversation continuity
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || !user) return;
    
    const message = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      let conversationId = activeTab?.conversation.id;
      
      // Set loading state for this specific conversation
      if (conversationId) {
        setConversationLoadingStates(prev => ({
          ...prev,
          [conversationId!]: true
        }));
      }

      // Create new conversation ONLY if no tab is active or tab has no conversation
      if (!conversationId) {
        try {
          conversationId = await createNewConversation(message);
          
          // Reload conversations to get the new one
          await loadConversations();
          
          // Find and open the new conversation in a tab
          setTimeout(async () => {
            const { data: newConv } = await supabase
              .from('conversations')
              .select('id, title, created_at')
              .eq('id', conversationId)
              .single();
            
            if (newConv) {
              openConversationInTab(newConv);
            }
          }, 100);
        } catch (convError: any) {
          console.error('Error creating conversation:', convError);
          
          // Show user-friendly error message
          if (convError.message?.includes('3 محادثات') || convError.message?.includes('more than 3 conversations')) {
            toast({
              title: "تم الوصول للحد الأقصى",
              description: "يمكنك إنشاء 3 محادثات كحد أقصى. يرجى حذف محادثة موجودة لإنشاء محادثة جديدة.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "خطأ في إنشاء المحادثة",
              description: "حدث خطأ أثناء إنشاء محادثة جديدة. يرجى المحاولة مرة أخرى.",
              variant: "destructive",
            });
          }
          
          // Stop loading on error
          setIsLoading(false);
          return;
        }
      }

      // Add user message
      await addMessage(conversationId, 'user', message);

      // Trigger webhook to get AI response
      const { error } = await supabase.functions.invoke('trigger-chat-response', {
        body: {
          message,
          conversationId
        }
      });

      if (error) {
        console.error('Error triggering chat response:', error);
        await addMessage(conversationId!, 'assistant', 'Sorry, I encountered an error. Please try again.');
        // Stop loading on error
        setConversationLoadingStates(prev => ({
          ...prev,
          [conversationId!]: false
        }));
      }

    } catch (error) {
      console.error('Error sending message:', error);
      await addMessage(activeTab?.conversation.id || '', 'assistant', 'An error occurred while processing your message.');
      // Stop loading on error
      if (activeTab?.conversation.id) {
        setConversationLoadingStates(prev => ({
          ...prev,
          [activeTab.conversation.id]: false
        }));
      }
    }
  }, [inputMessage, isLoading, user, activeTab, createNewConversation, addMessage, loadConversations, openConversationInTab]);

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
      <div className={`w-80 ${language === 'ar' ? 'border-l' : 'border-r'} flex flex-col`}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <h2 className="font-semibold">{t('chat.history')}</h2>
            </div>
            <LanguageSwitcher />
          </div>
          
          <Button 
            onClick={openNewConversationTab} 
            className="w-full mb-4" 
            variant="outline"
            disabled={tabs.length >= maxTabs}
          >
            {t('chat.new')} {tabs.length >= maxTabs && `(${t('chat.max_reached')})`}
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
                    className={`w-full ${language === 'ar' ? 'text-right' : 'text-left'} p-3 rounded-lg border transition-colors ${
                      tabs.some(tab => tab.conversation.id === conversation.id)
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="truncate font-medium">{conversation.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(conversation.created_at).toLocaleDateString(language === 'ar' ? 'ar-QA' : 'en-US')}
                    </div>
                    {tabs.some(tab => tab.conversation.id === conversation.id) && (
                      <div className="text-xs text-primary font-medium mt-1">
                        {t('chat.open_in_tab')}
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
                  <Settings className={`h-4 w-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                  {t('nav.admin')}
                </Button>
              )}
              <Button
                onClick={signOut}
                variant="outline"
                size="sm"
                className={userRoles.isAdmin ? 'flex-1' : 'w-full'}
              >
                <LogOut className={`h-4 w-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                {t('auth.signout')}
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
            <h1 className="text-xl font-semibold">{t('chat.assistant')}</h1>
          </div>
          
          <ConversationTabs
            tabs={tabs}
            activeTabId={activeTabId}
            maxTabs={maxTabs}
            onTabSelect={setActiveTab}
            onTabClose={closeTab}
            onNewTab={openNewConversationTab}
          />
        </div>

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
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className={`prose prose-sm dark:prose-invert max-w-none ${language === 'ar' ? 'prose-rtl' : ''}`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className={`whitespace-pre-wrap ${language === 'ar' ? 'text-right arabic-text' : ''}`}>
                            {message.content}
                          </div>
                        )}
                        <div className="text-xs mt-1 opacity-70">
                          {new Date(message.created_at).toLocaleTimeString(language === 'ar' ? 'ar-QA' : 'en-US')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {(isLoading || (activeTab && conversationLoadingStates[activeTab.conversation.id])) && (
                  <div className={`flex ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                    <div className="bg-muted/80 backdrop-blur-sm p-4 rounded-2xl border border-border/50 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="animate-spin h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full"></div>
                          <div className="absolute inset-0 animate-pulse">
                            <div className="h-5 w-5 border-2 border-transparent border-t-primary/50 rounded-full"></div>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-foreground/80 animate-pulse">
                          {t('chat.thinking')}
                        </span>
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
                  placeholder={t('chat.type_message')}
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !inputMessage.trim()}>
                  {t('chat.send')}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground max-w-md">
              <MessageCircle className="h-20 w-20 mx-auto mb-6 opacity-30" />
              <h3 className="text-xl font-medium mb-3">{t('chat.welcome')}</h3>
              <p className="text-sm mb-6 leading-relaxed">
                {t('chat.welcome_desc')} {maxTabs} {t('chat.conversations_simultaneously')}. 
                {t('chat.click_new_chat')}
              </p>
              <Button onClick={openNewConversationTab} variant="outline" className="mb-2">
                {t('chat.start_new')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('chat.tabs')}: {tabs.length}/{maxTabs}
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