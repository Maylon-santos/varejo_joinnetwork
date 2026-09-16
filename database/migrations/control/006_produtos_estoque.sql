UPDATE access_roles SET permissoes=permissoes || '["produtos:ler","estoque:ler"]'::jsonb WHERE role='Admin';
CREATE FUNCTION permissoes_admin_produtos() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role='Admin' THEN NEW.permissoes=NEW.permissoes || '["produtos:ler","estoque:ler"]'::jsonb; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER produtos_perfis_novos BEFORE INSERT ON access_roles FOR EACH ROW EXECUTE FUNCTION permissoes_admin_produtos();
