UPDATE access_roles SET permissoes=permissoes || '["fila:relatorios"]'::jsonb WHERE role='Admin';
CREATE FUNCTION permissoes_admin_fila_relatorios() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role='Admin' THEN NEW.permissoes=NEW.permissoes || '["fila:relatorios"]'::jsonb; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fila_relatorios_perfis_novos BEFORE INSERT ON access_roles FOR EACH ROW EXECUTE FUNCTION permissoes_admin_fila_relatorios();
