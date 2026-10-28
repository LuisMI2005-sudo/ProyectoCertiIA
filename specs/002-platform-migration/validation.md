# Validación de la migración local — 2026-10-28

## Evidencia obtenida

| Verificación | Resultado observado |
|---|---|
| Backend `npm run check` y `npm run build` | TypeScript estricto, ESLint y emisión correctos |
| Plataforma con PostgreSQL real | 15 pruebas aprobadas en 2 suites: seguridad criptográfica, RLS A/B, roles sin bypass, aislamiento de bases, membresías, viewers, idempotencia, eventos y cliente MCP real |
| Shared, analyzer y plataforma antes de añadir el caso MCP final | 88 pruebas aprobadas en 4 suites; no es el total del backend |
| Frontend `npm test -- --maxWorkers 1` | 122 pruebas aprobadas en 14 archivos; se fijó un worker por los timeouts de arranque de forks observados en esta laptop |
| Frontend `npm run check`, `npm run build`, `npm run build:platform` | Correctos; build legacy y Shell con seis bundles ESM separados |
| SDD backend/frontend | Comprobación estructural correcta; no acredita render automático de todos los diagramas |
| Secretos locales | `.platform-local/` y `.platform-pg/` ignorados por Git; configuraciones y login no se añaden al repositorio |

## Prueba visual local

Se abrió la Shell en 5173 y se probó con una cuenta sintética temporal en una organización nueva. Se verificaron login, selección de organización, carga remota de proyectos, selector real de archivos, bloqueo de controles durante la solicitud y transición automática de revisión a resultados. Un archivo TypeScript de un repositorio Git temporal produjo un hallazgo TS2322 y una entrada persistida de historial. Se comprobaron además las vistas remotas de políticas, subagentes y sandbox MCP. La negociación MCP con las 19 herramientas está cubierta por el cliente SDK real en la integración PostgreSQL.

## Incidencias resueltas durante la comprobación

- El sandbox bloqueaba conexiones loopback con EACCES: las pruebas y servidores de validación se ejecutaron con acceso local autorizado.
- El clúster inicial tenía 20 conexiones y se agotaba al ejecutar las pruebas junto a la plataforma abierta. Se configuró el clúster local nuevo para 100 conexiones y 32 MB de buffers y se cerraron pools auxiliares después de cada test. La repetición de las 15 pruebas pasó.
- Se restringieron las credenciales por ruta: una firma de telemetría no puede autorizar escrituras de ejecución.
- Se preservó el contexto de organización y los encabezados MCP al atravesar los proxies.

## Verificaciones no acreditadas

La suite completa anterior del backend y una ejecución combinada con Agent Client quedaron bloqueadas durante varios minutos en subprocesos Git de sus fixtures; se detuvieron únicamente esos procesos. **No se afirma que toda la suite del backend esté en verde.** Tampoco se ejecutó un modelo comercial real, una migración de datos de producción, un despliegue en Render ni el workflow remoto de estos cambios sin publicar.

El perfil local permite validar las fronteras y continuar la migración; no acredita el cierre de los pendientes productivos descritos en [arquitectura](architecture.md).
