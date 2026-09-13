CREATE TABLE tenants (
  tenant_key text PRIMARY KEY,
  nome text NOT NULL,
  database_name text NOT NULL UNIQUE,
  criado_em timestamptz NOT NULL DEFAULT now()
);
