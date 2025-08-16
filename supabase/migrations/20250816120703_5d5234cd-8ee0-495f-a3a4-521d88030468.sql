-- Add processing control columns to kb_files table
ALTER TABLE public.kb_files 
ADD COLUMN manual_processing_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN webhook_triggered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN webhook_response JSONB;

-- Create chat_webhook_log table for monitoring
CREATE TABLE public.chat_webhook_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    conversation_id UUID,
    message_content TEXT NOT NULL,
    webhook_triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    webhook_response JSONB,
    response_received_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'received', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on chat_webhook_log
ALTER TABLE public.chat_webhook_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access to chat logs
CREATE POLICY "admin_all_chat_logs" 
ON public.chat_webhook_log 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
));

-- Add index for better performance
CREATE INDEX idx_chat_webhook_log_user_id ON public.chat_webhook_log(user_id);
CREATE INDEX idx_chat_webhook_log_conversation_id ON public.chat_webhook_log(conversation_id);