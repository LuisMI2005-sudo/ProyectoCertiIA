---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/verificacion, dg/modulos]
---

# Test Runner: ejecuciones comparables

Ejecuta Jest o pytest con límites y transforma reportes. Compara baseline y candidato; los reportes incompletos o las pruebas omitidas impiden acreditar una reparación exitosa. Ejecutar código externo requiere aislamiento adecuado.

## Evidencia y alcance

src/test-runner/index.ts; src/test-runner/reports.ts; src/test-runner/process.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Git Controller: intentos y evidencia](06-Git.md)
- [Subagentes deterministas y coordinador](08-Subagentes.md)
- [Persistencia: proyectos, auditorías y trazas](11-Persistencia.md)
- [Concepto relacionado](../08-Verificacion-y-regresiones.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
