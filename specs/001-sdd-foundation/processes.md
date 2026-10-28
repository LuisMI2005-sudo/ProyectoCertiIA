# Procesos actuales

El flujo de reparación exige autorización, evidencia y estado Git válido. El diagnóstico solo no crea rama ni commit. El diagrama es un resumen conceptual del motor, no una afirmación de que cada operación pase por todos los workers.

```mermaid
flowchart TD
  A["Solicitud validada"] --> B["Diagnóstico"]
  B --> C{"¿Reparación autorizada?"}
  C -->|No| D["Devolver diagnóstico sin cambios"]
  C -->|Sí| E["Baseline y rama aislada"]
  E --> F["Guardrails y parche"]
  F --> G["Pruebas candidato y comparación"]
  G --> H{"¿Verificación válida?"}
  H -->|Sí| I["Commit con evidencia"]
  H -->|No| J["Rollback o rechazo seguro"]
```
