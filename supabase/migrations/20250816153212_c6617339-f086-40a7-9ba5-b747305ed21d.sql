-- Enable RLS on processing_log table
ALTER TABLE public.processing_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for processing_log table
CREATE POLICY "admin_all_processing_logs" 
ON public.processing_log 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);