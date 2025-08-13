import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
// Import PDF.js for PDF text extraction
import { getDocument } from 'https://cdn.skypack.dev/pdfjs-dist@4.0.379/legacy/build/pdf';

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

  let requestBody: any;
  try {
    requestBody = await req.json();
  } catch (error) {
    console.error('Error parsing request body:', error);
    return new Response(JSON.stringify({ 
      error: 'Invalid request body',
      success: false 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { fileId } = requestBody;
  
  if (!fileId) {
    return new Response(JSON.stringify({ 
      error: 'File ID is required',
      success: false 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

    // Update file status to failed using the fileId from requestBody
    try {
      if (requestBody?.fileId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        console.log('Updating file status to failed for:', requestBody.fileId);
        await supabase
          .from('kb_files')
          .update({ status: 'failed' })
          .eq('id', requestBody.fileId);
        
        console.log('File status updated to failed successfully');
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
  console.log('Extracting text from file:', filename, 'extension:', extension);
  
  switch (extension) {
    case 'txt':
    case 'md':
      console.log('Processing as text file');
      return await file.text();
    
    case 'pdf':
      console.log('Processing PDF file');
      return await extractTextFromPDF(file);
    
    case 'docx':
      console.log('Processing DOCX file');
      return await extractTextFromDOCX(file);
    
    default:
      console.log('Processing as default text file');
      // Try to read as text
      return await file.text();
  }
}

async function extractTextFromPDF(file: Blob): Promise<string> {
  try {
    console.log('Starting PDF text extraction, file size:', file.size);
    
    // Convert blob to array buffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log('PDF file loaded, attempting to parse...');
    
    // Use PDF.js to extract text
    const pdf = await getDocument({ data: uint8Array }).promise;
    console.log('PDF parsed successfully, pages:', pdf.numPages);
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Processing page ${i}/${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item: any) => item.str)
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    console.log('PDF text extraction completed, total length:', fullText.length);
    
    if (fullText.trim().length === 0) {
      throw new Error('No text content found in PDF. The PDF might be image-based or corrupted.');
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

async function extractTextFromDOCX(file: Blob): Promise<string> {
  try {
    console.log('Starting DOCX text extraction...');
    
    // For now, we'll provide a basic implementation
    // In a production environment, you'd want to use a proper DOCX parser
    const text = await file.text();
    
    // Simple text extraction - this is very basic and won't work for binary DOCX files
    // This is just a placeholder until a proper DOCX parser is implemented
    if (text.includes('PK')) {
      // This looks like a ZIP/DOCX file
      throw new Error('DOCX processing requires a proper parser. Please convert to text file for now.');
    }
    
    return text;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
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
