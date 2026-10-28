---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/arquitectura, dg/modulos]
---

# Servidor MCP y herramientas

Publica el catálogo de herramientas y valida llamadas. El transporte no elimina controles de dominio. La entrada MCP configurada en package.json usa src/mcp. También existe src/mcp-server con otra implementación; su presencia no demuestra que se esté ejecutando un segundo servidor. Revisar el comando de arranque antes de describir el transporte activo.

## Evidencia y alcance

src/mcp/server.ts; src/mcp/index.ts; src/mcp-server/index.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Contratos, errores y seguridad de rutas](04-Shared.md)
- [Analyzer: AST y ESLint](05-Analyzer.md)
- [Git Controller: intentos y evidencia](06-Git.md)
- [Test Runner: ejecuciones comparables](07-Test-Runner.md)
- [Concepto relacionado](../06-MCP-y-contratos.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
