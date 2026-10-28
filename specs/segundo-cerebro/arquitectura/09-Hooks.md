---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/seguridad, dg/modulos]
---

# Hooks y guardrails del motor

Interceptan eventos y aplican decisiones allow, block o warn según políticas. Un botón que recarga el historial no ejecuta una intercepción nueva. La seguridad sigue activa en modo sencillo y avanzado.

## Evidencia y alcance

src/hooks/coordinator.ts; src/hooks/builtin-hooks.ts; src/hooks/registry.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Contratos, errores y seguridad de rutas](04-Shared.md)
- [Git Controller: intentos y evidencia](06-Git.md)
- [Subagentes deterministas y coordinador](08-Subagentes.md)
- [Concepto relacionado](../07-Hooks-y-guardrails.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
