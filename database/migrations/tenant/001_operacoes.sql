CREATE TABLE tenant_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  tenant_key text NOT NULL UNIQUE
);
CREATE TABLE operacoes (
  cod_operacao bigint NOT NULL CHECK (cod_operacao >= 0),
  tipo_operacao text NOT NULL CHECK (tipo_operacao ~ '^[A-Z]+$'),
  filial bigint NOT NULL CHECK (filial >= 0),
  data_operacao date NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade >= 0),
  valor_final_centavos bigint NOT NULL,
  cancelada boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cod_operacao, tipo_operacao, filial)
);
CREATE TABLE cancelamentos (
  cod_operacao bigint NOT NULL,
  tipo_operacao text NOT NULL CHECK (tipo_operacao ~ '^[A-Z]+$'),
  filial bigint NOT NULL,
  data_cancelou timestamptz NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cod_operacao, tipo_operacao, filial)
);
CREATE INDEX operacoes_filial_data ON operacoes (filial, data_operacao);
CREATE INDEX cancelamentos_filial_data ON cancelamentos (filial, data_cancelou);
CREATE TABLE sync_checkpoints (
  filial bigint NOT NULL,
  recurso text NOT NULL CHECK (recurso IN ('cancelamentos')),
  ate date NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (filial, recurso)
);
-- Sem cache nessa etapa: cancelar uma operação afeta a leitura imediatamente.
CREATE VIEW operacoes_ativas AS
SELECT o.* FROM operacoes o
WHERE NOT o.cancelada AND NOT EXISTS (
  SELECT 1 FROM cancelamentos c
  WHERE c.cod_operacao=o.cod_operacao
    AND c.tipo_operacao=o.tipo_operacao AND c.filial=o.filial
);
