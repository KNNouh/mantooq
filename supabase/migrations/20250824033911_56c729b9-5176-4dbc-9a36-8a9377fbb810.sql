-- Fix RLS policies for kb_files table to work with user_roles system
DROP POLICY IF EXISTS admin_all_files ON public.kb_files;

CREATE POLICY admin_all_files ON public.kb_files
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);