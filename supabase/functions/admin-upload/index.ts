import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
}

// File validation function
function validateFile(file: File): { isValid: boolean; error?: string } {
  const maxSize = 100 * 1024 * 1024; // 100MB
  const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const allowedExtensions = /\.(pdf|txt|md|docx)$/i;

  if (file.size > maxSize) {
    return { isValid: false, error: 'File too large (max 100MB)' };
  }
  
  if (!allowedExtensions.test(file.name)) {
    return { isValid: false, error: 'Invalid file type. Only PDF, TXT, MD, and DOCX files are allowed' };
  }

  return { isValid: true };
}

// Sanitize filename
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 255);
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
      console.warn('Missing authorization header');
      return new Response(JSON.stringify({ error: 'Authentication required' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get user from auth header
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.warn('Authentication failed:', authError?.message);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Check if user has admin or super_admin role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin'])

    if (roleError || !roles || roles.length === 0) {
      console.warn('Insufficient permissions for user:', user.id);
      return new Response(JSON.stringify({ error: 'Admin access required' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    let formData;
    try {
      formData = await req.formData()
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid form data' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const file = formData.get('file') as File

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      return new Response(JSON.stringify({ error: validation.error }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`Processing file upload: ${file.name} (${file.size} bytes)`)

    // Generate unique file path with sanitized filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sanitizedName = sanitizeFilename(file.name)
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
      return new Response(JSON.stringify({ error: 'Upload failed' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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

    // Create kb_files record with all required information
    const { data: fileRecord, error: fileError } = await supabase
      .from('kb_files')
      .insert({
        filename: sanitizedName,
        storage_path: uploadData.path,
        file_size_bytes: file.size,
        status: 'pending'
      })
      .select()
      .single()

    if (fileError) {
      console.error('File record creation error:', fileError)
      // Clean up uploaded file
      await supabase.storage.from('kb-raw').remove([uploadData.path])
      return new Response(JSON.stringify({ error: 'Database error' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
    console.error('Function error:', error.message)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})