---
proyecto: DevGuardian
tipo: conocimiento
grupo: direccion
estado: documentado
fecha: 2026-10-28
tags: [devguardian, dg/direccion]
---


# Segundo cerebro de DevGuardian

Mapa de conocimiento basado en el PDF recibido y documentación local del backend. **GameZone es otro proyecto y no comparte estas conclusiones.**

[Cómo abrir el grafo nativo como en GameZone](Guia-Grafo-Nativo.md).

## Dos perspectivas del conocimiento

- Este índice organiza conceptos, antecedentes, seguridad y evidencia.
- El [cerebro de arquitectura y módulos](arquitectura/00-Arquitectura-modulos.md) conecta esos conceptos con la implementación.
- La vista **Graph view** de Obsidian reúne ambas perspectivas con los mismos grupos de colores; el Canvas es una vista complementaria.

## Entradas

- [Fuente: análisis de auditoría de código](01-Fuente-y-procedencia.md)
- [Auditoría de código: teoría y límites](02-Auditoria-de-codigo.md)
- [ACF y DevGuardian: comparación crítica](03-ACF-y-DevGuardian.md)
- [Recursos, contexto y cobertura](04-Recursos-y-contexto.md)
- [Arquitectura, fachada y coordinación](05-Arquitectura-y-patrones.md)
- [MCP y contratos de herramientas](06-MCP-y-contratos.md)
- [Hooks, guardrails y límites de confianza](07-Hooks-y-guardrails.md)
- [Verificación, baseline y regresiones](08-Verificacion-y-regresiones.md)
- [Cliente generativo y workers deterministas](09-IA-y-workers.md)
- [Flujo de reparación con evidencia](10-Flujo-reparacion.md)
- [Preguntas, decisiones y evidencia pendiente](11-Validacion-pendiente.md)

## Grupos y colores

| Grupo | Color | Etiqueta |
| --- | --- | --- |
| direccion | #a78bfa | dg/direccion |
| fuentes | #94a3b8 | dg/fuentes |
| analisis | #60a5fa | dg/analisis |
| arquitectura | #22d3ee | dg/arquitectura |
| seguridad | #f87171 | dg/seguridad |
| verificacion | #34d399 | dg/verificacion |
| investigacion | #fbbf24 | dg/investigacion |
| ia | #f472b6 | dg/ia |

Los colores se repiten en Mermaid, Canvas y reglas del grafo nativo. Los nombres y etiquetas permiten distinguir grupos sin depender solo del color. Abrir [Canvas del conocimiento](Grafo-DevGuardian.canvas).

## Mapa de relaciones

```mermaid
flowchart LR
  F["Fuentes y antecedentes"] --> A["Análisis estático"]
  F --> I["Investigación pendiente"]
  A --> AR["Arquitectura y MCP"]
  AR --> AI["Cliente IA y workers"]
  AI --> S["Guardrails y seguridad"]
  S --> V["Verificación y reparación"]
  V --> I
  classDef fuentes fill:#334155,color:#fff,stroke:#94a3b8
  classDef analisis fill:#1e3a8a,color:#fff,stroke:#60a5fa
  classDef arquitectura fill:#164e63,color:#fff,stroke:#22d3ee
  classDef ia fill:#831843,color:#fff,stroke:#f472b6
  classDef seguridad fill:#7f1d1d,color:#fff,stroke:#f87171
  classDef verificacion fill:#064e3b,color:#fff,stroke:#34d399
  classDef investigacion fill:#713f12,color:#fff,stroke:#fbbf24
  class F fuentes
  class A analisis
  class AR arquitectura
  class AI ia
  class S seguridad
  class V verificacion
  class I investigacion
```


## Uso en la bóveda

Esta documentación reside en la bóveda ProyectoCertiIA, carpeta specs/segundo-cerebro/. Filtrar el grafo con path:"specs/segundo-cerebro" y abrir Grafo-DevGuardian.canvas para ver los grupos ordenados. Ya no existe una copia activa en practica/DevGuardian. El PDF se conserva como fuente secundaria. Si Obsidian solicita permitir Mermaid, el usuario debe aceptar el permiso de confianza.

Fecha de revisión: 2026-10-28. No se ha verificado visualmente el render de estos nuevos grafos.

## Relaciones

- [Fuente de entrada](01-Fuente-y-procedencia.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)


## Arquitectura objetivo solicitada

[Microservicios, PostgreSQL multitenant y microfrontends](arquitectura-objetivo/00-Arquitectura-Objetivo.md). Los módulos actuales permanecen documentados por separado. El objetivo no equivale a una migración ejecutada.


## Evaluación integral para la entrega docente

[Informe de auditoría técnica, arquitectura y propuesta comercial](auditoria-integral/00-Informe-Integral.md). Incluye evidencia local, hallazgos abiertos, comparación actual/objetivo, mercado, venta, costos, marketing y protocolo de validación. La documentación no acredita por sí sola comercialización ni migración implementadas.
