---
proyecto: DevGuardian
tipo: guia
estado: diseno-no-implementado
tags: [devguardian, dg/objetivo, dg/capa/arquitectura]
---

# Abrir los grafos de arquitectura objetivo

En Obsidian, seleccionar la bóveda ProyectoCertiIA.

- Abrir Graph view y filtrar con path:"specs/segundo-cerebro/arquitectura-objetivo" para ver el diseño solicitado.
- Para reunir conceptos, módulos actuales y objetivo, usar path:"specs/segundo-cerebro".
- Las categorías son frontend azul, backend naranja, datos verde, infraestructura gris, arquitectura violeta y seguridad roja.
- Abrir [Canvas por categorías](Arquitectura-Objetivo.canvas) como vista ordenada independiente de las preferencias del grafo nativo.
- El [preset](grafo-objetivo.json) conserva filtro y colores en un archivo versionable; .obsidian/ es configuración personal ignorada por Git.

## Estado de la revisión

Se verificaron todos los enlaces, categorías, nodos y aristas del Canvas. El 2026-10-28 se cerró y reabrió Obsidian para cargar las reglas de color y se comprobó visualmente el grafo nativo: frontend azul, backend naranja, datos verde, infraestructura gris, arquitectura violeta y seguridad roja. La revisión visual de cada diagrama Mermaid sigue siendo una comprobación separada.

La configuración local del grafo está cargada en .obsidian/graph.json y conserva los grupos anteriores. Se añadieron seis reglas de categoría y dos reglas para las vistas Canvas, que no contienen tags YAML. Al actualizar archivos de configuración externamente, cerrar primero la bóveda evita que la configuración antigua en memoria los sobrescriba. Los colores del Canvas y de Mermaid están embebidos en los documentos y no dependen de ese estado. No se aceptaron permisos de seguridad ni se habilitaron plugins.

[Índice de arquitectura](00-Arquitectura-Objetivo.md).
