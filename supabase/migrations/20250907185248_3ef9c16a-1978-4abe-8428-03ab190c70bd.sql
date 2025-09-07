-- Add RLS policies for kb_files table to enable proper stats display

-- Enable RLS on kb_files table
ALTER TABLE public.kb_files ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all kb_files for stats
CREATE POLICY "Admins can view all kb_files" 
ON public.kb_files 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role IN ('admin', 'super_admin')
));

-- Allow admins to manage kb_files (insert, update, delete)
CREATE POLICY "Admins can manage kb_files" 
ON public.kb_files 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role IN ('admin', 'super_admin')
));

-- Ensure documents table also has proper access for admins (for chunk counting)
-- Add policy to allow admins to view documents for stats
CREATE POLICY "Admins can view documents for stats" 
ON public.documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role IN ('admin', 'super_admin')
));