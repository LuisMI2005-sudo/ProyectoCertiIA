---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/arquitectura, dg/modulos]
---

# Importación GitHub y progreso SSE

El backend prepara una copia de un repositorio público y valida compatibilidad. El frontend muestra progreso emitido por el servidor. El análisis estático no instala dependencias ni autoriza ejecutar scripts de terceros.

## Evidencia y alcance

src/server/PROJECT_IMPORT.md; Frontend/src/components/GitHubImport.tsx.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Frontend: navegación, formularios y evidencia](01-Frontend.md)
- [Servidor REST y coordinación](02-Servidor-REST.md)
- [Analyzer: AST y ESLint](05-Analyzer.md)
- [Concepto relacionado](../04-Recursos-y-contexto.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
