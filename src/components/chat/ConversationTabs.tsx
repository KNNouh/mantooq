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
    <div className="flex items-center bg-muted/30 border-b px-2 py-1 overflow-x-auto">
      <div className="flex gap-1 min-w-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-t-lg border-b-2 cursor-pointer
              min-w-0 max-w-[200px] group transition-colors
              ${activeTabId === tab.id 
                ? 'bg-background border-primary text-foreground' 
                : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
            onClick={() => onTabSelect(tab.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">
                {tab.conversation.title || 'New Chat'}
              </div>
            </div>
            
            {tab.unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px] text-xs px-1">
                {tab.unreadCount > 99 ? '99+' : tab.unreadCount}
              </Badge>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-opacity"
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
          variant="ghost"
          size="sm"
          className="ml-2 h-8 w-8 p-0 flex-shrink-0"
          onClick={onNewTab}
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};