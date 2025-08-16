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

    const { userId, conversationId, response, logId } = await req.json();

    if (!userId || !conversationId || !response) {
      return new Response(
        JSON.stringify({ error: 'userId, conversationId, and response are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Handling chat response from n8n for user:', userId, 'conversation:', conversationId);

    // Verify the conversation belongs to the user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: 'Invalid conversation or user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add the assistant's response to the conversation
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: response
      });

    if (messageError) {
      console.error('Error adding assistant message:', messageError);
      return new Response(
        JSON.stringify({ error: 'Failed to save assistant response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the chat webhook log if logId is provided
    if (logId) {
      await supabase
        .from('chat_webhook_log')
        .update({
          status: 'received',
          response_received_at: new Date().toISOString()
        })
        .eq('id', logId);
    }

    console.log('Assistant response saved successfully for conversation:', conversationId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assistant response saved successfully',
        conversationId: conversationId
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