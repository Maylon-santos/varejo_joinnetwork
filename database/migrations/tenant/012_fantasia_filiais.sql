ALTER TABLE cadastro_filiais ADD COLUMN fantasia text CHECK (fantasia IS NULL OR length(fantasia) BETWEEN 1 AND 300);
-- Releitura cadastral única para preencher Fantasia, preservando todos os cursores.
UPDATE sync_cadastro_filiais SET escopo='[]'::jsonb,proxima_tentativa=now() WHERE singleton;
