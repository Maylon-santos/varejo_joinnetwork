-- Camada externa isolada. Não altera valores ou checkpoints do ERP.
CREATE TABLE integration_clients (
 id uuid PRIMARY KEY, tenant_key text NOT NULL, client_id text NOT NULL UNIQUE,
 nome text NOT NULL, ambiente text NOT NULL CHECK(ambiente IN ('homologacao','producao')),
 finalidade text NOT NULL, estado text NOT NULL CHECK(estado IN ('ativo','suspenso','revogado')),
 escopos jsonb NOT NULL, filiais jsonb NOT NULL, hosts jsonb NOT NULL DEFAULT '[]',
 versao bigint NOT NULL DEFAULT 1, criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(), ultimo_acesso_em timestamptz
);
CREATE TABLE integration_keys (
 cliente_id uuid NOT NULL REFERENCES integration_clients(id), kid text NOT NULL,
 public_key text NOT NULL, ativa boolean NOT NULL DEFAULT true, valida_ate timestamptz NOT NULL,
 PRIMARY KEY(cliente_id,kid)
);
CREATE TABLE integration_tokens (
 hash text PRIMARY KEY, cliente_id uuid NOT NULL REFERENCES integration_clients(id),
 kid text NOT NULL, escopos jsonb NOT NULL, expira_em timestamptz NOT NULL
);
CREATE INDEX integration_tokens_expira ON integration_tokens(expira_em);
CREATE TABLE integration_jti (
 cliente_id uuid NOT NULL REFERENCES integration_clients(id), jti uuid NOT NULL,
 expira_em timestamptz NOT NULL, PRIMARY KEY(cliente_id,jti)
);
CREATE TABLE integration_admission (
 chave text PRIMARY KEY, atualizado_em timestamptz NOT NULL, tokens double precision NOT NULL
);
CREATE TABLE integration_leases (
 id uuid PRIMARY KEY, cliente_id uuid NOT NULL, tenant_key text NOT NULL, expira_em timestamptz NOT NULL
);
CREATE TABLE integration_dirty (
 recurso text NOT NULL, filial bigint NOT NULL, chave text NOT NULL,
 origem text NOT NULL DEFAULT coalesce(nullif(current_setting('app.integration_origin',true),''),'continua'),
 PRIMARY KEY(recurso,filial,chave)
);
CREATE TABLE integration_resources (
 recurso text NOT NULL, filial bigint NOT NULL, chave text NOT NULL, versao bigint NOT NULL,
 hash text NOT NULL, dados bytea NOT NULL, filtros jsonb NOT NULL, atualizado_em timestamptz NOT NULL,
 PRIMARY KEY(recurso,filial,chave)
);
CREATE INDEX integration_resources_filtros ON integration_resources USING gin(filtros);
-- Publicador único serializa esta sequência até o COMMIT; leitores nunca pulam um commit tardio.
CREATE TABLE integration_changes (
 posicao bigserial PRIMARY KEY, id uuid NOT NULL UNIQUE, recurso text NOT NULL,
 filial bigint NOT NULL, chave text NOT NULL, versao bigint NOT NULL, acao text NOT NULL,
 consulta_url text NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
 tipo_evento text, payload bytea
);
CREATE INDEX integration_changes_consulta ON integration_changes(recurso,filial,posicao);
CREATE INDEX integration_changes_retencao ON integration_changes(registrado_em);
CREATE TABLE integration_snapshots (
 id uuid PRIMARY KEY, cliente_id uuid NOT NULL REFERENCES integration_clients(id),
 concessao text NOT NULL, consulta_hash text NOT NULL, dados bytea NOT NULL,
 recurso_versao text, expira_em timestamptz NOT NULL DEFAULT now()+interval '30 minutes'
);
CREATE INDEX integration_snapshots_expira ON integration_snapshots(expira_em);
CREATE TABLE integration_webhooks (
 id uuid PRIMARY KEY, cliente_id uuid NOT NULL REFERENCES integration_clients(id),
 nome text NOT NULL, url text NOT NULL, hostname text NOT NULL, eventos jsonb NOT NULL, filiais jsonb NOT NULL,
 ativo boolean NOT NULL DEFAULT false, estado text NOT NULL DEFAULT 'pendente_verificacao',
 verificado_em timestamptz, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(),
 versao bigint NOT NULL DEFAULT 1, segredo bytea NOT NULL, segredo_anterior bytea, anterior_ate timestamptz,
 falhas integer NOT NULL DEFAULT 0, circuito_ate timestamptz, ultimo_envio_em timestamptz
);
CREATE TABLE integration_deliveries (
 id uuid PRIMARY KEY, webhook_id uuid NOT NULL REFERENCES integration_webhooks(id), evento_id uuid NOT NULL,
 filial bigint, tipo_evento text NOT NULL, payload bytea, configuracao_versao bigint NOT NULL, destino_url text NOT NULL,
 evento_criado_em timestamptz NOT NULL DEFAULT now(),
 estado text NOT NULL DEFAULT 'na_fila', tentativas integer NOT NULL DEFAULT 0,
 ultimo_http_status integer, proxima_tentativa_em timestamptz NOT NULL DEFAULT now(),
 criado_em timestamptz NOT NULL DEFAULT now(), finalizado_em timestamptz,
 lease_id uuid, lease_ate timestamptz, origem text NOT NULL, ator_id uuid,
 ciclo integer NOT NULL DEFAULT 0, UNIQUE(webhook_id,evento_id,ciclo)
);
CREATE INDEX integration_deliveries_fila ON integration_deliveries(proxima_tentativa_em) WHERE estado IN ('na_fila','aguardando_retry','enviando');
CREATE TABLE integration_dispatch_checkpoint (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), posicao bigint NOT NULL DEFAULT 0
);
INSERT INTO integration_dispatch_checkpoint DEFAULT VALUES;
CREATE TABLE integration_attempts (
 id uuid PRIMARY KEY, entrega_id uuid NOT NULL REFERENCES integration_deliveries(id),
 iniciado_em timestamptz NOT NULL, finalizado_em timestamptz,
 duracao_ms integer, atraso_fila_ms bigint NOT NULL, http_status integer, codigo_falha text,
 numero_tentativa integer NOT NULL, hostname text NOT NULL, ator_id uuid
);
CREATE TABLE integration_idempotency (
 cliente_id uuid NOT NULL, chave uuid NOT NULL, hash text NOT NULL, resposta bytea NOT NULL,
 status integer NOT NULL, etag text, expira_em timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 PRIMARY KEY(cliente_id,chave)
);
CREATE TABLE integration_access_logs (
 id uuid PRIMARY KEY, iniciado_em timestamptz NOT NULL, duracao_ms integer NOT NULL,
 cliente_id uuid, tenant_key text, canal text NOT NULL, metodo text NOT NULL, rota_template text NOT NULL,
 filial_id text, http_status integer NOT NULL, codigo_erro text, bytes_resposta integer NOT NULL,
 decisao text NOT NULL, ip_hash text NOT NULL, user_agent text NOT NULL, kid text
);
CREATE INDEX integration_access_consulta ON integration_access_logs(iniciado_em,cliente_id);
CREATE TABLE integration_admins (
 usuario_id uuid PRIMARY KEY, tenant_key text NOT NULL, totp_secret bytea NOT NULL,
 ativo boolean NOT NULL DEFAULT true, ultimo_passo bigint NOT NULL DEFAULT -1
);
CREATE TABLE integration_admin_audit (
 id uuid PRIMARY KEY, ator_id uuid NOT NULL, tenant_key text NOT NULL, acao text NOT NULL,
 alvo_id uuid, motivo text NOT NULL, dados jsonb NOT NULL, criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX integration_admin_audit_consulta ON integration_admin_audit(criado_em);
CREATE TABLE integration_admin_sessions (
 hash text PRIMARY KEY, usuario_id uuid NOT NULL, sessao_hash text NOT NULL,
 expira_em timestamptz NOT NULL DEFAULT now()+interval '5 minutes'
);

CREATE FUNCTION integration_capture() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; p record; f bigint; c text;
BEGIN
 IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
 IF TG_OP='UPDATE' AND
   (to_jsonb(OLD)-ARRAY['atualizado_em','consultado_em','clientes_importados_em','complementos_importados_em','enriquecido_em','proxima_tentativa','falhas_consecutivas','ultimo_erro_codigo']) =
   (to_jsonb(NEW)-ARRAY['atualizado_em','consultado_em','clientes_importados_em','complementos_importados_em','enriquecido_em','proxima_tentativa','falhas_consecutivas','ultimo_erro_codigo']) THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME IN ('operacoes','operacao_itens','cancelamentos') THEN
  INSERT INTO integration_dirty VALUES('vendas',r.filial,'vnd_'||r.filial||'_'||r.tipo_operacao||'_'||r.cod_operacao) ON CONFLICT(recurso,filial,chave) DO UPDATE SET origem=EXCLUDED.origem;
 ELSIF TG_TABLE_NAME='cadastro_filiais' THEN
  INSERT INTO integration_dirty VALUES('filiais',r.filial,r.filial::text) ON CONFLICT(recurso,filial,chave) DO UPDATE SET origem=EXCLUDED.origem;
 ELSIF TG_TABLE_NAME='estoque_atual' THEN
  INSERT INTO integration_dirty VALUES('estoques',r.filial,r.sku),('produtos',r.filial,r.produto::text) ON CONFLICT(recurso,filial,chave) DO UPDATE SET origem=EXCLUDED.origem;
 ELSIF TG_TABLE_NAME='cadastro_produtos' THEN
  FOR p IN SELECT filial,sku FROM estoque_atual WHERE produto=r.produto ORDER BY filial,sku LOOP
   INSERT INTO integration_dirty VALUES('produtos',p.filial,r.produto::text),('estoques',p.filial,p.sku) ON CONFLICT(recurso,filial,chave) DO UPDATE SET origem=EXCLUDED.origem;
  END LOOP;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER integration_operacoes AFTER INSERT OR UPDATE OR DELETE ON operacoes FOR EACH ROW EXECUTE FUNCTION integration_capture();
CREATE TRIGGER integration_itens AFTER INSERT OR UPDATE OR DELETE ON operacao_itens FOR EACH ROW EXECUTE FUNCTION integration_capture();
CREATE TRIGGER integration_cancelamentos AFTER INSERT OR UPDATE OR DELETE ON cancelamentos FOR EACH ROW EXECUTE FUNCTION integration_capture();
CREATE TRIGGER integration_filiais AFTER INSERT OR UPDATE OR DELETE ON cadastro_filiais FOR EACH ROW EXECUTE FUNCTION integration_capture();
CREATE TRIGGER integration_produtos AFTER INSERT OR UPDATE OR DELETE ON cadastro_produtos FOR EACH ROW EXECUTE FUNCTION integration_capture();
CREATE TRIGGER integration_estoque AFTER INSERT OR UPDATE OR DELETE ON estoque_atual FOR EACH ROW EXECUTE FUNCTION integration_capture();
INSERT INTO integration_dirty SELECT 'vendas',filial,'vnd_'||filial||'_'||tipo_operacao||'_'||cod_operacao FROM operacoes;
INSERT INTO integration_dirty SELECT 'filiais',filial,filial::text FROM cadastro_filiais;
INSERT INTO integration_dirty SELECT DISTINCT 'produtos',filial,produto::text FROM estoque_atual;
INSERT INTO integration_dirty SELECT 'estoques',filial,sku FROM estoque_atual;
UPDATE integration_dirty SET origem='historica';
