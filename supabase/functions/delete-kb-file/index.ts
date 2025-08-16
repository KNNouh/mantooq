const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin privileges
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some(r => ['admin', 'super_admin'].includes(r.role));
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileId } = await req.json();

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: 'File ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Deleting file:', fileId);

    // Get file details before deletion
    const { data: file, error: fileError } = await supabase
      .from('kb_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      return new Response(
        JSON.stringify({ error: 'File not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete related records first (documents, processing_log)
    console.log('Deleting related documents...');
    const { error: documentsError } = await supabase
      .from('documents')
      .delete()
      .eq('file_id', fileId);

    if (documentsError) {
      console.error('Error deleting documents:', documentsError);
    }

    console.log('Deleting processing logs...');
    const { error: logsError } = await supabase
      .from('processing_log')
      .delete()
      .eq('file_id', fileId);

    if (logsError) {
      console.error('Error deleting processing logs:', logsError);
    }

    // Delete file from storage
    console.log('Deleting file from storage:', file.storage_path);
    const { error: storageError } = await supabase.storage
      .from('kb-raw')
      .remove([file.storage_path]);

    if (storageError) {
      console.error('Error deleting from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete file record from database
    console.log('Deleting file record from database...');
    const { error: deleteError } = await supabase
      .from('kb_files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      console.error('Error deleting file record:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete file record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('File deleted successfully:', fileId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'File deleted successfully',
        fileId: fileId,
        filename: file.filename
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});