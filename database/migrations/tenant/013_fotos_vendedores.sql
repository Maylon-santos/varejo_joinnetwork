CREATE TABLE vendedor_fotos (
 filial bigint NOT NULL, vendedor_codigo text NOT NULL,
 imagem bytea NOT NULL CHECK(octet_length(imagem) BETWEEN 1 AND 524288),
 atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid NOT NULL,
 PRIMARY KEY(filial,vendedor_codigo)
);
