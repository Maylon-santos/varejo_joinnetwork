-- Tipo pertence ao produto; todas as variações o utilizam pelo ID interno.
ALTER TABLE cadastro_produtos ADD COLUMN tipo_prod text
 CHECK(tipo_prod IS NULL OR length(tipo_prod) BETWEEN 1 AND 20);
