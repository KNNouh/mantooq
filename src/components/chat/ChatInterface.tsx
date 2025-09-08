import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, User, Bot, Upload, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AdminUpload } from './AdminUpload';
import { ConnectionDebugIndicator } from './ConnectionDebugIndicator';
import { useEnhancedRealtimeSubscription } from '@/hooks/useEnhancedRealtimeSubscription';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  conversation_id: string;
  user_id: string;
  _source?: 'realtime' | 'polling'; // Debug indicator
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export const ChatInterface: React.FC = () => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Enhanced real-time subscription with debug capabilities
  const { 
    connectionHealth, 
    retryCount, 
    forceRefresh, 
    reconnect 
  } = useEnhancedRealtimeSubscription({
    userId: user?.id || null,
    onMessage: (newMessage: Message) => {
      console.log('📨 Message received via subscription:', newMessage);
      
      // Only add if it matches current conversation or no conversation selected
      if (!currentConversationId || newMessage.conversation_id === currentConversationId) {
        setMessages(prevMessages => {
          const exists = prevMessages.some(msg => msg.id === newMessage.id);
          if (!exists) {
            console.log('✅ Adding new message to chat:', newMessage.content?.slice(0, 50));
            return [...prevMessages, { ...newMessage, _source: newMessage._source || 'realtime' }];
          }
          return prevMessages;
        });
      }
    },
    enabled: true
  });

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewConversation = async (firstMessage: string) => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user!.id,
          title: firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  const addMessage = async (conversationId: string, role: 'user' | 'assistant', content: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: user!.id,
          role,
          content
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    try {
      let conversationId = currentConversationId;
      
      // Create new conversation if none exists
      if (!conversationId) {
        conversationId = await createNewConversation(messageContent);
        setCurrentConversationId(conversationId);
        await loadConversations();
      }

      // Add user message
      const userMessage = await addMessage(conversationId, 'user', messageContent);
      setMessages(prev => [...prev, userMessage]);

      // Send to n8n via webhook
      try {
        const { data, error } = await supabase.functions.invoke('trigger-chat-response', {
          body: { 
            message: messageContent, 
            conversationId: conversationId 
          }
        });
        
        if (error) {
          console.error('Error calling webhook:', error);
          toast({
            title: 'Warning',
            description: 'Message sent but webhook failed',
            variant: 'destructive'
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error calling n8n webhook:', error);
        setLoading(false);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const selectConversation = (conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    loadMessages(conversation.id);
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-sidebar-background">
        <div className="p-4 border-b">
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted/50 rounded">
              Debug: Admin={isAdmin ? '✅' : '❌'} | User={user?.email || 'None'}
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Chat History</h2>
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate('/admin')}
                    title="Admin Panel"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Admin
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUpload(!showUpload)}
                    title="Quick Upload"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Button onClick={startNewConversation} className="w-full">
            New Conversation
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2">
            {conversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={`mb-2 cursor-pointer transition-colors hover:bg-accent ${
                  currentConversationId === conversation.id ? 'bg-accent' : ''
                }`}
                onClick={() => selectConversation(conversation)}
              >
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate">{conversation.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(conversation.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {showUpload && isAdmin && (
          <div className="border-b p-4 bg-muted/50">
            <AdminUpload />
          </div>
        )}
        
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>Chat Assistant</CardTitle>
            <ConnectionDebugIndicator
              connectionHealth={connectionHealth}
              retryCount={retryCount}
              onForceRefresh={forceRefresh}
              onReconnect={reconnect}
            />
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {/* Debug indicator for message source */}
                  {(process.env.NODE_ENV === 'development' || message._source === 'polling') && message._source && (
                    <div className="text-xs opacity-60 mt-1">
                      {message._source === 'polling' ? '📡 Polling' : '⚡ Real-time'}
                    </div>
                  )}
                </div>
                
                {message.role === 'user' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8">
                  <AvatarFallback>
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm">Thinking...</p>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !inputMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;