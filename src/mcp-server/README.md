# Servidor MCP — Fase 5

`DevGuardianMcpServer` es el límite de transporte entre un cliente MCP y los servicios de dominio. Valida argumentos con los contratos compartidos y delega en el analizador o el controlador Git.

## Ejecución

```sh
npm run build
DEVGUARDIAN_WORKSPACE=/ruta/al/workspace npm run start:server
```

El transporte es **stdio**: el protocolo usa stdout y los diagnósticos de arranque stderr. Sin `DEVGUARDIAN_WORKSPACE`, se utiliza el directorio de trabajo actual.

## Superficie MCP

Publica diez herramientas: `read_file_context`, `analyze_code`, `get_symbol_context`, `git_status`, `git_create_fix_branch`, `git_begin_attempt`, `git_apply_patch`, `git_diff`, `git_commit_fix` y `git_rollback_attempt`.

Las respuestas preservan el sobre `{ ok: true, data }` o `{ ok: false, error }` en contenido JSON y salida estructurada. El recurso dinámico `devguardian://analysis/{analysisId}` devuelve resultados de análisis hasta su expiración TTL.

## Seguridad y fase pendiente

La raíz del workspace, límites y proveedores de evidencia se configuran al inicio, nunca mediante herramientas. Se mantienen los controles de rutas, hashes y bloqueo Git de las capas de dominio.

`run_tests` y `compare_test_runs` pertenecen a la Fase 4 y no se exponen aún. Por tanto, `git_commit_fix` no confirma cambios sin evidencia de pruebas real: falla de forma segura hasta que se inyecte un `VerificationStore` de la Fase 4.

## Verificación

`tests/mcp-server/server.test.mjs` conecta cliente y servidor mediante `InMemoryTransport`; verifica descubrimiento, validación, análisis y lectura de recursos.
