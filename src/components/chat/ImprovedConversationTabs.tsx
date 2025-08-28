import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConversationTab {
  id: string;
  conversation: {
    id: string;
    title: string;
    created_at: string;
  };
  messages: any[];
  loadingMessages: boolean;
  unreadCount: number;
}

interface ImprovedConversationTabsProps {
  tabs: ConversationTab[];
  activeTabId: string | null;
  maxTabs: number;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export const ImprovedConversationTabs: React.FC<ImprovedConversationTabsProps> = ({
  tabs,
  activeTabId,
  maxTabs,
  onTabSelect,
  onTabClose,
  onNewTab
}) => {
  const { language } = useLanguage();

  return (
    <div className="flex items-center bg-gradient-to-r from-muted/30 to-muted/10 border-b px-3 py-2 overflow-x-auto">
      <div className="flex gap-2 min-w-0 flex-1">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md border transition-all duration-200 cursor-pointer
              min-w-0 max-w-[200px] group hover:shadow-sm relative
              ${activeTabId === tab.id 
                ? 'bg-background border-primary shadow-sm ring-1 ring-primary/20 text-foreground font-medium' 
                : 'bg-background/50 border-border/30 text-muted-foreground hover:bg-background hover:text-foreground hover:border-border'
              }
            `}
            onClick={() => onTabSelect(tab.id)}
          >
            {/* Tab indicator */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              activeTabId === tab.id ? 'bg-primary' : 'bg-muted-foreground/40'
            }`} />
            
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">
                {tab.conversation.title || 'New Chat'}
              </div>
              {tab.loadingMessages && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                  <span>{language === 'ar' ? 'تحميل...' : 'Loading...'}</span>
                </div>
              )}
            </div>
            
            {/* Unread count */}
            {tab.unreadCount > 0 && (
              <Badge 
                variant="secondary" 
                className="h-5 min-w-[20px] text-xs px-1.5 bg-primary text-primary-foreground animate-pulse flex-shrink-0"
              >
                {tab.unreadCount > 99 ? '99+' : tab.unreadCount}
              </Badge>
            )}
            
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>

            {/* Tab position indicator */}
            {tabs.length > 1 && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                <div className={`w-1 h-1 rounded-full ${
                  activeTabId === tab.id ? 'bg-primary' : 'bg-transparent'
                }`} />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* New tab button */}
      {tabs.length < maxTabs ? (
        <Button
          variant="outline"
          size="sm"
          className="ml-3 h-8 w-8 p-0 flex-shrink-0 border-dashed hover:border-solid transition-all duration-200 hover:bg-primary/5"
          onClick={onNewTab}
          title={`${language === 'ar' ? 'محادثة جديدة' : 'New conversation'} (${tabs.length}/${maxTabs})`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      ) : (
        <div className="ml-3 flex items-center text-xs text-muted-foreground">
          <MessageCircle className="h-3 w-3 mr-1" />
          <span>{tabs.length}/{maxTabs}</span>
        </div>
      )}
    </div>
  );
};