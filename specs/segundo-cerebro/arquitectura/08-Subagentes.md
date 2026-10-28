---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/ia, dg/modulos]
---

# Subagentes deterministas y coordinador

Los roles diagnostic, verification y patch-safety delegan a workers con contexto y capacidades acotadas. No necesitan LLM. No confundir perfiles IDE con estos tres roles ni suponer que cada endpoint produce trazas de todos los roles.

## Evidencia y alcance

src/subagents/coordinator.ts; src/subagents/runtime.ts; src/subagents/specialists.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Analyzer: AST y ESLint](05-Analyzer.md)
- [Test Runner: ejecuciones comparables](07-Test-Runner.md)
- [Hooks y guardrails del motor](09-Hooks.md)
- [Persistencia: proyectos, auditorías y trazas](11-Persistencia.md)
- [Concepto relacionado](../09-IA-y-workers.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
