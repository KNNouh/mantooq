import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingMetrics {
  startTime: number;
  fileId: string;
  fileName: string;
  fileSize: number;
  stage: string;
  progress: number;
}

interface ChunkResult {
  content: string;
  metadata: any;
  embedding: number[];
  tokenCount: number;
  chunkIndex: number;
  processingTimeMs: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const metrics: ProcessingMetrics = {
    startTime: Date.now(),
    fileId: '',
    fileName: '',
    fileSize: 0,
    stage: 'initialization',
    progress: 0
  };

  let supabase: any;

  try {
    const requestBody = await req.json();
    const { fileId } = requestBody;
    
    if (!fileId) {
      throw new Error('File ID is required');
    }

    metrics.fileId = fileId;

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🚀 Starting enhanced processing for file: ${fileId}`);

    // Stage 1: Validation
    await updateProgress(supabase, fileId, 'validation', 'started', 'Validating file for processing');
    
    const { data: fileData, error: fileError } = await supabase
      .from('kb_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !fileData) {
      throw new Error('File not found');
    }

    metrics.fileName = fileData.filename;
    metrics.fileSize = fileData.file_size_bytes || 0;

    // Validate file using our new validation function
    const { data: validationResult } = await supabase.rpc('validate_file_for_processing', { p_file_id: fileId });
    
    if (validationResult && validationResult.length > 0 && !validationResult[0].is_valid) {
      throw new Error(`File validation failed: ${validationResult[0].error_message}`);
    }

    await updateProgress(supabase, fileId, 'validation', 'completed', 'File validation passed');

    // Stage 2: File Download and Text Extraction
    await updateProgress(supabase, fileId, 'extraction', 'started', 'Starting text extraction');
    
    const extractionStartTime = Date.now();
    
    const { data: fileContent, error: downloadError } = await supabase.storage
      .from('kb-raw')
      .download(fileData.storage_path);

    if (downloadError || !fileContent) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }

    // Enhanced text extraction with better error handling
    const extractedText = await extractTextFromFile(fileContent, fileData.filename);
    const extractionTime = Date.now() - extractionStartTime;
    
    console.log(`📄 Text extraction completed in ${extractionTime}ms, length: ${extractedText.length}`);
    
    await updateProgress(supabase, fileId, 'extraction', 'completed', 
      `Extracted ${extractedText.length} characters`, 
      { extraction_time_ms: extractionTime, text_length: extractedText.length }
    );

    // Stage 3: Smart Chunking with Token Awareness
    await updateProgress(supabase, fileId, 'chunking', 'started', 'Creating intelligent chunks');
    
    const chunkingStartTime = Date.now();
    const chunks = await createIntelligentChunks(extractedText, fileData.filename);
    const chunkingTime = Date.now() - chunkingStartTime;
    
    console.log(`🧩 Created ${chunks.length} chunks in ${chunkingTime}ms`);
    
    await updateProgress(supabase, fileId, 'chunking', 'completed', 
      `Created ${chunks.length} chunks`, 
      { chunking_time_ms: chunkingTime, total_chunks: chunks.length }
    );

    // Update file record with chunk count
    await supabase
      .from('kb_files')
      .update({ 
        total_chunks: chunks.length,
        file_size_bytes: fileContent.size 
      })
      .eq('id', fileId);

    // Stage 4: Embedding Generation with Batch Processing
    await updateProgress(supabase, fileId, 'embedding', 'started', 'Generating embeddings with batching');
    
    const batchSize = 5; // Smaller batches for better reliability
    const embeddingResults: ChunkResult[] = [];
    let processedChunks = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
      
      try {
        const batchStartTime = Date.now();
        const batchResults = await processBatch(batch, i, openaiApiKey, fileId);
        const batchTime = Date.now() - batchStartTime;
        
        embeddingResults.push(...batchResults);
        processedChunks += batch.length;
        
        console.log(`✅ Batch completed in ${batchTime}ms. Progress: ${processedChunks}/${chunks.length}`);
        
        await updateProgress(supabase, fileId, 'embedding', 'processing', 
          `Generated embeddings for ${processedChunks}/${chunks.length} chunks`,
          { processed_chunks: processedChunks, total_chunks: chunks.length }
        );

        // Update file progress
        await supabase
          .from('kb_files')
          .update({ processed_chunks: processedChunks })
          .eq('id', fileId);

        // Rate limiting delay between batches
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (batchError) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, batchError);
        
        // Try individual processing for failed batch
        for (let j = 0; j < batch.length; j++) {
          try {
            const singleResult = await processBatch([batch[j]], i + j, openaiApiKey, fileId);
            embeddingResults.push(...singleResult);
            processedChunks++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (singleError) {
            console.error(`❌ Individual chunk ${i + j} failed:`, singleError);
            // Continue with other chunks rather than failing completely
          }
        }
      }
    }

    await updateProgress(supabase, fileId, 'embedding', 'completed', 
      `Generated ${embeddingResults.length} embeddings successfully`
    );

    // Stage 5: Database Storage with Deduplication
    await updateProgress(supabase, fileId, 'storage', 'started', 'Storing chunks in database');
    
    const storageStartTime = Date.now();
    
    // Store in smaller batches to avoid database timeouts
    const dbBatchSize = 10;
    let storedChunks = 0;
    
    for (let i = 0; i < embeddingResults.length; i += dbBatchSize) {
      const dbBatch = embeddingResults.slice(i, i + dbBatchSize);
      
      const { error: insertError } = await supabase
        .from('documents')
        .insert(dbBatch.map(result => ({
          content: result.content,
          metadata: result.metadata,
          embedding: result.embedding,
          file_id: fileId,
          chunk_index: result.chunkIndex,
          processing_time_ms: result.processingTimeMs,
          token_count: result.tokenCount,
          chunk_source: getFileExtension(fileData.filename)
        })));

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        throw new Error(`Failed to store chunks: ${insertError.message}`);
      }
      
      storedChunks += dbBatch.length;
      console.log(`💾 Stored ${storedChunks}/${embeddingResults.length} chunks`);
    }
    
    const storageTime = Date.now() - storageStartTime;
    
    await updateProgress(supabase, fileId, 'storage', 'completed', 
      `Successfully stored ${storedChunks} chunks`,
      { storage_time_ms: storageTime, stored_chunks: storedChunks }
    );

    // Final status update
    await supabase
      .from('kb_files')
      .update({ 
        status: 'active',
        processing_completed_at: new Date().toISOString(),
        processed_chunks: storedChunks
      })
      .eq('id', fileId);

    const totalTime = Date.now() - metrics.startTime;
    console.log(`🎉 Processing completed successfully in ${totalTime}ms`);

    return new Response(JSON.stringify({ 
      success: true, 
      fileId,
      stats: {
        totalChunks: chunks.length,
        successfulEmbeddings: embeddingResults.length,
        storedChunks,
        totalProcessingTimeMs: totalTime,
        extractionTimeMs: extractionTime,
        chunkingTimeMs: chunkingTime,
        storageTimeMs: storageTime
      },
      message: `Successfully processed ${fileData.filename} with ${storedChunks} chunks`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Processing failed:', error);
    
    // Detailed error logging
    if (supabase && metrics.fileId) {
      try {
        await updateProgress(supabase, metrics.fileId, metrics.stage, 'failed', 
          error.message,
          { 
            error_details: error.stack,
            processing_time_ms: Date.now() - metrics.startTime,
            stage_when_failed: metrics.stage
          }
        );
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      fileId: metrics.fileId,
      failedAtStage: metrics.stage,
      processingTimeMs: Date.now() - metrics.startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function updateProgress(
  supabase: any, 
  fileId: string, 
  stage: string, 
  status: string, 
  message: string, 
  metadata: any = {}
) {
  try {
    await supabase.rpc('update_processing_progress', {
      p_file_id: fileId,
      p_stage: stage,
      p_status: status,
      p_message: message,
      p_metadata: metadata
    });
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

async function extractTextFromFile(file: Blob, filename: string): Promise<string> {
  const extension = getFileExtension(filename);
  console.log(`📄 Extracting text from ${extension.toUpperCase()} file: ${filename}`);
  
  switch (extension) {
    case 'txt':
    case 'md':
      return await file.text();
    
    case 'pdf':
      return await extractTextFromPDF(file);
    
    case 'docx':
      throw new Error('DOCX processing not yet implemented. Please convert to PDF or TXT.');
    
    default:
      // Try as text file
      const text = await file.text();
      if (text.length < 10) {
        throw new Error(`Unsupported file type: ${extension}. Please use PDF, TXT, or MD files.`);
      }
      return text;
  }
}

async function extractTextFromPDF(file: Blob): Promise<string> {
  console.log(`📄 Processing PDF file (${Math.round(file.size / 1024)}KB)`);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to string using UTF-8 for better text handling
    const pdfString = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
    
    let extractedText = '';
    
    // Method 1: Look for text objects with proper handling
    const textPattern = /BT\s+(.*?)\s+ET/gs;
    const textBlocks = pdfString.match(textPattern);
    
    if (textBlocks) {
      for (const block of textBlocks) {
        // Look for text strings in parentheses that are followed by text operators
        const textStrings = block.match(/\(([^)]*)\)\s*(?:Tj|TJ)/g);
        if (textStrings) {
          for (const textString of textStrings) {
            const match = textString.match(/\(([^)]*)\)/);
            if (match && match[1]) {
              let text = match[1]
                .replace(/\\n/g, ' ')
                .replace(/\\r/g, ' ')
                .replace(/\\t/g, ' ')
                .replace(/\\\(/g, '(')
                .replace(/\\\)/g, ')')
                .replace(/\\\\/g, '\\');
              
              // Only add text that contains readable characters
              if (text.length > 1 && /[a-zA-Z0-9\s]/.test(text)) {
                extractedText += text + ' ';
              }
            }
          }
        }
      }
    }
    
    // Method 2: Look for readable text in streams
    if (extractedText.length < 100) {
      console.log('📄 Trying alternative extraction method...');
      
      // Look for stream content that might contain text
      const streamPattern = /stream\s+(.*?)\s+endstream/gs;
      const streams = pdfString.match(streamPattern);
      
      if (streams) {
        for (const stream of streams) {
          const content = stream.replace(/^stream\s+/, '').replace(/\s+endstream$/, '');
          
          // Try to find readable text sequences
          const readableMatches = content.match(/[A-Za-z][A-Za-z0-9\s.,!?;:'"()-]{5,}/g);
          if (readableMatches) {
            const validText = readableMatches
              .filter(text => text.length > 5)
              .join(' ');
            
            if (validText.length > extractedText.length) {
              extractedText = validText;
            }
          }
        }
      }
    }
    
    // Method 3: Simple pattern matching for readable text
    if (extractedText.length < 50) {
      console.log('📄 Using fallback text extraction...');
      
      // Look for sequences of readable characters
      const readableSequences = pdfString.match(/[A-Za-z][A-Za-z0-9\s.,!?;:'"()-]{10,}/g);
      if (readableSequences && readableSequences.length > 0) {
        extractedText = readableSequences
          .filter(seq => seq.length > 10)
          .slice(0, 20) // Take first 20 sequences to avoid too much noise
          .join(' ');
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:()\-"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`📄 PDF extraction completed: ${extractedText.length} characters`);
    
    if (extractedText.length < 30) {
      throw new Error(`PDF text extraction failed. Only extracted ${extractedText.length} readable characters. This PDF may be image-based, encrypted, or have complex formatting. Please try converting it to a text file or ensure it contains selectable text.`);
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`PDF extraction failed: ${error.message}. Please try converting the PDF to a text file.`);
  }
}

async function createIntelligentChunks(text: string, filename: string): Promise<string[]> {
  const maxChunkSize = 800; // Reduced to be safer with token limits
  const overlapSize = 100;
  const chunks: string[] = [];
  
  // If text is short enough, return as single chunk
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  // Split into sentences first
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 3);
  
  if (sentences.length === 0) {
    // Fallback: split by character limit
    for (let i = 0; i < text.length; i += maxChunkSize - overlapSize) {
      chunks.push(text.slice(i, i + maxChunkSize));
    }
    return chunks;
  }
  
  let currentChunk = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i] + '.';
    
    // Check if adding this sentence would exceed the limit
    if ((currentChunk + ' ' + sentence).length > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlapSize / 6)); // Approximate word overlap
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  // Add the final chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  // Safety check: ensure no chunk exceeds the limit
  const validChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChunkSize) {
      validChunks.push(chunk);
    } else {
      // Split oversized chunks
      for (let i = 0; i < chunk.length; i += maxChunkSize - overlapSize) {
        validChunks.push(chunk.slice(i, i + maxChunkSize));
      }
    }
  }
  
  console.log(`🧩 Created ${validChunks.length} intelligent chunks (max size: ${Math.max(...validChunks.map(c => c.length))}, avg size: ${Math.round(validChunks.reduce((sum, chunk) => sum + chunk.length, 0) / validChunks.length)})`);
  
  return validChunks;
}

async function processBatch(
  chunks: string[], 
  startIndex: number, 
  openaiApiKey: string, 
  fileId: string
): Promise<ChunkResult[]> {
  const results: ChunkResult[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkIndex = startIndex + i;
    const processingStart = Date.now();
    
    // More accurate token counting (approximately 1 token = 3.3 characters for English)
    const estimatedTokens = Math.ceil(chunk.length / 3.3);
    
    console.log(`🔍 Processing chunk ${chunkIndex}: ${chunk.length} chars, ~${estimatedTokens} tokens`);
    
    if (estimatedTokens > 7500) { // Keep well under 8192 limit
      console.warn(`⚠️ Chunk ${chunkIndex} has ${estimatedTokens} estimated tokens, truncating to ~7000 tokens...`);
      const safeLength = Math.floor(7000 * 3.3); // ~7000 tokens worth of characters
      const truncatedChunk = chunk.slice(0, safeLength);
      
      try {
        const embedding = await generateEmbedding(truncatedChunk, openaiApiKey);
        
        results.push({
          content: truncatedChunk,
          metadata: {
            file_id: fileId,
            split_params: '800:100',
            norm: 'v2',
            chunk_index: chunkIndex,
            original_length: chunk.length,
            truncated: true,
            estimated_tokens: Math.ceil(truncatedChunk.length / 3.3)
          },
          embedding,
          tokenCount: Math.ceil(truncatedChunk.length / 3.3),
          chunkIndex,
          processingTimeMs: Date.now() - processingStart
        });
      } catch (error) {
        console.error(`❌ Failed to process truncated chunk ${chunkIndex}:`, error);
        throw error;
      }
    } else {
      try {
        const embedding = await generateEmbedding(chunk, openaiApiKey);
        
        results.push({
          content: chunk,
          metadata: {
            file_id: fileId,
            split_params: '800:100',
            norm: 'v2',
            chunk_index: chunkIndex,
            estimated_tokens: estimatedTokens
          },
          embedding,
          tokenCount: estimatedTokens,
          chunkIndex,
          processingTimeMs: Date.now() - processingStart
        });
      } catch (error) {
        console.error(`❌ Failed to process chunk ${chunkIndex}:`, error);
        throw error;
      }
    }
  }
  
  return results;
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
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

function getFileExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() || '';
}