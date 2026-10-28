---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/seguridad, dg/modulos]
---

# Git Controller: intentos y evidencia

Gestiona ramas fix, checkpoints, parches, hashes y rollback. Confirma cambios únicamente con la evidencia requerida por el contrato. No se debe interpretar el sandbox MCP como una simulación de estas escrituras.

## Evidencia y alcance

src/git-controller/repository.ts; src/git-controller/patch-manager.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Contratos, errores y seguridad de rutas](04-Shared.md)
- [Test Runner: ejecuciones comparables](07-Test-Runner.md)
- [Hooks y guardrails del motor](09-Hooks.md)
- [Concepto relacionado](../10-Flujo-reparacion.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
