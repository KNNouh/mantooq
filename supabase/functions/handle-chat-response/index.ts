const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
}

// Input validation function
function validateInput(userId: string, conversationId: string, response: string): { isValid: boolean; error?: string } {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!userId || !uuidRegex.test(userId)) {
    return { isValid: false, error: 'Invalid userId format' };
  }
  if (!conversationId || !uuidRegex.test(conversationId)) {
    return { isValid: false, error: 'Invalid conversationId format' };
  }
  if (!response || typeof response !== 'string') {
    return { isValid: false, error: 'Response is required and must be a string' };
  }
  if (response.length > 50000) {
    return { isValid: false, error: 'Response too long (max 50000 characters)' };
  }
  return { isValid: true };
}

// Sanitize response content
function sanitizeResponse(response: string): string {
  return response.trim();
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
    const startTime = Date.now();
    console.log('🎯 n8n callback received at:', new Date().toISOString());
    console.log('📋 Request headers:', Object.fromEntries(req.headers.entries()));
    
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    let requestBody;
    try {
      const rawBody = await req.text();
      console.log('📨 Raw request body:', rawBody.slice(0, 500) + (rawBody.length > 500 ? '...' : ''));
      requestBody = JSON.parse(rawBody);
    } catch (e) {
      console.error('❌ JSON parsing error:', e.message);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId, conversationId, response, logId } = requestBody;
    console.log('🔍 Callback payload:', { 
      userId, 
      conversationId, 
      logId, 
      responseLength: response?.length || 0,
      responsePreview: response?.slice(0, 100) || 'No response'
    });
    
    const validation = validateInput(userId, conversationId, response);
    if (!validation.isValid) {
      console.error('❌ Validation failed:', validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Processing n8n callback for user:', userId, 'conversation:', conversationId);

    // Verify the conversation belongs to the user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      console.warn('Invalid conversation or user:', convError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid conversation or user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize the response
    const sanitizedResponse = sanitizeResponse(response);

    // Add the assistant's response to the conversation
    console.log('💾 Inserting message into database...');
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: sanitizedResponse
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Error adding assistant message:', messageError);
      return new Response(
        JSON.stringify({ error: 'Failed to save assistant response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Message inserted successfully:', messageData.id);

    // Update the chat webhook log if logId is provided
    if (logId && typeof logId === 'string') {
      const logUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (logUuidRegex.test(logId)) {
        console.log('📝 Updating webhook log:', logId);
        const { error: logError } = await supabase
          .from('chat_webhook_log')
          .update({
            status: 'received',
            response_received_at: new Date().toISOString()
          })
          .eq('id', logId);
          
        if (logError) {
          console.error('⚠️ Error updating webhook log:', logError);
        } else {
          console.log('✅ Webhook log updated successfully');
        }
      }
    } else {
      console.log('⚠️ No valid logId provided for webhook tracking');
    }

    const processingTime = Date.now() - startTime;
    console.log(`🎉 n8n callback completed successfully in ${processingTime}ms`);
    console.log('📤 Response will trigger real-time subscription for user:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assistant response saved successfully',
        conversationId: conversationId,
        messageId: messageData.id,
        processingTime: processingTime
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error in n8n callback:', error.message);
    console.error('📊 Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        errorDetails: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});