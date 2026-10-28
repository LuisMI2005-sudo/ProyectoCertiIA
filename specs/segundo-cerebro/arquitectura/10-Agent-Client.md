---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/ia, dg/modulos]
---

# Agent Client generativo: LangChain y MCP

El cliente CLI usa un proveedor generativo para proponer parches y consume herramientas MCP. Mantiene presupuestos, validación de contexto y verificación. Su existencia no demuestra que el dashboard haya realizado una llamada pagada a Anthropic.

## Evidencia y alcance

src/agent-client/planner.ts; src/agent-client/orchestrator.ts; src/agent-client/mcp-bridge.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Servidor MCP y herramientas](03-MCP.md)
- [Git Controller: intentos y evidencia](06-Git.md)
- [Test Runner: ejecuciones comparables](07-Test-Runner.md)
- [Concepto relacionado](../09-IA-y-workers.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
