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

    const { message, conversationId } = await req.json();

    if (!message || !conversationId) {
      return new Response(
        JSON.stringify({ error: 'Message and conversation ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Triggering chat response for user:', user.id, 'conversation:', conversationId);

    // Prepare webhook payload for n8n
    const webhookPayload = {
      userId: user.id,
      userEmail: user.email,
      conversationId: conversationId,
      message: message,
      timestamp: new Date().toISOString(),
      supabaseUrl: supabaseUrl
    };

    // Log the webhook trigger
    const { data: logEntry, error: logError } = await supabase
      .from('chat_webhook_log')
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        message_content: message,
        status: 'sent'
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging webhook trigger:', logError);
    }

    console.log('Sending chat message to n8n:', webhookPayload);

    // Send webhook to n8n
    const webhookUrl = 'https://mantooq.app.n8n.cloud/webhook-test/1705f38d-c9ce-4c62-b5b7-f757497ad881';
    
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      const responseData = await webhookResponse.text();
      
      // Update log with webhook response
      if (logEntry) {
        await supabase
          .from('chat_webhook_log')
          .update({
            webhook_response: {
              status: webhookResponse.status,
              response: responseData,
              timestamp: new Date().toISOString()
            }
          })
          .eq('id', logEntry.id);
      }

      console.log('n8n chat webhook response:', {
        status: webhookResponse.status,
        response: responseData
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Chat message sent to n8n successfully',
          logId: logEntry?.id,
          webhookStatus: webhookResponse.status
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (webhookError) {
      console.error('Failed to trigger n8n chat webhook:', webhookError);
      
      // Update log with error
      if (logEntry) {
        await supabase
          .from('chat_webhook_log')
          .update({
            status: 'failed',
            error_message: webhookError.message
          })
          .eq('id', logEntry.id);
      }

      return new Response(
        JSON.stringify({
          error: 'Failed to send message to n8n',
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