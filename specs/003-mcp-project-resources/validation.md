# Validación — 2026-10-30

Rama: `feat/mcp-project-resources`, base integrada `5ba0c46ab46bc4b3d2d45d1b0d9d23723ce2d9eb`. Entorno Windows, Node 24 y SDK MCP 1.32.1. Pruebas con repositorios propios y datos ficticios; no se modificó el despliegue público.

| Comprobación | Resultado observado |
|---|---|
| `npm run build` | Aprobado |
| `npm run check` | TypeScript y ESLint aprobados |
| Jest: server/resources, server/server, mcp-server/server, analyzer/analyzer | 4 suites, 90 pruebas aprobadas en 192.815 s (antes de añadir el caso de error interno y optimizar el tsconfig de ensayo) |
| Jest: platform/postgres con PostgreSQL local real | 9 pruebas aprobadas en 16.849 s; incluye catálogo/lectura por gateway, rechazo entre tenants y POST resources/list rechazado para viewer |
| Suite definitiva `tests/server/resources.test.mjs` | 13 pruebas aprobadas en 71.816 s, incluido error interno saneado; 100 pruebas distintas aprobadas entre las cinco suites comprobadas |
| `npm run sdd:check` | Aprobado; comprobación estructural, no revisión visual de Obsidian |

La suite de recursos usa clientes oficiales HTTP y stdio. Verifica listado y plantillas, configuración con campos explícitos, estructura con exclusión de secretos ficticios/enlaces, persistencia de caché entre clientes, cruce de proyectos, ID desconocido, TTL, expulsión de la capacidad real de 100 entradas, raíz cambiada, checkout ausente, URIs/cursors inválidos, paginación de 52 recursos y bearer HTTP.

Durante la preparación se detectaron dos errores de fixture: faltaba commit inicial y el límite de salida del runner estaba por debajo del mínimo de 1024 bytes. Se corrigió la preparación, sin relajar contratos del producto. Para la prueba de capacidad se usa tsconfig sin bibliotecas: se sigue expulsando tras 101 análisis reales por MCP, evitando cargar bibliotecas ajenas al caso de sintaxis.

Consultar [spec.md](spec.md) y el [contrato de recursos](../../src/mcp/README.md). El servidor de compatibilidad mantiene sus tres pruebas originales. No se acredita caché persistente tras reinicio ni corrección de autenticación/CORS de producción. La integración en Dev y el despliegue requieren su paso posterior; el corte histórico del backlog del 29/10 no cambia retrospectivamente.
