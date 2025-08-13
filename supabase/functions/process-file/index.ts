import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChunkData {
  content: string;
  metadata: {
    file_id: string;
    split_params: string;
    norm: string;
    chunk_index: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId } = await req.json();
    
    if (!fileId) {
      throw new Error('File ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing file:', fileId);

    // Update file status to processing
    await supabase
      .from('kb_files')
      .update({ status: 'processing' })
      .eq('id', fileId);

    // Get file information
    const { data: fileData, error: fileError } = await supabase
      .from('kb_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !fileData) {
      throw new Error('File not found');
    }

    console.log('Found file:', fileData.filename);

    // Download file from storage
    const { data: fileContent, error: downloadError } = await supabase.storage
      .from('kb-raw')
      .download(fileData.storage_path);

    if (downloadError || !fileContent) {
      throw new Error('Failed to download file');
    }

    // Extract text content
    const text = await extractTextFromFile(fileContent, fileData.filename);
    console.log('Extracted text length:', text.length);

    // Split text into chunks
    const chunks = splitTextIntoChunks(text, 900, 120); // chunk_size: 900, overlap: 120
    console.log('Created chunks:', chunks.length);

    // Process chunks in batches to avoid rate limits
    const batchSize = 10;
    let processedChunks = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      // Generate embeddings for batch
      const embeddingPromises = batch.map(async (chunk, batchIndex) => {
        const chunkData: ChunkData = {
          content: chunk,
          metadata: {
            file_id: fileId,
            split_params: '900:120',
            norm: 'v1',
            chunk_index: i + batchIndex
          }
        };

        // Generate embedding
        const embedding = await generateEmbedding(chunk, openaiApiKey);
        
        return {
          content: chunk,
          metadata: chunkData.metadata,
          embedding
        };
      });

      const batchResults = await Promise.all(embeddingPromises);

      // Insert batch into database
      const { error: insertError } = await supabase
        .from('documents')
        .insert(batchResults);

      if (insertError) {
        console.error('Error inserting batch:', insertError);
        throw insertError;
      }

      processedChunks += batch.length;
      console.log(`Processed ${processedChunks}/${chunks.length} chunks`);

      // Small delay to respect rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update file status to active
    await supabase
      .from('kb_files')
      .update({ status: 'active' })
      .eq('id', fileId);

    console.log('File processing completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      chunksProcessed: processedChunks,
      message: 'File processed and embeddings created successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing file:', error);

    // Try to update file status to failed if we have the fileId
    try {
      const { fileId } = await req.json();
      if (fileId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('kb_files')
          .update({ status: 'failed' })
          .eq('id', fileId);
      }
    } catch (updateError) {
      console.error('Error updating file status to failed:', updateError);
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function extractTextFromFile(file: Blob, filename: string): Promise<string> {
  const extension = filename.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'txt':
    case 'md':
      return await file.text();
    
    case 'pdf':
      // For PDF files, we'll need to implement PDF text extraction
      // For now, we'll throw an error suggesting manual text extraction
      throw new Error('PDF processing not yet implemented. Please convert to text file.');
    
    case 'docx':
      // For DOCX files, we'll need to implement DOCX text extraction
      throw new Error('DOCX processing not yet implemented. Please convert to text file.');
    
    default:
      // Try to read as text
      return await file.text();
  }
}

function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  let currentSize = 0;
  
  for (const sentence of sentences) {
    const sentenceLength = sentence.trim().length;
    
    if (currentSize + sentenceLength > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Create overlap by keeping last part of previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 10)); // Approximate overlap
      currentChunk = overlapWords.join(' ') + ' ' + sentence.trim();
      currentSize = currentChunk.length;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
      currentSize = currentChunk.length;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}
