-- Executar no banco central como owner. Atribuir o grupo a um LOGIN privado exclusivo do console.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='varejo_integracoes_auth') THEN CREATE ROLE varejo_integracoes_auth NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO varejo_integracoes_auth;
GRANT SELECT ON admin_users,access_roles,user_branches TO varejo_integracoes_auth;
GRANT SELECT,INSERT,DELETE ON admin_sessions TO varejo_integracoes_auth;
