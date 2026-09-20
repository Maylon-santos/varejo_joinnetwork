CREATE TABLE reprocessamentos_venda (
 id uuid PRIMARY KEY,filial bigint NOT NULL,tipo_operacao text NOT NULL CHECK(tipo_operacao='S'),cod_operacao bigint NOT NULL,
 solicitado_por uuid NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),iniciado_em timestamptz,finalizado_em timestamptz,
 estado text NOT NULL DEFAULT 'pendente' CHECK(estado IN ('pendente','processando','concluido','falhou')),
 tentativas integer NOT NULL DEFAULT 0,erro_codigo text,resultado jsonb,antes jsonb,depois jsonb,
 FOREIGN KEY(cod_operacao,tipo_operacao,filial) REFERENCES operacoes(cod_operacao,tipo_operacao,filial)
);
CREATE UNIQUE INDEX reprocessamento_venda_ativo ON reprocessamentos_venda(filial,tipo_operacao,cod_operacao) WHERE estado IN ('pendente','processando');
CREATE INDEX reprocessamento_venda_ultimo ON reprocessamentos_venda(filial,tipo_operacao,cod_operacao,criado_em DESC);
CREATE INDEX reprocessamento_venda_fila ON reprocessamentos_venda(criado_em) WHERE estado IN ('pendente','processando');
