-- Add conversation_history JSONB column to conversations table for efficient searching
ALTER TABLE public.conversations 
ADD COLUMN conversation_history JSONB DEFAULT '[]'::jsonb;

-- Create index for conversation history search
CREATE INDEX idx_conversations_history_gin ON public.conversations USING GIN (conversation_history);

-- Create function to update conversation history when messages are added
CREATE OR REPLACE FUNCTION update_conversation_history()
RETURNS trigger AS $$
BEGIN
  -- Update conversation history with the new message
  UPDATE public.conversations 
  SET 
    conversation_history = COALESCE(conversation_history, '[]'::jsonb) || 
      jsonb_build_object(
        'role', NEW.role,
        'content', NEW.content,
        'timestamp', NEW.created_at
      ),
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update conversation history
CREATE TRIGGER trigger_update_conversation_history
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_history();