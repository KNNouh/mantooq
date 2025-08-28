import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Settings, LogOut, Trash2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useImprovedMultipleConversations } from '@/hooks/useImprovedMultipleConversations';
import { MessageSkeleton, ConversationSkeleton } from '@/components/ui/loading-skeleton';
import { ImprovedConversationTabs } from './ImprovedConversationTabs';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/ui/language-switcher';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '@/hooks/use-toast';
import ImprovedChatLoadingIndicator from './ImprovedChatLoadingIndicator';
import { DeleteConversationDialog } from './DeleteConversationDialog';

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
  
  const [inputMessage, setInputMessage] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<{id: string, title: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    tabs,
    activeTabId,
    conversations,
    loading: conversationsLoading,
    loadingState,
    maxTabs,
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
                  <div
                    key={conversation.id}
                    className={`group relative w-full ${language === 'ar' ? 'text-right' : 'text-left'} rounded-lg border transition-colors ${
                      tabs.some(tab => tab.conversation.id === conversation.id)
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <button
                      onClick={() => openConversationInTab(conversation)}
                      className="w-full p-3 text-left"
                    >
                      <div className="truncate font-medium pr-8">{conversation.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(conversation.created_at).toLocaleDateString(language === 'ar' ? 'ar-QA' : 'en-US')}
                      </div>
                      {tabs.some(tab => tab.conversation.id === conversation.id) && (
                        <div className="text-xs text-primary font-medium mt-1">
                          {t('chat.open_in_tab')}
                        </div>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => handleDeleteClick(conversation, e)}
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

            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder={t('chat.type_message')}
                  className="flex-1"
                  disabled={loadingState.isLoading}
                />
                <Button 
                  type="submit" 
                  disabled={loadingState.isLoading || !inputMessage.trim()}
                  className="px-4"
                >
                  {loadingState.isLoading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
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