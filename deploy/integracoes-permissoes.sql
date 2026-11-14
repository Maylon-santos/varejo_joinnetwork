-- Executar no banco do tenant como owner, após migration 019.
-- São papéis de grupo NOLOGIN; credenciais LOGIN são provisionadas fora do Git.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='varejo_integracoes_api') THEN CREATE ROLE varejo_integracoes_api NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='varejo_integracoes_worker') THEN CREATE ROLE varejo_integracoes_worker NOLOGIN; END IF;
END $$;
-- Os bancos do piloto revogam CONNECT de PUBLIC na criação.
DO $$ BEGIN
 EXECUTE format('GRANT CONNECT ON DATABASE %I TO varejo_integracoes_api,varejo_integracoes_worker',current_database());
END $$;
GRANT USAGE ON SCHEMA public TO varejo_integracoes_api,varejo_integracoes_worker;
GRANT SELECT ON tenant_identity,operacoes,operacao_itens,cancelamentos,cadastro_filiais,cadastro_produtos,estoque_atual,sync_estoques TO varejo_integracoes_worker;
GRANT SELECT ON tenant_identity,estoque_atual,sync_estoques TO varejo_integracoes_api;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND left(tablename,12)='integration_' LOOP
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO varejo_integracoes_api,varejo_integracoes_worker',t.tablename);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE integration_changes_posicao_seq TO varejo_integracoes_worker;
-- Refinamento: a borda HTTP não publica revisões, altera payload de evento nem edita log de auditoria.
REVOKE INSERT,UPDATE,DELETE ON integration_dirty,integration_resources,integration_changes,integration_dispatch_checkpoint,integration_attempts FROM varejo_integracoes_api;
REVOKE UPDATE,DELETE ON integration_access_logs,integration_admin_audit FROM varejo_integracoes_api;
REVOKE INSERT,UPDATE,DELETE ON integration_admins FROM varejo_integracoes_api;
GRANT UPDATE(ultimo_passo) ON integration_admins TO varejo_integracoes_api;
-- Ativação somente de convite individual previamente registrado por SSH,
-- após prova TOTP vinculada à sessão. A API não cria nem altera o segredo.
GRANT UPDATE(ativo) ON integration_admins TO varejo_integracoes_api;
