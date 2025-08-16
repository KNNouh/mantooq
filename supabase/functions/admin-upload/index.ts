import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Create Supabase client with service role key
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseServiceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      supabaseServiceRoleKey
    )

    // Check if user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Get user from auth header
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Check if user has admin or super_admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin'])

    if (roleError || !roles || roles.length === 0) {
      return new Response('Forbidden: Admin or Super Admin access required', { status: 403, headers: corsHeaders })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response('No file provided', { status: 400, headers: corsHeaders })
    }

    console.log(`Processing file upload: ${file.name} (${file.size} bytes)`)

    // Generate unique file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${timestamp}-${sanitizedName}`

    // Upload file to kb-raw bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('kb-raw')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(`Upload failed: ${uploadError.message}`, { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    console.log('File uploaded successfully:', uploadData.path)

    // Calculate file hash (SHA-256 only, as MD5 is not supported by Web Crypto API)
    const fileBuffer = await file.arrayBuffer()
    const sha256Hash = await crypto.subtle.digest('SHA-256', fileBuffer)
    
    const sha256Hex = Array.from(new Uint8Array(sha256Hash))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    
    // Generate MD5-like hash using SHA-256 (truncated for compatibility)
    const md5Hex = sha256Hex.substring(0, 32)

    // Create kb_files record with basic information
    const { data: fileRecord, error: fileError } = await supabase
      .from('kb_files')
      .insert({
        filename: file.name,
        storage_path: uploadData.path,
        status: 'pending'
      })
      .select()
      .single()

    if (fileError) {
      console.error('File record creation error:', fileError)
      // Clean up uploaded file
      await supabase.storage.from('kb-raw').remove([uploadData.path])
      return new Response(`Database error: ${fileError.message}`, { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    console.log('File record created:', fileRecord.id)

    return new Response(JSON.stringify({
      success: true,
      file_id: fileRecord.id,
      message: 'File uploaded successfully. Use the Process button in File Management to start processing.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(`Server error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})