# Modelo de datos actual

Fuente: src/db/schema.sql. Modelo resumido de las cinco tablas reales; no es una migración. Una auditoría pertenece a un proyecto y contiene pruebas, intercepciones y delegaciones. Los enlaces baseline/candidato son opcionales y están restringidos a ejecuciones de la misma auditoría. Los detalles JSON y todas las restricciones permanecen en el esquema SQL.

```mermaid
erDiagram
  projects ||--o{ audit_sessions : contiene
  projects ||--o{ test_runs : registra
  audit_sessions ||--o{ test_runs : ejecuta
  audit_sessions ||--o{ hook_logs : intercepta
  audit_sessions ||--o{ subagent_delegations : delega
  projects {
    uuid id PK
    text name
    text runner_type
  }
  audit_sessions {
    uuid id PK
    uuid project_id FK
    text status
    text target_file
    uuid baseline_run_id FK
    uuid candidate_run_id FK
  }
  test_runs {
    uuid run_id PK
    uuid project_id FK
    uuid audit_id FK
    boolean complete
    text status
  }
  hook_logs {
    uuid id PK
    uuid audit_id FK
    text decision
  }
  subagent_delegations {
    uuid task_id PK
    uuid parent_session_id FK
    text role
    text status
  }
```
