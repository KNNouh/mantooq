import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

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

interface ConversationTabsProps {
  tabs: ConversationTab[];
  activeTabId: string | null;
  maxTabs: number;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export const ConversationTabs: React.FC<ConversationTabsProps> = ({
  tabs,
  activeTabId,
  maxTabs,
  onTabSelect,
  onTabClose,
  onNewTab
}) => {
  return (
    <div className="flex items-center bg-gradient-to-r from-muted/50 to-muted/30 border-b px-3 py-2 overflow-x-auto shadow-sm">
      <div className="flex gap-2 min-w-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 cursor-pointer
              min-w-0 max-w-[220px] group hover:shadow-md
              ${activeTabId === tab.id 
                ? 'bg-background border-primary shadow-lg ring-1 ring-primary/20 text-foreground font-medium' 
                : 'bg-background/60 border-border/50 text-muted-foreground hover:bg-background hover:text-foreground hover:border-border'
              }
            `}
            onClick={() => onTabSelect(tab.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">
                {tab.conversation.title || 'New Chat'}
              </div>
              {tab.loadingMessages && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  Loading...
                </div>
              )}
            </div>
            
            {tab.unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-[20px] text-xs px-1.5 bg-primary text-primary-foreground animate-pulse">
                {tab.unreadCount > 99 ? '99+' : tab.unreadCount}
              </Badge>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      
      {tabs.length < maxTabs && (
        <Button
          variant="outline"
          size="sm"
          className="ml-3 h-8 w-8 p-0 flex-shrink-0 border-dashed hover:border-solid transition-all duration-200"
          onClick={onNewTab}
          title={`New conversation (${tabs.length}/${maxTabs})`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};