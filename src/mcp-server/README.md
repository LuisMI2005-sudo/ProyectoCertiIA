# Servidor MCP de compatibilidad — aporte integrado de origin/main

La interfaz principal de la aplicación es [src/mcp/ y la API HTTP](../server/README.md), con 19 herramientas, Test Runner y auditoría durable. Este módulo conserva el aporte de Eduardo: interfaz de diez herramientas sobre un workspace fijo y recurso dinámico de análisis, comprobados por tres tests. No incluye persistencia de llamadas ni runners; no sustituye al servidor principal.

`DevGuardianMcpServer` es el límite de transporte entre un cliente MCP y los servicios de dominio. Valida argumentos con los contratos compartidos y delega en el analizador o el controlador Git.

## Ejecución

```sh
npm run build
DEVGUARDIAN_WORKSPACE=/ruta/al/workspace node dist/mcp-server/index.js
```

El transporte es **stdio**: el protocolo usa stdout y los diagnósticos de arranque stderr. Sin `DEVGUARDIAN_WORKSPACE`, se utiliza el directorio de trabajo actual.

## Superficie MCP

Publica diez herramientas: `read_file_context`, `analyze_code`, `get_symbol_context`, `git_status`, `git_create_fix_branch`, `git_begin_attempt`, `git_apply_patch`, `git_diff`, `git_commit_fix` y `git_rollback_attempt`.

Las respuestas preservan el sobre `{ ok: true, data }` o `{ ok: false, error }` en contenido JSON y salida estructurada. El recurso dinámico `devguardian://analysis/{analysisId}` devuelve resultados de análisis hasta su expiración TTL.

## Seguridad y límites de compatibilidad

La raíz del workspace, límites y proveedores de evidencia se configuran al inicio, nunca mediante herramientas. Se mantienen los controles de rutas, hashes y bloqueo Git de las capas de dominio.

`run_tests` y `compare_test_runs` ya están implementadas y publicadas en el servidor principal, pero no en esta interfaz histórica. Aquí `git_commit_fix` permanece bloqueado por un VerificationStore sin evidencia; para el flujo completo con pruebas, hooks y BD utilizar `node dist/mcp/index.js` o `npm start` (HTTP). El recurso de análisis de esta interfaz reside en memoria y expira por TTL.

## Verificación

`tests/mcp-server/server.test.mjs` conecta cliente y servidor mediante `InMemoryTransport`; verifica descubrimiento, validación, análisis y lectura de recursos.
