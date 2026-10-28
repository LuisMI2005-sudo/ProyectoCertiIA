---
proyecto: DevGuardian
tipo: conocimiento
grupo: arquitectura
estado: documentado
fecha: 2026-10-28
tags: [devguardian, dg/arquitectura]
---

# Arquitectura, fachada y coordinación

El resumen menciona Facade y GRASP en ACF. Para DevGuardian, las fachadas públicas y la separación entre transporte y dominio ayudan a localizar responsabilidades. Los patrones se justifican por comportamiento concreto, no por el nombre de una clase.

El diagrama representa responsabilidades a alto nivel. REST y Agent Client no necesariamente recorren los mismos pasos.

```mermaid
flowchart TD
  UI["Frontend React"] --> REST["Servidor REST"]
  REST --> C["Coordinador determinista"]
  C --> W["Workers especializados"]
  CLI["Cliente generativo CLI"] --> MCP["Servidor MCP"]
  MCP --> D["Analyzer, Git y Test Runner"]
  W --> D
  D --> H["Hooks y validación de rutas"]
  REST --> DB["Persistencia local o PostgreSQL"]
  classDef arquitectura fill:#164e63,color:#fff,stroke:#22d3ee
  classDef seguridad fill:#7f1d1d,color:#fff,stroke:#f87171
  classDef ia fill:#831843,color:#fff,stroke:#f472b6
  class UI,REST,C,W,MCP,D,DB arquitectura
  class H seguridad
  class CLI ia
```


## Relaciones

- [MCP y contratos](06-MCP-y-contratos.md)
- [Seguridad](07-Hooks-y-guardrails.md)
- [Workers e IA](09-IA-y-workers.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)
