CREATE TABLE fila_jornadas (
 filial bigint NOT NULL, dia date NOT NULL, estado text NOT NULL CHECK(estado IN ('aberta','fechada')),
 versao integer NOT NULL DEFAULT 1, aberta_em timestamptz NOT NULL, fechada_em timestamptz,
 PRIMARY KEY(filial,dia)
);
CREATE UNIQUE INDEX fila_jornada_aberta ON fila_jornadas(filial) WHERE estado='aberta';
CREATE TABLE fila_participantes (
 filial bigint NOT NULL,dia date NOT NULL,vendedor_codigo text NOT NULL CHECK(length(vendedor_codigo) BETWEEN 1 AND 100),
 nome text NOT NULL,posicao integer NOT NULL CHECK(posicao>0),
 estado text NOT NULL CHECK(estado IN ('disponivel','ocupado','pausa','ausente')),
 PRIMARY KEY(filial,dia,vendedor_codigo),FOREIGN KEY(filial,dia) REFERENCES fila_jornadas(filial,dia)
);
CREATE TABLE fila_atendimentos (
 id uuid PRIMARY KEY,filial bigint NOT NULL,dia date NOT NULL,vendedor_codigo text NOT NULL,
 modalidade text NOT NULL CHECK(modalidade IN ('vez','reservado')),
 abordado_em timestamptz NOT NULL,iniciado_em timestamptz,finalizado_em timestamptz,
 resultado text CHECK(resultado IN ('com_venda','sem_venda','nao_iniciado')),motivo text CHECK(length(motivo)<=300),
 FOREIGN KEY(filial,dia,vendedor_codigo) REFERENCES fila_participantes(filial,dia,vendedor_codigo),
 CHECK((finalizado_em IS NULL AND resultado IS NULL) OR (finalizado_em IS NOT NULL AND resultado IS NOT NULL)),
 CHECK(resultado IS DISTINCT FROM 'nao_iniciado' OR iniciado_em IS NULL),
 CHECK(resultado IS NULL OR resultado='nao_iniciado' OR iniciado_em IS NOT NULL),
 CHECK(iniciado_em IS NULL OR iniciado_em>=abordado_em),
 CHECK(finalizado_em IS NULL OR finalizado_em>=COALESCE(iniciado_em,abordado_em))
);
CREATE UNIQUE INDEX fila_um_atendimento_aberto ON fila_atendimentos(filial,vendedor_codigo) WHERE finalizado_em IS NULL;
CREATE INDEX fila_atendimentos_dia ON fila_atendimentos(filial,dia);
CREATE TABLE fila_eventos (
 requisicao uuid PRIMARY KEY,filial bigint NOT NULL,dia date NOT NULL,autor uuid NOT NULL,
 acao text NOT NULL,criado_em timestamptz NOT NULL,fingerprint text NOT NULL,dados jsonb NOT NULL,
 FOREIGN KEY(filial,dia) REFERENCES fila_jornadas(filial,dia)
);
CREATE INDEX fila_eventos_jornada ON fila_eventos(filial,dia,criado_em);
