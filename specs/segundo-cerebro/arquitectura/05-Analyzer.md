---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/analisis, dg/modulos]
---

# Analyzer: AST y ESLint

Obtiene contexto acotado y diagnósticos de sintaxis, tipos y calidad. Guarda análisis con límites. Un algoritmo lógicamente incorrecto puede no producir errores estáticos; los checks no acreditan detección universal de vulnerabilidades.

## Evidencia y alcance

src/analyzer/ast-analyzer.ts; src/analyzer/eslint-analyzer.ts; src/analyzer/index.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Contratos, errores y seguridad de rutas](04-Shared.md)
- [Subagentes deterministas y coordinador](08-Subagentes.md)
- [Test Runner: ejecuciones comparables](07-Test-Runner.md)
- [Concepto relacionado](../02-Auditoria-de-codigo.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
