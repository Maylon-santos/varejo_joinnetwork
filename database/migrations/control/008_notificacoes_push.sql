-- Inscrições pessoais, opt-in e outbox do resumo diário. Nenhum envio é ativado
-- pela migration; o piloto exige allowlist privada e adesão no aparelho.
CREATE TABLE notificacao_preferencias (
 usuario_id uuid NOT NULL,
 tenant_key text NOT NULL,
 resumo_diario boolean NOT NULL DEFAULT false,
 filiais jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(filiais)='array' AND jsonb_array_length(filiais)<=100),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(usuario_id,tenant_key),
 FOREIGN KEY(usuario_id,tenant_key) REFERENCES admin_users(id,tenant_key) ON DELETE CASCADE
);
CREATE TABLE notificacao_dispositivos (
 id uuid PRIMARY KEY,
 usuario_id uuid NOT NULL,
 tenant_key text NOT NULL,
 sessao_hash text NOT NULL CHECK(sessao_hash ~ '^[a-f0-9]{64}$'),
 endpoint_hash text NOT NULL UNIQUE CHECK(endpoint_hash ~ '^[a-f0-9]{64}$'),
 inscricao_cifrada bytea NOT NULL,
 vapid_hash text NOT NULL,
 nome text NOT NULL CHECK(length(nome) BETWEEN 1 AND 80),
 ativo boolean NOT NULL DEFAULT true,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 ultimo_envio_em timestamptz,
 ultimo_status integer,
 UNIQUE(id,usuario_id,tenant_key),
 FOREIGN KEY(usuario_id,tenant_key) REFERENCES admin_users(id,tenant_key) ON DELETE CASCADE
);
CREATE INDEX notificacao_dispositivos_usuario ON notificacao_dispositivos(usuario_id,tenant_key) WHERE ativo;
CREATE TABLE notificacao_entregas (
 id uuid PRIMARY KEY,
 usuario_id uuid NOT NULL,
 tenant_key text NOT NULL,
 dispositivo_id uuid NOT NULL,
 chave text NOT NULL CHECK(length(chave)<=240),
 tipo text NOT NULL CHECK(tipo IN ('resumo_diario','teste')),
 filial bigint,
 dia date,
 payload_cifrado bytea NOT NULL,
 estado text NOT NULL DEFAULT 'pendente' CHECK(estado IN ('pendente','enviando','aceita','incerta','falha','cancelada','expirada')),
 tentativas integer NOT NULL DEFAULT 0 CHECK(tentativas BETWEEN 0 AND 3),
 status_http integer,
 erro_codigo text,
 criado_em timestamptz NOT NULL DEFAULT now(),
 proxima_tentativa timestamptz NOT NULL DEFAULT now(),
 expira_em timestamptz NOT NULL,
 finalizado_em timestamptz,
 UNIQUE(tenant_key,chave),
 FOREIGN KEY(dispositivo_id,usuario_id,tenant_key) REFERENCES notificacao_dispositivos(id,usuario_id,tenant_key) ON DELETE CASCADE,
 FOREIGN KEY(usuario_id,tenant_key) REFERENCES admin_users(id,tenant_key) ON DELETE CASCADE,
 CHECK((tipo='resumo_diario' AND filial IS NOT NULL AND dia IS NOT NULL) OR (tipo='teste' AND filial IS NULL AND dia IS NULL))
);
CREATE INDEX notificacao_entregas_fila ON notificacao_entregas(tenant_key,proxima_tentativa) WHERE estado='pendente';
CREATE INDEX notificacao_entregas_usuario ON notificacao_entregas(usuario_id,tenant_key,criado_em DESC);
