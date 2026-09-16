CREATE TABLE cadastro_produtos (
 produto bigint PRIMARY KEY, cod_produto text NOT NULL, descricao text NOT NULL,
 classificacao jsonb NOT NULL DEFAULT '{}',trans_id bigint,
 enriquecido_em timestamptz,proxima_tentativa timestamptz NOT NULL DEFAULT now(),
 falhas_consecutivas integer NOT NULL DEFAULT 0,ultimo_erro_codigo text
);
CREATE TABLE estoque_atual (
 filial bigint NOT NULL,sku text NOT NULL,produto bigint NOT NULL REFERENCES cadastro_produtos(produto),
 cor text,tamanho text,barra text,saldo numeric(20,6),trans_id bigint NOT NULL,
 data_atualizacao_erp timestamptz,consultado_em timestamptz NOT NULL DEFAULT now(),
 presente_ultima_carga boolean NOT NULL DEFAULT true,
 PRIMARY KEY(filial,sku)
);
CREATE INDEX estoque_produto ON estoque_atual(produto);
CREATE TABLE estoque_historico (
 filial bigint NOT NULL,sku text NOT NULL,trans_id bigint NOT NULL,
 saldo numeric(20,6),data_atualizacao_erp timestamptz,observado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(filial,sku,trans_id)
);
CREATE TABLE sync_estoques (
 filial bigint PRIMARY KEY,cursor bigint,ultimo_sucesso timestamptz,ultima_carga_completa timestamptz,
 falhas_consecutivas integer NOT NULL DEFAULT 0,ultimo_erro_codigo text,proxima_tentativa timestamptz NOT NULL DEFAULT now()
);
