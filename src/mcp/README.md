# Recursos del servidor MCP principal

`npm run start:mcp` sirve stdio; `/api/mcp` sirve Streamable HTTP. Ambos usan los mismos handlers de herramientas y recursos. Después de `npm run build`, un cliente oficial MCP puede llamar `listResources()`, `listResourceTemplates()` y `readResource({ uri })`.

| URI | Contenido JSON |
|---|---|
| `devguardian://project/{projectId}/configuration` | projectId, name, defaultBranch, runnerType, serverVersion |
| `devguardian://project/{projectId}/structure` | projectId, files con path relativo/analyzable, truncated |
| `devguardian://analysis/{analysisId}?projectId={projectId}` | projectId y resultado previo de analyze_code |

Usar UUID reales de `db_list_projects` y el `analysisId` devuelto por `analyze_code` sobre ese mismo proyecto. El `projectId` de análisis es obligatorio; no se admite un URI sin ámbito en el servidor principal. El servidor histórico `src/mcp-server/` mantiene su contrato de compatibilidad independiente.

El catálogo enumera configuración y estructura, hasta 50 entradas por página. Si responde `nextCursor`, pasarlo sin modificar a la siguiente llamada. Las tres plantillas son un catálogo fijo sin paginación. No se anuncian suscripciones ni notificaciones de cambios.

Las lecturas comprueban registro del proyecto y raíz canónica. No aceptan rutas ni raíces del cliente. La estructura reutiliza exclusiones de secretos y metadatos Git, enlaces, profundidad, tiempo y número de archivos de `server/project-files.ts`; revisar `truncated`. La configuración nunca devuelve entorno, comandos, credenciales, URL remota ni ruta absoluta.

La caché de análisis pertenece al backend y proyecto, por lo que se conserva entre conexiones HTTP del mismo proceso. Límites actuales del analizador: 100 análisis, 10 MB totales y TTL fijo de 5 minutos con expulsión LRU. Leer no renueva el TTL ni vuelve a analizar. Reiniciar o reclonar invalida los resultados; no es historial SQL persistente.

Errores MCP: URI/cursor inválido `-32602`; proyecto inaccesible o análisis desconocido/expirado/expulsado `-32002`, con código de dominio seguro en `data.code`; fallo interno `-32603` sin detalles sensibles. Un checkout ausente devuelve `WORKSPACE_UNAVAILABLE`. Las lecturas no crean auditorías ficticias de tools/call.

HTTP hereda el bearer configurado. El gateway conserva membresía/tenant y rechazo de POST MCP para viewer. La autenticación opcional del servidor independiente y CORS público son hallazgos de seguridad separados; estos recursos no los solucionan.

[Especificación y pruebas](../../specs/003-mcp-project-resources/spec.md). Contrato de protocolo: [MCP Resources 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/resources).
