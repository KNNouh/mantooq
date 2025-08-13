-- Fix RLS policies for kb_files to work with user_roles table
DROP POLICY IF EXISTS "admin_all_files" ON public.kb_files;

-- Create new policy that checks user_roles table for admin access
CREATE POLICY "admin_all_files" ON public.kb_files
FOR ALL 
TO authenticated
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