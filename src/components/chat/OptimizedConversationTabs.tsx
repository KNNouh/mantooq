import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus, MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface OptimizedConversationTabsProps {
  tabs: ConversationTab[];
  activeTabId: string | null;
  maxTabs: number;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export const OptimizedConversationTabs: React.FC<OptimizedConversationTabsProps> = ({
  tabs,
  activeTabId,
  maxTabs,
  onTabSelect,
  onTabClose,
  onNewTab
}) => {
  const { language, t } = useLanguage();

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 border-b">
        <Button
          onClick={onNewTab}
          variant="outline"
          size="sm"
          className="gap-2"
          aria-label={t('chat.new')}
        >
          <Plus className="h-4 w-4" />
          {t('chat.new')}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center p-2 gap-1">
          {tabs.map((tab) => (
            <div key={tab.id} className="relative flex-shrink-0">
              <Button
                variant={activeTabId === tab.id ? "default" : "ghost"}
                size="sm"
                className={`
                  relative px-4 py-2 max-w-[200px] justify-start gap-2
                  ${activeTabId === tab.id ? 'shadow-sm' : 'hover:bg-muted'}
                  ${language === 'ar' ? 'flex-row-reverse' : ''}
                `}
                onClick={() => onTabSelect(tab.id)}
                aria-label={`Select tab: ${tab.conversation.title || 'New Chat'}`}
              >
                <MessageCircle className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-sm">
                  {tab.conversation.title || t('chat.new')}
                </span>
                {tab.unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs ml-auto"
                  >
                    {tab.unreadCount}
                  </Badge>
                )}
                {tab.loadingMessages && (
                  <div 
                    className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full ml-auto"
                    aria-label="Loading messages"
                  />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`
                  absolute ${language === 'ar' ? 'left-1' : 'right-1'} top-1 h-6 w-6 
                  hover:bg-destructive hover:text-destructive-foreground
                  opacity-0 group-hover:opacity-100 transition-opacity
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                aria-label={`Close tab: ${tab.conversation.title || 'New Chat'}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          
          {tabs.length < maxTabs && (
            <Button
              onClick={onNewTab}
              variant="ghost"
              size="sm"
              className="flex-shrink-0 gap-2 ml-2"
              aria-label={t('chat.new')}
            >
              <Plus className="h-4 w-4" />
              {t('chat.new')}
            </Button>
          )}
        </div>
      </ScrollArea>
      
      {tabs.length >= maxTabs && (
        <div className={`px-3 py-1 text-xs text-muted-foreground bg-muted/50 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {t('chat.max_tabs_reached')} ({tabs.length}/{maxTabs})
        </div>
      )}
    </div>
  );
};

export default OptimizedConversationTabs;