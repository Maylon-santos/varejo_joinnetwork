-- Banco central, como owner; LOGIN exclusivo recebe este grupo na implantação.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='varejo_notificacoes_worker') THEN CREATE ROLE varejo_notificacoes_worker NOLOGIN; END IF;
END $$;
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO varejo_notificacoes_worker',current_database()); END $$;
GRANT USAGE ON SCHEMA public TO varejo_notificacoes_worker;
GRANT SELECT(tenant_key,database_name) ON tenants TO varejo_notificacoes_worker;
GRANT SELECT(id,tenant_key,role,active) ON admin_users TO varejo_notificacoes_worker;
GRANT SELECT(tenant_key,role,permissoes,todas_filiais,somente_proprias_vendas) ON access_roles TO varejo_notificacoes_worker;
GRANT SELECT(user_id,tenant_key,filial,vendedor_codigo) ON user_branches TO varejo_notificacoes_worker;
GRANT SELECT ON notificacao_preferencias TO varejo_notificacoes_worker;
GRANT SELECT,INSERT,UPDATE,DELETE ON notificacao_dispositivos,notificacao_entregas TO varejo_notificacoes_worker;
