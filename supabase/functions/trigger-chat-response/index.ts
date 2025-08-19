const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
}

// Input validation function
function validateInput(message: string, conversationId: string): { isValid: boolean; error?: string } {
  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Message is required and must be a string' };
  }
  if (message.length > 10000) {
    return { isValid: false, error: 'Message too long (max 10000 characters)' };
  }
  if (!conversationId || typeof conversationId !== 'string') {
    return { isValid: false, error: 'ConversationId is required and must be a string' };
  }
  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    return { isValid: false, error: 'Invalid conversationId format' };
  }
  return { isValid: true };
}

// Sanitize message content
function sanitizeMessage(message: string): string {
  return message.replace(/[<>]/g, '').trim();
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.warn('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, conversationId } = requestBody;
    const validation = validateInput(message, conversationId);
    if (!validation.isValid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize the message
    const sanitizedMessage = sanitizeMessage(message);

    console.log('Triggering chat response for user:', user.id, 'conversation:', conversationId);

    // Get webhook URL from configuration (secure approach)
    const { data: webhookConfig, error: configError } = await supabase
      .from('webhook_config')
      .select('url')
      .eq('name', 'n8n_chat_webhook')
      .eq('is_active', true)
      .single();

    if (configError || !webhookConfig) {
      console.error('Webhook configuration not found:', configError);
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare webhook payload for n8n
    const webhookPayload = {
      userId: user.id,
      userEmail: user.email,
      conversationId: conversationId,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
      supabaseUrl: supabaseUrl,
      responseCallbackUrl: `${supabaseUrl}/functions/v1/handle-chat-response`
    };

    // Log the webhook trigger (with sanitized data)
    const { data: logEntry, error: logError } = await supabase
      .from('chat_webhook_log')
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        message_content: sanitizedMessage,
        status: 'sent'
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging webhook trigger:', logError);
    }

    console.log('Sending chat message to n8n');

    // Send webhook to n8n asynchronously for better performance
    const webhookUrl = webhookConfig.url;
    
    // Return immediate response for better UX
    const sendWebhookAsync = async () => {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });

        const responseData = await webhookResponse.text();
        
        console.log('n8n chat webhook response status:', webhookResponse.status);

        // Update log with webhook response (don't log full response for security)
        if (logEntry) {
          await supabase
            .from('chat_webhook_log')
            .update({
              webhook_response: {
                status: webhookResponse.status,
                timestamp: new Date().toISOString()
              },
              status: webhookResponse.ok ? 'sent' : 'failed'
            })
            .eq('id', logEntry.id);
        }

      } catch (webhookError) {
        console.error('Failed to trigger n8n chat webhook:', webhookError.message);
        
        // Update log with error
        if (logEntry) {
          await supabase
            .from('chat_webhook_log')
            .update({
              status: 'failed',
              error_message: 'Webhook delivery failed'
            })
            .eq('id', logEntry.id);
        }
      }
    };

    // Start webhook processing in background
    sendWebhookAsync();

    // Return immediate success response for better UX
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Chat message processing started',
        logId: logEntry?.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});