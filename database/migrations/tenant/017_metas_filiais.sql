CREATE TABLE metas_filiais (
 filial bigint NOT NULL,competencia date NOT NULL CHECK(extract(day FROM competencia)=1),
 valor_centavos bigint CHECK(valor_centavos>=0),versao integer NOT NULL DEFAULT 1 CHECK(versao>0),
 atualizado_por uuid NOT NULL,atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(filial,competencia)
);
CREATE TABLE metas_filiais_historico (
 requisicao uuid PRIMARY KEY,filial bigint NOT NULL,competencia date NOT NULL,ator_id uuid NOT NULL,
 valor_solicitado_centavos bigint,versao_esperada integer NOT NULL,antes jsonb,depois jsonb NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(filial,competencia) REFERENCES metas_filiais(filial,competencia)
);
CREATE INDEX metas_historico_filial_mes ON metas_filiais_historico(filial,competencia,criado_em DESC);
