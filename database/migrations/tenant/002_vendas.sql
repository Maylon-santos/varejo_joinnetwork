ALTER TABLE sync_checkpoints DROP CONSTRAINT sync_checkpoints_recurso_check;
ALTER TABLE sync_checkpoints ADD CHECK (recurso IN ('cancelamentos','vendas'));
ALTER TABLE operacoes ADD COLUMN ajuste_centavos bigint;
ALTER TABLE operacoes ADD COLUMN subtotal_itens_centavos bigint;
ALTER TABLE operacoes ADD COLUMN conciliacao text NOT NULL DEFAULT 'pendente';
ALTER TABLE operacoes ADD COLUMN vendedor_codigo text;
ALTER TABLE operacoes ADD COLUMN vendedor_nome text;
ALTER TABLE operacoes ADD COLUMN evento_codigo text;
CREATE TABLE operacao_itens (
  cod_operacao bigint NOT NULL,
  tipo_operacao text NOT NULL,
  filial bigint NOT NULL,
  ordem integer NOT NULL,
  sku text,
  cod_produto text,
  descricao text,
  quantidade integer NOT NULL CHECK(quantidade > 0),
  preco_centavos bigint NOT NULL,
  PRIMARY KEY(cod_operacao,tipo_operacao,filial,ordem),
  FOREIGN KEY(cod_operacao,tipo_operacao,filial) REFERENCES operacoes(cod_operacao,tipo_operacao,filial)
);
CREATE TABLE sync_status (
  recurso text NOT NULL CHECK(recurso IN ('vendas','cancelamentos')),
  filial bigint NOT NULL,
  falhas_consecutivas integer NOT NULL DEFAULT 0,
  ultimo_sucesso timestamptz,
  ultimo_erro_codigo text,
  proxima_tentativa timestamptz,
  PRIMARY KEY(recurso,filial)
);
CREATE OR REPLACE VIEW operacoes_ativas AS
SELECT o.* FROM operacoes o
WHERE NOT o.cancelada AND NOT EXISTS (
  SELECT 1 FROM cancelamentos c
  WHERE c.cod_operacao=o.cod_operacao
    AND c.tipo_operacao=o.tipo_operacao AND c.filial=o.filial
);
