ALTER TABLE fila_jornadas ADD COLUMN movimento_intenso boolean NOT NULL DEFAULT false;
-- Fotografia do modo na abordagem; sair do modo não muda o histórico.
ALTER TABLE fila_atendimentos ADD COLUMN movimento_intenso boolean NOT NULL DEFAULT false;
CREATE INDEX fila_atendimentos_relatorio ON fila_atendimentos(filial,dia,vendedor_codigo,abordado_em,id);
