-- Update the chat webhook URL to use n8n instead of Zapier
UPDATE webhook_config 
SET url = 'https://mantooq.app.n8n.cloud/webhook-test/1705f38d-c9ce-4c62-b5b7-f757497ad881',
    updated_at = now()
WHERE name = 'n8n_chat_webhook';