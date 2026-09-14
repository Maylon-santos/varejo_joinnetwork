CREATE TABLE cadastro_filiais (
 filial bigint PRIMARY KEY CHECK(filial>=0),
 cod_filial text NOT NULL CHECK(length(cod_filial) BETWEEN 1 AND 200),
 trans_id bigint NOT NULL CHECK(trans_id>=0),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sync_cadastro_filiais (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 cursor bigint CHECK(cursor>=0),
 escopo jsonb,
 ultimo_sucesso timestamptz,
 ultimo_erro_codigo text,
 falhas_consecutivas integer NOT NULL DEFAULT 0,
 proxima_tentativa timestamptz
);
INSERT INTO sync_cadastro_filiais(singleton) VALUES(true);
