CREATE TABLE domain_records (
 tenant_id UUID NOT NULL, entity_type TEXT NOT NULL CHECK(length(entity_type) BETWEEN 1 AND 100),
 id UUID NOT NULL, version INTEGER NOT NULL CHECK(version>0), status TEXT NOT NULL,
 data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,entity_type,id)
);
CREATE TABLE outbox (
 tenant_id UUID NOT NULL, sequence BIGINT GENERATED ALWAYS AS IDENTITY,
 event_id UUID NOT NULL, aggregate_type TEXT NOT NULL, aggregate_id UUID NOT NULL,
 aggregate_version INTEGER NOT NULL, correlation_id UUID NOT NULL, payload JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,event_id),
 UNIQUE(tenant_id,aggregate_type,aggregate_id,aggregate_version),
 FOREIGN KEY(tenant_id,aggregate_type,aggregate_id) REFERENCES domain_records(tenant_id,entity_type,id)
);
CREATE INDEX outbox_cursor_idx ON outbox(tenant_id,sequence);
CREATE TABLE inbox (
 tenant_id UUID NOT NULL, event_id UUID NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,event_id)
);
