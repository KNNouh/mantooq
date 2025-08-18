-- Create a function to check conversation limit
CREATE OR REPLACE FUNCTION check_conversation_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has 3 conversations
  IF (SELECT COUNT(*) FROM conversations WHERE user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'User cannot have more than 3 conversations. Please delete an existing conversation to create a new one.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce conversation limit
DROP TRIGGER IF EXISTS enforce_conversation_limit ON conversations;
CREATE TRIGGER enforce_conversation_limit
  BEFORE INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION check_conversation_limit();

-- Add an index to improve performance for conversation counting
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- Update RLS policies to ensure proper access
DROP POLICY IF EXISTS "Users can SELECT their conversations" ON conversations;
CREATE POLICY "Users can SELECT their conversations"
  ON conversations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can INSERT their conversations" ON conversations;
CREATE POLICY "Users can INSERT their conversations"
  ON conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can UPDATE their conversations" ON conversations;
CREATE POLICY "Users can UPDATE their conversations"
  ON conversations
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can DELETE their conversations" ON conversations;
CREATE POLICY "Users can DELETE their conversations"
  ON conversations
  FOR DELETE
  USING (auth.uid() = user_id);