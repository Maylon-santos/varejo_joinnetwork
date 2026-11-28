-- Metadados visuais confirmados por SKU na origem. Não alteram estoque ou vendas.
CREATE TABLE produto_cores_imagem (
 produto bigint NOT NULL REFERENCES cadastro_produtos(produto),cod_produto text NOT NULL,cor text NOT NULL,
 cor_codigo text NOT NULL CHECK(length(cor_codigo) BETWEEN 1 AND 100),
 cor_descricao text CHECK(length(cor_descricao)<=100),conflitante boolean NOT NULL DEFAULT false,
 filial_origem bigint NOT NULL,sku_origem text NOT NULL,confirmado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(produto,cod_produto,cor)
);
