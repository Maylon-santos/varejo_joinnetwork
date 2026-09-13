CREATE TABLE admin_users (
  id uuid PRIMARY KEY,
  tenant_key text NOT NULL REFERENCES tenants(tenant_key),
  email text NOT NULL CHECK(email=lower(email)),
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'Admin' CHECK(role='Admin'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_key,email)
);
CREATE TABLE admin_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);
CREATE INDEX admin_sessions_user ON admin_sessions(user_id);
