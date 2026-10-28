---
proyecto: DevGuardian
tipo: guia
tags: [devguardian, dg/direccion]
---

# Grafo nativo: conceptos y arquitectura

## Abrir como en GameZone

1. Seleccionar la bóveda ProyectoCertiIA.
2. Pulsar el icono de nodos conectados de la barra izquierda: Open graph view.
3. En los ajustes del grafo, Filters, usar path:"specs/segundo-cerebro".
4. Los grupos dg/ dan color a fuentes, análisis, arquitectura, seguridad, verificación, IA, investigación y dirección.
5. Girar la rueda para ampliar o alejar; pasar sobre un nodo muestra su nombre y relaciones; hacer clic abre la nota.

## Dos perspectivas del mismo proyecto

- [Conceptos y antecedentes](00-Segundo-cerebro.md): lectura crítica de la fuente y conceptos de auditoría.
- [Arquitectura y módulos](arquitectura/00-Arquitectura-modulos.md): responsabilidades y colaboración de componentes reales.

Los vínculos entre notas forman el grafo de manera nativa. No se enlaza todo con todo para dar una falsa apariencia de complejidad. Una arista representa una relación documentada, no una llamada observada ni una dependencia necesariamente directa en tiempo de ejecución.

GameZone conserva su grafo independiente en la bóveda practica. No se mezclaron sus requisitos con DevGuardian.

## Configuración y evidencia

La configuración local vive en .obsidian/graph.json y permanece ignorada por Git. El [preset de filtros y colores](grafo-nativo.json) documenta los valores portables, sin publicar el estado personal de la ventana. Los ajustes de Graph view pueden cambiarse desde la interfaz y se guardan localmente. No requiere plugins ni aceptar el permiso de Mermaid: este grafo se basa en enlaces Markdown.

El 2026-10-28 se observó la vista nativa con categorías coloreadas y notas de conceptos y módulos. Se verificaron los enlaces con sdd:check. No se cambiaron fuentes de la aplicación. El [Canvas](Grafo-DevGuardian.canvas) y los diagramas Mermaid siguen siendo vistas complementarias.
