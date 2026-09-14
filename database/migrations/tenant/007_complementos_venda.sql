ALTER TABLE operacoes ADD COLUMN complementos jsonb CHECK(complementos IS NULL OR jsonb_typeof(complementos)='object');
ALTER TABLE operacoes ADD COLUMN complementos_importados_em timestamptz;
ALTER TABLE operacao_itens ADD COLUMN preco_tabela_centavos bigint;
ALTER TABLE operacao_itens ADD COLUMN desconto_informado numeric;
ALTER TABLE operacao_itens ADD COLUMN preco_aplicado_centavos bigint;
ALTER TABLE sync_status DROP CONSTRAINT sync_status_recurso_check;
ALTER TABLE sync_status ADD CHECK(recurso IN ('vendas','cancelamentos','complementos'));
CREATE INDEX operacoes_complementos_pendentes ON operacoes(filial,data_operacao DESC) WHERE complementos IS NULL;
