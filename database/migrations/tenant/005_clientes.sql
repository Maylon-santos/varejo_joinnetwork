-- NULL = histórico ainda não importado; [] = ERP não informou cliente.
ALTER TABLE operacoes ADD COLUMN clientes jsonb CHECK (jsonb_typeof(clientes) = 'array');
ALTER TABLE operacoes ADD COLUMN clientes_importados_em timestamptz;
