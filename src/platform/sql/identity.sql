CREATE TABLE users (
 id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE CHECK(email=lower(email)),
 password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tenants (id UUID PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120));
CREATE TABLE memberships (
 tenant_id UUID NOT NULL REFERENCES tenants(id), subject_id UUID NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','member','viewer')), PRIMARY KEY(tenant_id,subject_id)
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'), subject_id UUID NOT NULL REFERENCES users(id),
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
