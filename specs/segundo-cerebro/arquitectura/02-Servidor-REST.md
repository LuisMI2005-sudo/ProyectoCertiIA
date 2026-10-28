---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/arquitectura, dg/modulos]
---

# Servidor REST y coordinación

La API recibe solicitudes, valida contratos, resuelve el proyecto y coordina operaciones del dominio. El dashboard no tiene acceso directo a PostgreSQL. Las rutas de diagnóstico y reparación tienen comportamientos diferentes.

## Evidencia y alcance

src/server/application.ts; src/server/http.ts.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Persistencia: proyectos, auditorías y trazas](11-Persistencia.md)
- [Subagentes deterministas y coordinador](08-Subagentes.md)
- [Importación GitHub y progreso SSE](13-Importacion-GitHub.md)
- [Concepto relacionado](../05-Arquitectura-y-patrones.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
