import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Settings, LogOut, Trash2, Send, Menu, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useImprovedMultipleConversations } from '@/hooks/useImprovedMultipleConversations';
import { MessageSkeleton, ConversationSkeleton } from '@/components/ui/loading-skeleton';
import { ImprovedConversationTabs } from './ImprovedConversationTabs';
import { ConnectionStatus } from './ConnectionStatus';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/ui/language-switcher';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '@/hooks/use-toast';
import ImprovedChatLoadingIndicator from './ImprovedChatLoadingIndicator';
import { DeleteConversationDialog } from './DeleteConversationDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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
  const isMobile = useIsMobile();
  
  const [inputMessage, setInputMessage] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<{id: string, title: string} | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    tabs,
    activeTabId,
    conversations,
    loading: conversationsLoading,
    loadingState,
    maxTabs,
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
  } = useImprovedMultipleConversations(user?.id || null);

  // Get active tab
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Retry function for failed requests
  const handleRetry = useCallback(() => {
    if (!activeTab) return;
    
    // Resend the last user message
    const lastUserMessage = activeTab.messages
      .filter(m => m.role === 'user')
      .pop();
    
    if (lastUserMessage) {
      setInputMessage(lastUserMessage.content);
      clearLoadingState();
    }
  }, [activeTab, clearLoadingState]);

  // Handle timeout for loading indicator
  const handleTimeout = useCallback(() => {
    console.warn('⚠️ Chat loading timeout');
    clearLoadingState();
  }, [clearLoadingState]);

  const handleDeleteClick = useCallback((conversation: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToDelete({
      id: conversation.id,
      title: conversation.title
    });
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!conversationToDelete) return;
    
    try {
      await deleteConversation(conversationToDelete.id);
      toast({
        title: t('delete.success'),
        variant: "default"
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: t('delete.error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    }
  }, [conversationToDelete, deleteConversation, toast, t]);

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
      clearLoadingState();
    }
  }, [user, loadConversations, clearLoadingState]);

  // Optimized message sending with improved error handling
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loadingState.isLoading || !user) return;
    
    const message = inputMessage.trim();
    setInputMessage('');

    try {
      let conversationId = activeTab?.conversation.id;
      
      // Set loading state
      setLoadingState({ 
        isLoading: true, 
        conversationId: conversationId || 'new'
      });

      // Create new conversation if needed
      if (!conversationId) {
        try {
          conversationId = await createNewConversation(message);
          
          // Reload conversations and open the new one
          await loadConversations();
          
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
          
          clearLoadingState();
          return;
        }
      }

      // Update loading state with actual conversation ID
      setLoadingState({ 
        isLoading: true, 
        conversationId 
      });

      // Add user message
      await addMessage(conversationId, 'user', message);

      // Trigger webhook for AI response
      const { data: webhookResponse, error } = await supabase.functions.invoke('trigger-chat-response', {
        body: {
          message,
          conversationId
        }
      });

      if (error) {
        console.error('Error triggering chat response:', error);
        await addMessage(conversationId!, 'assistant', 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.');
        clearLoadingState();
        toast({
          title: "خطأ في الإرسال",
          description: "حدث خطأ أثناء معالجة رسالتك. يرجى المحاولة مرة أخرى.",
          variant: "destructive",
        });
      } else {
        // Update loading state with log ID if available
        if (webhookResponse?.logId) {
          setLoadingState({ 
            isLoading: true, 
            conversationId,
            logId: webhookResponse.logId 
          });
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      if (activeTab?.conversation.id) {
        await addMessage(activeTab.conversation.id, 'assistant', 'حدث خطأ أثناء معالجة رسالتك.');
      }
      clearLoadingState();
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    }
  }, [inputMessage, loadingState.isLoading, user, activeTab, createNewConversation, addMessage, loadConversations, openConversationInTab, setLoadingState, clearLoadingState, toast]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to continue</h2>
          <Button 
            onClick={() => window.location.href = '/auth'}
            size="lg"
            className="touch-target"
            aria-label="Sign in to access chat"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Sidebar Component for Desktop and Mobile
  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <h2 className="font-semibold text-lg">{t('chat.history')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {isMobile && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSidebarOpen(false)}
                className="touch-target"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <Button 
          onClick={() => {
            openNewConversationTab();
            if (isMobile) setSidebarOpen(false);
          }} 
          className="w-full mb-4 touch-target" 
          variant="outline"
          disabled={tabs.length >= maxTabs}
          aria-label={`${t('chat.new')} ${tabs.length >= maxTabs ? `(${t('chat.max_reached')})` : ''}`}
        >
          {t('chat.new')} {tabs.length >= maxTabs && `(${t('chat.max_reached')})`}
        </Button>

        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-2">
            {conversationsLoading ? (
              <ConversationSkeleton />
            ) : (
              conversations.map(conversation => (
                <div
                  key={conversation.id}
                  className={`group relative w-full ${language === 'ar' ? 'text-right' : 'text-left'} rounded-lg border transition-all duration-200 ${
                    tabs.some(tab => tab.conversation.id === conversation.id)
                      ? 'bg-primary/10 border-primary shadow-sm' 
                      : 'hover:bg-muted hover:shadow-sm'
                  }`}
                >
                  <button
                    onClick={() => {
                      openConversationInTab(conversation);
                      if (isMobile) setSidebarOpen(false);
                    }}
                    className="w-full p-3 text-left touch-target"
                    aria-label={`Open conversation: ${conversation.title}`}
                  >
                    <div className="truncate font-medium pr-8 text-base">{conversation.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {new Date(conversation.created_at).toLocaleDateString(language === 'ar' ? 'ar-QA' : 'en-US')}
                    </div>
                    {tabs.some(tab => tab.conversation.id === conversation.id) && (
                      <div className="text-sm text-primary font-medium mt-1">
                        {t('chat.open_in_tab')}
                      </div>
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-all duration-200 touch-target hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => handleDeleteClick(conversation, e)}
                    aria-label={`Delete conversation: ${conversation.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
                className="flex-1 touch-target"
                aria-label="Admin panel"
              >
                <Settings className={`h-4 w-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                {t('nav.admin')}
              </Button>
            )}
            <Button
              onClick={signOut}
              variant="outline"
              size="sm"
              className={`${userRoles.isAdmin ? 'flex-1' : 'w-full'} touch-target`}
              aria-label="Sign out"
            >
              <LogOut className={`h-4 w-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              {t('auth.signout')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className={`w-80 ${language === 'ar' ? 'border-l' : 'border-r'} flex flex-col bg-card`}>
          <SidebarContent />
        </div>
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-4 left-4 z-50 touch-target bg-background/80 backdrop-blur-sm border shadow-md"
              aria-label="Open chat history"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent 
            side={language === 'ar' ? 'right' : 'left'} 
            className="w-80 p-0 bg-card"
          >
            <SidebarContent />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col" id="main-content">
        {/* Header with tabs and connection status */}
        <div className="border-b bg-card/50 backdrop-blur-sm">
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <h1 className={`text-xl font-semibold ${isMobile ? 'ml-16' : ''}`}>
                {t('chat.assistant')}
              </h1>
              <ConnectionStatus
                status={connectionStatus}
                retryCount={retryCount}
                onReconnect={reconnect}
                className="text-sm"
              />
            </div>
          </div>
          
          <ImprovedConversationTabs
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
                      role="article"
                      aria-label={`${message.role === 'user' ? 'Your message' : 'Assistant message'} at ${new Date(message.created_at).toLocaleTimeString()}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[80%] p-4 rounded-lg shadow-sm transition-all duration-200 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted border'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className={`prose prose-base dark:prose-invert max-w-none ${language === 'ar' ? 'prose-rtl' : ''}`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className={`whitespace-pre-wrap text-base leading-relaxed ${language === 'ar' ? 'text-right arabic-text' : ''}`}>
                            {message.content}
                          </div>
                        )}
                        <div className="text-sm mt-2 opacity-70">
                          {new Date(message.created_at).toLocaleTimeString(language === 'ar' ? 'ar-QA' : 'en-US')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {loadingState.isLoading && activeTab && (
                  <ImprovedChatLoadingIndicator
                    conversationId={loadingState.conversationId || activeTab.conversation.id}
                    onRetry={handleRetry}
                    onTimeout={handleTimeout}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t bg-card/50 backdrop-blur-sm">
              <form 
                onSubmit={handleSendMessage} 
                className="flex gap-2 sm:gap-3"
                role="form"
                aria-label="Send message form"
              >
                <Input
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder={t('chat.type_message')}
                  className="flex-1 text-base min-h-[48px] touch-target"
                  disabled={loadingState.isLoading}
                  aria-label="Type your message"
                />
                <Button 
                  type="submit" 
                  disabled={loadingState.isLoading || !inputMessage.trim()}
                  size="icon-lg"
                  className="touch-target"
                  aria-label="Send message"
                >
                  {loadingState.isLoading ? (
                    <div 
                      className="animate-spin h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                      aria-label="Sending message"
                    />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-muted-foreground max-w-md">
              <MessageCircle className="h-24 w-24 mx-auto mb-6 opacity-30" />
              <h3 className="text-2xl font-medium mb-4">{t('chat.welcome')}</h3>
              <p className="text-base mb-8 leading-relaxed">
                {t('chat.welcome_desc')} {maxTabs} {t('chat.conversations_simultaneously')}. 
                {t('chat.click_new_chat')}
              </p>
              <Button 
                onClick={openNewConversationTab} 
                variant="outline" 
                size="lg"
                className="mb-4 touch-target"
                aria-label="Start new conversation"
              >
                {t('chat.start_new')}
              </Button>
              <p className="text-sm text-muted-foreground">
                {t('chat.tabs')}: {tabs.length}/{maxTabs}
              </p>
            </div>
          </div>
        )}
      </div>

      <DeleteConversationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        conversationTitle={conversationToDelete?.title || ''}
      />
    </div>
  );
});

MultiChatInterface.displayName = 'MultiChatInterface';
export default MultiChatInterface;