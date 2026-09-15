ALTER TABLE operacoes ADD COLUMN clientes_identidade_importada boolean NOT NULL DEFAULT false;
CREATE INDEX operacoes_clientes_pendentes ON operacoes(filial,data_operacao DESC) WHERE NOT clientes_identidade_importada;
ALTER TABLE sync_status DROP CONSTRAINT sync_status_recurso_check;
ALTER TABLE sync_status ADD CHECK(recurso IN ('vendas','cancelamentos','complementos','clientes'));
