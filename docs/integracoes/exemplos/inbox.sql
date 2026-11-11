-- Exemplo no banco DO CONSUMIDOR. Não executar no banco do piloto.
CREATE TABLE integracao_inbox (
 origem text NOT NULL,
 inscricao_id uuid NOT NULL,
 evento_id uuid NOT NULL,
 recebido_em timestamptz NOT NULL DEFAULT now(),
 payload jsonb NOT NULL,
 processado_em timestamptz,
 PRIMARY KEY(origem,inscricao_id,evento_id)
);
CREATE TABLE integracao_trabalho (
 origem text NOT NULL,
 inscricao_id uuid NOT NULL,
 evento_id uuid NOT NULL,
 estado text NOT NULL DEFAULT 'pendente',
 PRIMARY KEY(origem,inscricao_id,evento_id),
 FOREIGN KEY(origem,inscricao_id,evento_id)
  REFERENCES integracao_inbox(origem,inscricao_id,evento_id)
);
-- Em UMA transação: inserir inbox com ON CONFLICT DO NOTHING;
-- se inseriu, inserir trabalho. COMMIT antes da resposta HTTP 2xx.
-- O worker local aplica a revisão e marca o processamento em transação.
