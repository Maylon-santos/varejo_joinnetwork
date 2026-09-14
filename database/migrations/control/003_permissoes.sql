CREATE TABLE access_roles (
 tenant_key text NOT NULL REFERENCES tenants(tenant_key),
 role text NOT NULL,
 nome text NOT NULL CHECK(length(nome) BETWEEN 1 AND 80),
 permissoes jsonb NOT NULL CHECK(jsonb_typeof(permissoes)='array'),
 todas_filiais boolean NOT NULL DEFAULT false,
 somente_proprias_vendas boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_key,role)
);
CREATE FUNCTION criar_perfis_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO access_roles(tenant_key,role,nome,permissoes,somente_proprias_vendas,todas_filiais)
 SELECT NEW.tenant_key,role,nome,permissoes::jsonb,proprias,role='Admin' FROM (VALUES
 ('Admin','Admin','["indicadores:ler","vendas:ler","ranking:ler","conferencia:ler","clientes:ler","imagens:ler","acessos:gerenciar"]',false),
 ('Diretoria','Diretoria','[]',false),
 ('Supervisao','Supervisão','[]',false),
 ('Gerentes','Gerentes','[]',false),
 ('Vendas','Vendas','["indicadores:ler","vendas:ler","ranking:ler","clientes:ler","imagens:ler"]',true)
 ) AS r(role,nome,permissoes,proprias);
 RETURN NEW;
END $$;
CREATE TRIGGER perfis_novo_tenant AFTER INSERT ON tenants FOR EACH ROW EXECUTE FUNCTION criar_perfis_tenant();
-- Instalar perfis para tenants existentes sem alterar suas credenciais.
INSERT INTO access_roles(tenant_key,role,nome,permissoes,somente_proprias_vendas,todas_filiais)
 SELECT t.tenant_key,r.role,r.nome,r.permissoes::jsonb,r.proprias,r.role='Admin' FROM tenants t CROSS JOIN (VALUES
 ('Admin','Admin','["indicadores:ler","vendas:ler","ranking:ler","conferencia:ler","clientes:ler","imagens:ler","acessos:gerenciar"]',false),
 ('Diretoria','Diretoria','[]',false),
 ('Supervisao','Supervisão','[]',false),
 ('Gerentes','Gerentes','[]',false),
 ('Vendas','Vendas','["indicadores:ler","vendas:ler","ranking:ler","clientes:ler","imagens:ler"]',true)
 ) AS r(role,nome,permissoes,proprias);
ALTER TABLE admin_users DROP CONSTRAINT admin_users_role_check;
ALTER TABLE admin_users ADD FOREIGN KEY(tenant_key,role) REFERENCES access_roles(tenant_key,role);
ALTER TABLE admin_users ADD UNIQUE(id,tenant_key);
CREATE TABLE user_branches (
 user_id uuid NOT NULL,
 tenant_key text NOT NULL,
 filial bigint NOT NULL CHECK(filial>=0),
 vendedor_codigo text CHECK(length(vendedor_codigo) BETWEEN 1 AND 100),
 PRIMARY KEY(user_id,filial),
 FOREIGN KEY(user_id,tenant_key) REFERENCES admin_users(id,tenant_key) ON DELETE CASCADE
);
