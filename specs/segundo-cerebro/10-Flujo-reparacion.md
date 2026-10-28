---
proyecto: DevGuardian
tipo: conocimiento
grupo: verificacion
estado: documentado
fecha: 2026-10-28
tags: [devguardian, dg/verificacion]
---

# Flujo de reparación con evidencia

Este esquema resume condiciones de seguridad; no sustituye los detalles de cada orquestador.

```mermaid
flowchart TD
  R["Solicitud y proyecto válido"] --> A["Diagnóstico estático"]
  A --> P{"¿Reparación autorizada?"}
  P -->|No| D["Devolver hallazgos sin modificar"]
  P -->|Sí| B["Baseline antes del parche y checkpoint válido"]
  B --> H["Hashes, guardrails y parche"]
  H --> C["Candidato y comparación"]
  C --> E{"¿Evidencia suficiente y sin regresión?"}
  E -->|Sí| G["Commit validado"]
  E -->|No| X["Rollback seguro o rechazo"]
  classDef analisis fill:#1e3a8a,color:#fff,stroke:#60a5fa
  classDef seguridad fill:#7f1d1d,color:#fff,stroke:#f87171
  classDef verificacion fill:#064e3b,color:#fff,stroke:#34d399
  class R,A,P,D analisis
  class H,X seguridad
  class B,C,E,G verificacion
```


## Relaciones

- [Controles](07-Hooks-y-guardrails.md)
- [Regresiones](08-Verificacion-y-regresiones.md)
- [Orquestadores](09-IA-y-workers.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)
