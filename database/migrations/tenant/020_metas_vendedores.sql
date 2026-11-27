CREATE TABLE metas_vendedores (
 filial bigint NOT NULL,vendedor_codigo text NOT NULL CHECK(length(vendedor_codigo) BETWEEN 1 AND 100),
 competencia date NOT NULL CHECK(extract(day FROM competencia)=1),
 valor_centavos bigint CHECK(valor_centavos>=0),pa_centesimos integer CHECK(pa_centesimos BETWEEN 0 AND 100000),
 ticket_centavos bigint CHECK(ticket_centavos>=0),funcao text CHECK(length(funcao)<=80),admissao date,
 versao integer NOT NULL DEFAULT 1 CHECK(versao>0),atualizado_por uuid NOT NULL,atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(filial,vendedor_codigo,competencia)
);
CREATE TABLE metas_vendedores_historico (
 requisicao uuid PRIMARY KEY,filial bigint NOT NULL,vendedor_codigo text NOT NULL,competencia date NOT NULL,
 ator_id uuid NOT NULL,pedido_hash text NOT NULL,antes jsonb,depois jsonb NOT NULL,criado_em timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(filial,vendedor_codigo,competencia) REFERENCES metas_vendedores(filial,vendedor_codigo,competencia)
);
CREATE INDEX metas_vendedores_historico_mes ON metas_vendedores_historico(filial,competencia,criado_em DESC);
