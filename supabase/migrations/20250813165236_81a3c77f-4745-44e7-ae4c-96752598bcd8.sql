-- Reset stuck files from processing to failed status
UPDATE kb_files SET status = 'failed' WHERE status = 'processing';