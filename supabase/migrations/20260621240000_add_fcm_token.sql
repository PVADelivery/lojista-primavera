-- Migration para adicionar fcm_token nas tabelas de usuários

ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Atualizar metadados para garantir sync
NOTIFY pgrst, 'reload schema';
