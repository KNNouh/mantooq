-- Update the n8n chat webhook URL
UPDATE public.webhook_config 
SET url = 'https://n8n.srv1034943.hstgr.cloud/webhook/1705f38d-c9ce-4c62-b5b7-f757497ad881',
    updated_at = now()
WHERE name = 'n8n_chat_webhook';

-- If the record doesn't exist, insert it
INSERT INTO public.webhook_config (name, url, is_active)
VALUES ('n8n_chat_webhook', 'https://n8n.srv1034943.hstgr.cloud/webhook/1705f38d-c9ce-4c62-b5b7-f757497ad881', true)
ON CONFLICT (name) DO UPDATE 
SET url = EXCLUDED.url, 
    updated_at = now();