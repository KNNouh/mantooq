-- Fix RLS policies for kb_files to work with user_roles table
DROP POLICY IF EXISTS "admin_all_files" ON public.kb_files;
DROP POLICY IF EXISTS "public_read_files" ON public.kb_files;

-- Create new policies that work with the user_roles table
CREATE POLICY "admin_all_kb_files" ON public.kb_files
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "public_read_active_kb_files" ON public.kb_files
FOR SELECT USING (status = 'active');

-- Also fix documents table policies
DROP POLICY IF EXISTS "admin_all_documents" ON public.documents;

CREATE POLICY "admin_all_documents" ON public.documents
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);