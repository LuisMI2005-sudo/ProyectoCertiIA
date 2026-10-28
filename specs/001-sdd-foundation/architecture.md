# Arquitectura actual

El frontend consume REST y el puente MCP HTTP. El cliente generativo CLI consume MCP; los workers deterministas y hooks controlan operaciones del motor. El diagrama describe responsabilidades, no todas las llamadas internas.

```mermaid
flowchart TD
  UI["Frontend React"] --> REST["src/server: API REST"]
  UI --> HTTP["Puente MCP HTTP"]
  CLI["src/agent-client: LangChain y Anthropic"] --> MCP["src/mcp: herramientas MCP"]
  HTTP --> MCP
  REST --> CO["src/subagents: coordinador y workers"]
  MCP --> ENGINE["Analyzer, Git Controller y Test Runner"]
  CO --> ENGINE
  ENGINE --> GUARD["Hooks y seguridad de rutas"]
  REST --> DB["src/db: persistencia"]
  DB --> PG["PostgreSQL o JSON local"]
```
