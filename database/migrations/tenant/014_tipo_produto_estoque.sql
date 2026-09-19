ALTER TABLE estoque_atual ADD COLUMN tipo_prod text CHECK(length(tipo_prod) BETWEEN 1 AND 20);
-- Releitura integral para preencher o campo novo sem alterar os cursores de vendas.
UPDATE sync_estoques SET ultima_carga_completa=NULL,proxima_tentativa=now();
