---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/arquitectura, dg/modulos]
---

# Frontend: navegación, formularios y evidencia

El frontend React organiza Mis proyectos, Revisar código, Resultados e historial y las opciones avanzadas. Los hooks React cargan estado y evidencia; no sustituyen los guardrails del servidor. El cliente HTTP conecta con REST y MCP.

## Evidencia y alcance

Repositorio hermano Frontend: src/App.tsx, src/api/client.ts, src/hooks/.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Servidor MCP y herramientas](03-MCP.md)
- [Servidor REST y coordinación](02-Servidor-REST.md)
- [Importación GitHub y progreso SSE](13-Importacion-GitHub.md)
- [Concepto relacionado](../06-MCP-y-contratos.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
