---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/seguridad, dg/modulos]
---

# Contratos, errores y seguridad de rutas

Centraliza contratos tipados, esquemas Zod, Result<T> y validación de rutas. Un argumento bien formado no concede por sí solo permisos de escritura. Las rutas deben mantenerse dentro del workspace permitido.

## Evidencia y alcance

src/shared/contracts.ts; src/shared/errors.ts; src/shared/path-security.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Servidor MCP y herramientas](03-MCP.md)
- [Git Controller: intentos y evidencia](06-Git.md)
- [Hooks y guardrails del motor](09-Hooks.md)
- [Concepto relacionado](../07-Hooks-y-guardrails.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
