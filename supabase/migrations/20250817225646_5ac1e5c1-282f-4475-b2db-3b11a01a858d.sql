-- Add explicit policy to deny anonymous access to messages
-- This ensures that only authenticated users can access messages
-- and prevents any potential data exposure to anonymous users

-- Create a restrictive policy for anonymous users (this will block all anonymous access)
CREATE POLICY "Block anonymous access to messages" 
ON public.messages 
FOR ALL 
TO anon
USING (false);