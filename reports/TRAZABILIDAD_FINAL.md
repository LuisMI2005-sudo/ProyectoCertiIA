# Matriz de trazabilidad final

**Corte:** 29/10/2026. [Backlog canónico](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/Dev/backlog.md). [Especificación](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/005-final-traceability/spec.md) y [plan](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/005-final-traceability/plan.md). Los enlaces de código y evidencia están fijados a backend 39cb46a y frontend 3b06f56. Los issues registran trabajo retrospectivo o pendientes actuales; no acreditan que Spec Kit se usara antes de su adopción.

## Correspondencia por historia

| HU | Estado | Issue | Código o referencia | Prueba o evidencia disponible |
|---|---|---|---|---|
| [HU-01](#hu-01) Entorno de desarrollo reproducible | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/6) | [package.json](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/package.json) | [tests/shared.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/shared.test.mjs) |
| [HU-02](#hu-02) Contratos y errores consistentes | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/7) | [src/shared/contracts.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/shared/contracts.ts) | [tests/shared.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/shared.test.mjs) |
| [HU-03](#hu-03) Acceso seguro a archivos | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/8) | [src/shared/path-security.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/shared/path-security.ts) | [tests/shared.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/shared.test.mjs) |
| [HU-04](#hu-04) Lectura acotada de código | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/9) | [src/analyzer/ast-analyzer.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/analyzer/ast-analyzer.ts) | [tests/analyzer/analyzer.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/analyzer/analyzer.test.mjs) |
| [HU-05](#hu-05) Contexto de símbolos | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/10) | [src/analyzer/ast-analyzer.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/analyzer/ast-analyzer.ts) | [tests/analyzer/analyzer.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/analyzer/analyzer.test.mjs) |
| [HU-06](#hu-06) Diagnóstico estático | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/11) | [src/analyzer/eslint-analyzer.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/analyzer/eslint-analyzer.ts) | [tests/analyzer/analyzer.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/analyzer/analyzer.test.mjs) |
| [HU-07](#hu-07) Consulta de análisis guardados | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/12) | [src/analyzer/index.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/analyzer/index.ts) | [tests/analyzer/analyzer.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/analyzer/analyzer.test.mjs) |
| [HU-08](#hu-08) Rama y checkpoint de reparación | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/13) | [src/git-controller/repository.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/git-controller/repository.ts) | [tests/git-controller/controller.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/git-controller/controller.test.mjs) |
| [HU-09](#hu-09) Aplicación y revisión de parches | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/14) | [src/git-controller/patch-manager.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/git-controller/patch-manager.ts) | [tests/git-controller/controller.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/git-controller/controller.test.mjs) |
| [HU-10](#hu-10) Rollback limitado al intento | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/15) | [src/git-controller/patch-manager.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/git-controller/patch-manager.ts) | [tests/git-controller/controller.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/git-controller/controller.test.mjs) |
| [HU-11](#hu-11) Commit condicionado a evidencia | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/16) | [src/git-controller/patch-manager.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/git-controller/patch-manager.ts) | [tests/git-controller/controller.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/git-controller/controller.test.mjs) |
| [HU-12](#hu-12) Ejecutar pruebas reales de manera controlada | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/17) | [src/test-runner/index.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/index.ts) | [tests/test-runner/runner.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/runner.test.mjs) |
| [HU-13](#hu-13) Comparar ejecuciones sin ocultar regresiones | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/18) | [src/test-runner/index.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/index.ts) | [tests/test-runner/runner.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/runner.test.mjs) |
| [HU-14](#hu-14) Guardar y recuperar ejecuciones y evidencia | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/19) | [src/test-runner/index.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/index.ts) | [tests/test-runner/runner.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/runner.test.mjs) |
| [HU-15](#hu-15) Validar automáticamente los módulos existentes | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/20) | [.github/workflows/ci.yml](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/.github/workflows/ci.yml) | [tests/test-runner/sandbox.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/sandbox.test.mjs) |
| [HU-16](#hu-16) Rechazar pruebas aprobadas que pasan a omitidas | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/21) | [src/test-runner/index.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/index.ts) | [tests/test-runner/runner.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/runner.test.mjs) |
| [HU-17](#hu-17) Rechazar reportes incompletos o inconsistentes | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/22) | [src/test-runner/reports.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/reports.ts) | [tests/test-runner/runner.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/runner.test.mjs) |
| [HU-18](#hu-18) Verificar un flujo de reparación con Jest real | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/23) | [src/subagents/coordinator.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/subagents/coordinator.ts) | [tests/subagents/subagents.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/subagents/subagents.test.mjs) |
| [HU-19](#hu-19) Verificar pytest real | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/24) | [src/test-runner/reports.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/reports.ts) | [tests/test-runner/runner.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/runner.test.mjs) |
| [HU-20](#hu-20) Corregir la documentación de Fase 4 | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/25) | [src/test-runner/README.md](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/README.md) | [src/shared/contracts.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/shared/contracts.ts) |
| [HU-21](#hu-21) Ejecutar validaciones en GitHub Actions | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/26) | [.github/workflows/ci.yml](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/.github/workflows/ci.yml) | [.github/workflows/ci.yml](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/.github/workflows/ci.yml) |
| [HU-22](#hu-22) Acreditar colaboración y contribuciones del equipo | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/27) | [AGENTS.md](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/AGENTS.md) | [README.md](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/README.md) |
| [HU-23](#hu-23) Publicar las herramientas mediante un servidor MCP | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/28) | [src/mcp/server.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/mcp/server.ts) | [tests/server/server.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/server/server.test.mjs) |
| [HU-24](#hu-24) Consultar recursos MCP de proyecto y análisis | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/29) | [src/mcp-server/index.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/mcp-server/index.ts) | [tests/mcp-server/server.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/mcp-server/server.test.mjs) |
| [HU-25](#hu-25) Diagnosticar y proponer un parche con IA | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/30) | [src/agent-client/planner.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/agent-client/planner.ts) | [tests/agent-client/agent.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/agent-client/agent.test.mjs) |
| [HU-26](#hu-26) Orquestar reparación y reintentos acotados | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/31) | [src/agent-client/orchestrator.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/agent-client/orchestrator.ts) | [tests/agent-client/agent.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/agent-client/agent.test.mjs) |
| [HU-27](#hu-27) Ejecutar un hook demostrable | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/32) | [src/hooks/builtin-hooks.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/hooks/builtin-hooks.ts) | [tests/hooks/hooks.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/hooks/hooks.test.mjs) |
| [HU-28](#hu-28) Delegar una tarea a un subagente real | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/33) | [src/subagents/specialists.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/subagents/specialists.ts) | [tests/subagents/subagents.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/subagents/subagents.test.mjs) |
| [HU-29](#hu-29) Persistir auditorías y resultados | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/34) | [src/db/schema.sql](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/db/schema.sql) | [tests/db/db.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/db/db.test.mjs) |
| [HU-30](#hu-30) Ofrecer una API de aplicación | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/35) | [src/server/application.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/server/application.ts) | [tests/server/server.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/server/server.test.mjs) |
| [HU-31](#hu-31) Operar desde un dashboard | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/36) | [src/App.tsx](https://github.com/SebhastianCampero-Collab/Frontend/blob/3b06f56e3bf2a213155865760649218c8d3b16d6/src/App.tsx) | [tests/navigation.test.tsx](https://github.com/SebhastianCampero-Collab/Frontend/blob/3b06f56e3bf2a213155865760649218c8d3b16d6/tests/navigation.test.tsx) |
| [HU-32](#hu-32) Conectar un worker autorizado con el workspace | Pendiente | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/37) | [src/mcp/server.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/mcp/server.ts) | [src/server/README.md](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/server/README.md) |
| [HU-33](#hu-33) Desplegar la base de datos | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/38) | [src/db/postgres-adapter.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/db/postgres-adapter.ts) | [tests/db/db.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/db/db.test.mjs) |
| [HU-34](#hu-34) Desplegar el backend | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/39) | [src/server/main.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/server/main.ts) | [tests/server/server.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/server/server.test.mjs) |
| [HU-35](#hu-35) Desplegar el frontend | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/40) | [src/App.tsx](https://github.com/SebhastianCampero-Collab/Frontend/blob/3b06f56e3bf2a213155865760649218c8d3b16d6/src/App.tsx) | [tests/client.test.ts](https://github.com/SebhastianCampero-Collab/Frontend/blob/3b06f56e3bf2a213155865760649218c8d3b16d6/tests/client.test.ts) |
| [HU-36](#hu-36) Desplegar desde el pipeline | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/41) | [.github/workflows/ci.yml](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/.github/workflows/ci.yml) | [.github/workflows/ci.yml](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/.github/workflows/ci.yml) |
| [HU-37](#hu-37) Demostrar conexión de punta a punta | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/42) | [src/components/AuditPanel.tsx](https://github.com/SebhastianCampero-Collab/Frontend/blob/3b06f56e3bf2a213155865760649218c8d3b16d6/src/components/AuditPanel.tsx) | [tests/audit-state.test.tsx](https://github.com/SebhastianCampero-Collab/Frontend/blob/3b06f56e3bf2a213155865760649218c8d3b16d6/tests/audit-state.test.tsx) |
| [HU-38](#hu-38) Consolidar y documentar la versión de entrega | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/43) | [README.md](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/README.md) | [README.md](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/README.md) |
| [HU-39](#hu-39) Preparar la defensa grupal e individual | Pendiente | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/44) | [README.md](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/README.md) | [README.md](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/README.md) |
| [HU-40](#hu-40) Revisar secretos y permisos de entrega | Pendiente | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/45) | [.gitignore](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/.gitignore) | [.gitignore](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/.gitignore) |
| [HU-41](#hu-41) Validar el estado y configuración efectivos de una ejecución | Pendiente | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/46) | [src/test-runner/index.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/index.ts) | [tests/test-runner/runner.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/runner.test.mjs) |
| [HU-42](#hu-42) Respetar el presupuesto total y proteger la evidencia | Pendiente | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/47) | [src/test-runner/index.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/index.ts) | [tests/test-runner/runner.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/runner.test.mjs) |
| [HU-43](#hu-43) Garantizar terminación ante timeout y cancelación | Pendiente | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/48) | [src/test-runner/process.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/process.ts) | [tests/test-runner/runner.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/runner.test.mjs) |
| [HU-44](#hu-44) Aislar usuarios y proyectos por organización | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/49) | [src/platform/security.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/platform/security.ts) | [tests/platform/postgres.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/platform/postgres.test.mjs) |
| [HU-45](#hu-45) Ejecutar servicios de dominio con bases privadas | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/50) | [src/platform/domains.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/platform/domains.ts) | [tests/platform/security.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/platform/security.test.mjs) |
| [HU-46](#hu-46) Componer Shell y seis microfrontends | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/51) | [src/platform/shell.tsx](https://github.com/SebhastianCampero-Collab/Frontend/blob/3b06f56e3bf2a213155865760649218c8d3b16d6/src/platform/shell.tsx) | [tests/platform.test.tsx](https://github.com/SebhastianCampero-Collab/Frontend/blob/3b06f56e3bf2a213155865760649218c8d3b16d6/tests/platform.test.tsx) |
| [HU-47](#hu-47) Mantener especificaciones y trazabilidad SDD | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/52) | [.specify/memory/constitution.md](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/.specify/memory/constitution.md) | [scripts/spec-kit-docs.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/scripts/spec-kit-docs.mjs) |
| [HU-48](#hu-48) Navegar el segundo cerebro independiente en Obsidian | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/53) | [.obsidian/graph.json](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/b1e1a41865058aea1f41440a53b32268ae053555/.obsidian/graph.json) | [scripts/check-vault.mjs](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/b1e1a41865058aea1f41440a53b32268ae053555/scripts/check-vault.mjs) |
| [HU-49](#hu-49) Importar y recuperar un repositorio GitHub | Completada técnica | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/54) | [src/server/project-reclone.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/server/project-reclone.ts) | [tests/server/project-reclone.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/server/project-reclone.test.mjs) |
| [HU-50](#hu-50) Verificar reparaciones de proyectos externos en sandbox | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/55) | [src/test-runner/docker-sandbox.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/test-runner/docker-sandbox.ts) | [tests/test-runner/sandbox.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/test-runner/sandbox.test.mjs) |
| [HU-51](#hu-51) Aplicar hooks y especialistas al asistente de desarrollo | Parcial | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/56) | [src/ide-integration/policy.ts](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/src/ide-integration/policy.ts) | [tests/ide-integration/ide-hooks.test.mjs](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/tests/ide-integration/ide-hooks.test.mjs) |

## Cómo interpretar la evidencia

Código y pruebas enlazados no significan aceptación completa cuando la HU es parcial o pendiente. HU-32 enlaza contratos existentes; no un worker remoto terminado. HU-39/HU-40 enlazan referencias de entrega, no pruebas de defensa ni una auditoría integral ya realizada. HU-48 se acredita en el repositorio documental mediante su verificador, Canvas y grafo. Los archivos README o workflows citados son evidencia documental/configuración, no una prueba de usuario ejecutada.

[CI backend](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149) y [CI frontend](https://github.com/SebhastianCampero-Collab/Frontend/actions/runs/40942339109) aprueban los SHAs de integración. Los [PR backend #5](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) y [frontend #1](https://github.com/SebhastianCampero-Collab/Frontend/pull/1) siguen abiertos en este corte. Son trazabilidad de la consolidación; no se les atribuye la autoría de todas las HU anteriores. Los PRs históricos #1 a #4 del backend acreditan integraciones previas; [#4](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/4) incluye documentación HU-25/HU-26 de Eduardo. Las consultas de GitHub de esta revisión comprobaron merged_at; cerrar un issue nuevo no modifica esa historia.

## Alcance y próximo criterio por HU

### HU-01

Entorno de desarrollo reproducible. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/6). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-02

Contratos y errores consistentes. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/7). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-03

Acceso seguro a archivos. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/8). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-04

Lectura acotada de código. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/9). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-05

Contexto de símbolos. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/10). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-06

Diagnóstico estático. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/11). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-07

Consulta de análisis guardados. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/12). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-08

Rama y checkpoint de reparación. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/13). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-09

Aplicación y revisión de parches. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/14). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-10

Rollback limitado al intento. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/15). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-11

Commit condicionado a evidencia. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/16). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-12

Ejecutar pruebas reales de manera controlada. **Parcial.** Faltan criterios integrales de HU-18/HU-19 y endurecimiento; ejecutar no equivale a aislamiento universal. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/17). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-13

Comparar ejecuciones sin ocultar regresiones. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/18). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-14

Guardar y recuperar ejecuciones y evidencia. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/19). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-15

Validar automáticamente los módulos existentes. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/20). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-16

Rechazar pruebas aprobadas que pasan a omitidas. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/21). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-17

Rechazar reportes incompletos o inconsistentes. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/22). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-18

Verificar un flujo de reparación con Jest real. **Parcial.** Falta introducir trabajo ajeno dentro del flujo real de rollback y comprobar su conservación. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/23). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-19

Verificar pytest real. **Parcial.** Faltan fallo, colección, timeout y cancelación con pytest real; los fixtures no sustituyen esos escenarios. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/24). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-20

Corregir la documentación de Fase 4. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/25). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-21

Ejecutar validaciones en GitHub Actions. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/26). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-22

Acreditar colaboración y contribuciones del equipo. **Parcial.** Autorías acreditadas; falta revisión/acceso del docente y matriz de defensa por integrante. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/27). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-23

Publicar las herramientas mediante un servidor MCP. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/28). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-24

Consultar recursos MCP de proyecto y análisis. **Parcial.** Recurso de análisis en compatibilidad; faltan recursos completos con ámbito de proyecto en src/mcp/. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/29). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-25

Diagnosticar y proponer un parche con IA. **Completada técnica.** Implementación probada con proveedor simulado; no se acredita una llamada real a Anthropic. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/30). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-26

Orquestar reparación y reintentos acotados. **Completada técnica.** Ciclo MCP probado con propuestas controladas; falta demostración generativa real en el entorno elegido. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/31). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-27

Ejecutar un hook demostrable. **Completada técnica.** Tres reglas del motor; la activación en el asistente se sigue separadamente en HU-51. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/32). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-28

Delegar una tarea a un subagente real. **Completada técnica.** Tres roles deterministas; el flujo REST no garantiza una delegación patch-safety específica. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/33). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-29

Persistir auditorías y resultados. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/34). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-30

Ofrecer una API de aplicación. **Completada técnica.** Criterios técnicos implementados y con pruebas; la aceptación del docente no se infiere del estado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/35). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-31

Operar desde un dashboard. **Completada técnica.** Interfaz real con formularios, paneles y sandbox; no habilita reparación cloud sin ejecutor. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/36). [Evidencia de versión](https://github.com/SebhastianCampero-Collab/Frontend/actions/runs/40942339109).

### HU-32

Conectar un worker autorizado con el workspace. **Pendiente.** Falta worker remoto autenticado; Docker local no conecta por sí solo con la laptop del usuario. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/37). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-33

Desplegar la base de datos. **Completada técnica.** Health cloud confirmó conexión PostgreSQL y cinco tablas; no acredita la migración multitenant productiva. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/38). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-34

Desplegar el backend. **Completada técnica.** API publicada; health no informa el SHA desplegado. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/39). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-35

Desplegar el frontend. **Completada técnica.** Web accesible; el último PR todavía no acredita publicación. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/40). [Evidencia de versión](https://github.com/SebhastianCampero-Collab/Frontend/actions/runs/40942339109).

### HU-36

Desplegar desde el pipeline. **Parcial.** Falta vincular SHA de la entrega final con Render y comprobar bloqueo del deploy por CI fallido. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/41). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-37

Demostrar conexión de punta a punta. **Parcial.** Existe evidencia histórica; falta repetir punta a punta sobre la versión final y registrar identificadores. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/42). [Evidencia de versión](https://github.com/SebhastianCampero-Collab/Frontend/actions/runs/40942339109).

### HU-38

Consolidar y documentar la versión de entrega. **Parcial.** PRs de integración abiertos; falta fusión autorizada y versión final en main, conforme al criterio de la HU. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/43). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-39

Preparar la defensa grupal e individual. **Pendiente.** Ensayo y defensa individuales no ejecutados; no se infiere nota por commits. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/44). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-40

Revisar secretos y permisos de entrega. **Pendiente.** Pendiente auditoría de historial, artefactos, logs y permisos; .gitignore no prueba ausencia integral de secretos. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/45). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-41

Validar el estado y configuración efectivos de una ejecución. **Pendiente.** Hay hashes y fingerprint de imagen; faltan todas las invariantes de estado/configuración durante el run. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/46). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-42

Respetar el presupuesto total y proteger la evidencia. **Pendiente.** Hay límite de reporte; faltan presupuesto global de evidencia y todos los caminos de limpieza/inmutabilidad. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/47). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-43

Garantizar terminación ante timeout y cancelación. **Pendiente.** Docker prueba timeout y destrucción; falta toda la cobertura de taskkill/fallback y descendientes del host. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/48). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-44

Aislar usuarios y proyectos por organización. **Completada técnica.** Aceptación local/CI; no se acredita migración de datos ni multitenancy en producción. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/49). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-45

Ejecutar servicios de dominio con bases privadas. **Completada técnica.** Procesos, bases privadas y contratos locales; despliegue distribuido pendiente, políticas por tenant no incluidas. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/50). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-46

Componer Shell y seis microfrontends. **Completada técnica.** Shell y seis remotos con build local/CI; no se acreditan seis despliegues productivos independientes. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/51). [Evidencia de versión](https://github.com/SebhastianCampero-Collab/Frontend/actions/runs/40942339109).

### HU-47

Mantener especificaciones y trazabilidad SDD. **Parcial.** Configuración y verificadores listos; falta revisión de constitución y aceptación por el equipo. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/52). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-48

Navegar el segundo cerebro independiente en Obsidian. **Parcial.** Estructura y enlaces comprobados; falta revisión visual del equipo y ensayo de navegación para defensa. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/53). [Evidencia de versión](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/actions/runs/40947798822).

### HU-49

Importar y recuperar un repositorio GitHub. **Completada técnica.** Importa sin instalar dependencias; reclona conservando ID. El checkout cloud sigue siendo efímero. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/54). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-50

Verificar reparaciones de proyectos externos en sandbox. **Parcial.** Siete pruebas Docker aprobadas en CI; falta ejecutor cloud y publicación de los PRs. No es una reparación generativa real. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/55). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

### HU-51

Aplicar hooks y especialistas al asistente de desarrollo. **Parcial.** Adaptador y cuatro perfiles probados; falta evidencia de activación y una sesión real del asistente. [Issue](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/56). [Evidencia de versión](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149).

## Requisitos de esta regularización

| Requisito | Salida verificable |
|---|---|
| FR-001 | 51 HU únicas, HU-01 a HU-43 preservadas, estados y límites |
| FR-002 | Cabecera con métricas y SHAs; distinción entre CI general y job Docker |
| FR-003 | Recorrido actual sin botones de demo retirados |
| FR-004 | Tabla por HU con issue, código y evidencia; especificación/plan retrospectivos identificados |
| FR-005 | Issues con registro retrospectivo o planificación actual; sin autores ni fechas históricas inventadas |
| FR-006 | Copia de backlog en la bóveda y verificación de correspondencia |

## Relaciones explícitas con PRs

Registro del 29/10/2026, comprobado contra archivos y estados de GitHub. Un vínculo documental no prueba implementación ni despliegue. Cada issue contiene el alcance concreto y cada PR actual enlaza de vuelta los issues. Ningún estado de HU se cambia al registrar estas referencias.

| HU | Issue | PR y tipo de relación |
|---|---|---|
| HU-01 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/6) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-02 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/7) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-03 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/8) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-04 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/9) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-05 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/10) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-06 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/11) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-07 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/12) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-08 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/13) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-09 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/14) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/2) |
| HU-10 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/15) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/2) |
| HU-11 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/16) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/2) |
| HU-12 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/17) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-13 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/18) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-14 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/19) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-15 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/20) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/2); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/3) |
| HU-16 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/21) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-17 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/22) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-18 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/23) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-19 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/24) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-20 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/25) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-21 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/26) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/2); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/3) |
| HU-22 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/27) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-23 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/28) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-24 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/29) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/2) |
| HU-25 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/30) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1); [documentación histórica](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/4) |
| HU-26 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/31) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1); [documentación histórica](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/4) |
| HU-27 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/32) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-28 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/33) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-29 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/34) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-30 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/35) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-31 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/36) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [controles de interfaz](https://github.com/SebhastianCampero-Collab/Frontend/pull/1) |
| HU-32 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/37) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-33 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/38) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-34 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/39) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-35 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/40) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-36 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/41) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-37 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/42) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-38 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/43) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [controles de interfaz](https://github.com/SebhastianCampero-Collab/Frontend/pull/1) |
| HU-39 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/44) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-40 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/45) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-41 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/46) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-42 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/47) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-43 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/48) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración histórica de archivo](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/1) |
| HU-44 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/49) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-45 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/50) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-46 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/51) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-47 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/52) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-48 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/53) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |
| HU-49 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/54) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [controles de interfaz](https://github.com/SebhastianCampero-Collab/Frontend/pull/1) |
| HU-50 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/55) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [integración y verificación](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5); [controles de interfaz](https://github.com/SebhastianCampero-Collab/Frontend/pull/1) |
| HU-51 | [Seguimiento](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/56) | [documentación retrospectiva](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) |

Para historias sin un PR histórico específico comprobado se conserva el commit de código y el PR de regularización documental; no se inventa un PR original. Los PRs históricos integrados permanecen sin editar. La instantánea de archivos/estados está en pull-requests.json.

## Dos incrementos finales seleccionados

| Incremento | HU e issue principal | Aceptación | Estado del corte |
|---|---|---|---|
| INC-01 Gestión segura de organizaciones y accesos | [HU-44](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/49) | [INC-01-AC01 a INC-01-AC06](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/006-final-increments/spec.md#inc-01-gestión-segura-de-organizaciones-y-accesos) | Implementación local/CI; ensayo final y aceptación docente pendientes |
| INC-02 Espacio de trabajo modular con microfrontends | [HU-46](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/51) | [INC-02-AC01 a INC-02-AC06](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/006-final-increments/spec.md#inc-02-espacio-de-trabajo-modular-con-microfrontends) | Implementación local/CI; ensayo final y aceptación docente pendientes |

[Antes/después](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/006-final-increments/evidence.md) y [demostración](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/006-final-increments/demo.md). Los vínculos a PRs de la sección anterior mantienen su alcance documental/histórico; esta selección no crea un PR original de implementación ni cambia las 51 historias y sus estados.
