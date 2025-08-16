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

    // Get file details
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

    // Update file status to indicate manual processing requested
    const { error: updateError } = await supabase
      .from('kb_files')
      .update({ 
        manual_processing_requested: true,
        webhook_triggered_at: new Date().toISOString(),
        status: 'processing'
      })
      .eq('id', fileId);

    if (updateError) {
      console.error('Error updating file status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update file status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare webhook payload for n8n
    const webhookPayload = {
      fileId: file.id,
      filename: file.filename,
      storagePath: file.storage_path,
      fileSize: file.file_size_bytes,
      requestedBy: user.id,
      timestamp: new Date().toISOString(),
      supabaseUrl: supabaseUrl,
      bucketName: 'kb-raw'
    };

    console.log('Triggering n8n webhook for file processing:', webhookPayload);

    // Send webhook to n8n
    const webhookUrl = 'https://mantooq.app.n8n.cloud/webhook-test/c5aeeb2d-8cae-449d-899c-48b145969c1d';
    
    // Build query parameters for GET request
    const queryParams = new URLSearchParams({
      fileId: webhookPayload.fileId,
      filename: webhookPayload.filename,
      storagePath: webhookPayload.storagePath,
      fileSize: webhookPayload.fileSize.toString(),
      requestedBy: webhookPayload.requestedBy,
      timestamp: webhookPayload.timestamp,
      supabaseUrl: webhookPayload.supabaseUrl,
      bucketName: webhookPayload.bucketName
    });
    
    try {
      const webhookResponse = await fetch(`${webhookUrl}?${queryParams.toString()}`, {
        method: 'GET',
      });

      const responseData = await webhookResponse.text();
      
      // Log webhook response
      await supabase
        .from('kb_files')
        .update({
          webhook_response: {
            status: webhookResponse.status,
            response: responseData,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', fileId);

      console.log('n8n webhook response:', {
        status: webhookResponse.status,
        response: responseData
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'File processing triggered successfully',
          fileId: fileId,
          webhookStatus: webhookResponse.status
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (webhookError) {
      console.error('Failed to trigger n8n webhook:', webhookError);
      
      // Update file status to failed
      await supabase
        .from('kb_files')
        .update({
          status: 'failed',
          error_message: `Webhook failed: ${webhookError.message}`
        })
        .eq('id', fileId);

      return new Response(
        JSON.stringify({
          error: 'Failed to trigger processing webhook',
          details: webhookError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});