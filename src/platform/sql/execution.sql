CREATE TABLE IF NOT EXISTS projects (tenant_id UUID NOT NULL, PRIMARY KEY(tenant_id,id),
  id UUID NOT NULL,
  name TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  runner_type TEXT NOT NULL CHECK (runner_type IN ('jest', 'pytest')),
  created_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_sessions (tenant_id UUID NOT NULL, PRIMARY KEY(tenant_id,id),
  id UUID NOT NULL,
  project_id UUID NOT NULL, FOREIGN KEY(tenant_id,project_id) REFERENCES projects(tenant_id,id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'committed', 'rolled_back', 'blocked', 'failed')),
  target_file TEXT NOT NULL,
  branch_name TEXT,
  baseline_run_id UUID,
  candidate_run_id UUID,
  commit_sha TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  summary_json JSONB NOT NULL,
  record_json JSONB NOT NULL,
  UNIQUE (tenant_id, id, project_id),
  CHECK (finished_at IS NULL OR finished_at >= started_at),
  CHECK ((status IN ('pending', 'running')) = (finished_at IS NULL)),
  CHECK (status <> 'committed' OR (commit_sha IS NOT NULL AND baseline_run_id IS NOT NULL AND candidate_run_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS test_runs (tenant_id UUID NOT NULL, PRIMARY KEY(tenant_id,run_id),
  run_id UUID NOT NULL,
  project_id UUID NOT NULL, FOREIGN KEY(tenant_id,project_id) REFERENCES projects(tenant_id,id),
  audit_id UUID NOT NULL,
  runner TEXT NOT NULL CHECK (runner IN ('jest', 'pytest')),
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'timeout', 'cancelled', 'error')),
  complete BOOLEAN NOT NULL,
  workspace_state_hash TEXT NOT NULL CHECK (workspace_state_hash ~ '^[a-f0-9]{64}$'),
  configuration_hash TEXT NOT NULL CHECK (configuration_hash ~ '^[a-f0-9]{64}$'),
  summary_json JSONB NOT NULL,
  cases_json JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL,
  FOREIGN KEY (tenant_id, audit_id, project_id) REFERENCES audit_sessions(tenant_id, id, project_id),
  UNIQUE (tenant_id, run_id, audit_id),
  CHECK (finished_at >= started_at)
);

-- A repeated migration is a no-op; cross-table constraints must be installed only once.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_baseline_fk' AND conrelid = 'audit_sessions'::regclass) THEN
    ALTER TABLE audit_sessions ADD CONSTRAINT audit_baseline_fk FOREIGN KEY (tenant_id, baseline_run_id, id) REFERENCES test_runs(tenant_id, run_id, audit_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_candidate_fk' AND conrelid = 'audit_sessions'::regclass) THEN
    ALTER TABLE audit_sessions ADD CONSTRAINT audit_candidate_fk FOREIGN KEY (tenant_id, candidate_run_id, id) REFERENCES test_runs(tenant_id, run_id, audit_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hook_logs (tenant_id UUID NOT NULL, PRIMARY KEY(tenant_id,id),
  id UUID NOT NULL,
  audit_id UUID NOT NULL, FOREIGN KEY(tenant_id,audit_id) REFERENCES audit_sessions(tenant_id,id),
  hook_id TEXT NOT NULL,
  hook_name TEXT NOT NULL,
  event TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'block', 'warn')),
  reason TEXT NOT NULL,
  metadata_json JSONB NOT NULL,
  duration_ms DOUBLE PRECISION NOT NULL CHECK (duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  record_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS subagent_delegations (tenant_id UUID NOT NULL, PRIMARY KEY(tenant_id,task_id),
  task_id UUID NOT NULL,
  parent_session_id UUID NOT NULL, FOREIGN KEY(tenant_id,parent_session_id) REFERENCES audit_sessions(tenant_id,id),
  subagent_id UUID,
  role TEXT NOT NULL CHECK (role IN ('diagnostic', 'verification', 'patch-safety')),
  status TEXT NOT NULL CHECK (status IN ('delegated', 'completed', 'rejected', 'budget_exceeded', 'failed')),
  objective TEXT NOT NULL,
  scoped_context_json JSONB NOT NULL,
  tool_calls_json JSONB NOT NULL,
  output_json JSONB NOT NULL,
  consumption_status TEXT,
  duration_ms DOUBLE PRECISION NOT NULL CHECK (duration_ms >= 0),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  record_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS audits_project_idx ON audit_sessions(project_id, started_at);
CREATE INDEX IF NOT EXISTS runs_audit_idx ON test_runs(audit_id, started_at);
CREATE INDEX IF NOT EXISTS hooks_audit_idx ON hook_logs(audit_id, created_at);
CREATE INDEX IF NOT EXISTS delegations_parent_idx ON subagent_delegations(parent_session_id, started_at);

