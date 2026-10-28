---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/arquitectura, dg/modulos]
---

# Persistencia: proyectos, auditorías y trazas

Los adaptadores mantienen registros en modo local o PostgreSQL. El esquema incluye proyectos, auditorías, ejecuciones de pruebas, hooks y delegaciones. El frontend consume estos datos mediante el backend.

## Evidencia y alcance

src/db/schema.sql; src/db/local-adapter.ts; src/db/postgres-adapter.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Servidor REST y coordinación](02-Servidor-REST.md)
- [Test Runner: ejecuciones comparables](07-Test-Runner.md)
- [Subagentes deterministas y coordinador](08-Subagentes.md)
- [Concepto relacionado](../05-Arquitectura-y-patrones.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
