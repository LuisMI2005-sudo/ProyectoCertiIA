---
proyecto: DevGuardian
tipo: evaluacion-integral
fecha: 2026-10-28
estado: documento-de-evaluacion
tags: [devguardian, dg/arquitectura]
---

# Evaluación arquitectónica y hoja de ruta

## Actual frente a objetivo

| Área | Actual documentado/observado | Objetivo solicitado | Decisión de evaluación |
| --- | --- | --- | --- |
| Backend | Node/TypeScript modular con REST y MCP | 7 dominios y BFF | Extraer progresivamente, no dividir cada carpeta por razones estéticas |
| Datos | PostgreSQL o JSON local, cinco tablas base | PostgreSQL privado por servicio y multitenant | Iniciar por propiedad de datos y aislamiento, no por replicar bases sin controles |
| Frontend | React/Vite integrado | Shell y seis remotos | Spike de compatibilidad, contratos y pipeline independiente antes de migrar todas las pantallas |
| Seguridad | Guardrails, rutas y evidencia, autenticación opcional | Identidad por organización y aislamiento operativo | No vender aislamiento todavía no probado |
| IA | Cliente generativo CLI y workers deterministas separados | Planner acotado por contratos | El modelo propone; Ejecución autoriza y comprueba |

Fortalezas: contratos compartidos, separación de responsabilidades, pruebas, evidencia de reparación y presentación por etapas. Riesgos: complejidad distribuida, costo operacional, consistencia eventual, fuga entre tenants y compatibilidad de remotos.

## SOLID y patrones

La evaluación usa la [matriz SOLID](../arquitectura-objetivo/AR-SOLID.md) y el [catálogo de patrones](../arquitectura-objetivo/AR-Patrones.md), que incluyen criterios de aceptación. No se acredita cumplimiento exhaustivo de SOLID por tener interfaces. Los casos de uso, contratos y dependencias concretas deben revisarse durante la extracción.

## Prioridad de migración

1. Tenant, autenticación, contratos y pruebas de frontera.
2. Ejecución segura con journal y evidencia autoritativa.
3. Dominios privados, outbox/inbox y consultas.
4. Shell y un remoto piloto; después el resto.
5. Medición de costo, disponibilidad y aceptación antes del corte.

El [plan arquitectónico detallado](../arquitectura-objetivo/AR-Migracion.md) conserva etapas y criterios; no asigna plazos inventados.

```mermaid
flowchart LR
  A["Aplicación modular actual"] --> B["Identidad y aislamiento tenant"]
  B --> C["Ejecución y contratos"]
  C --> D["Servicios con datos privados"]
  D --> E["Shell y microfrontends"]
  E --> F["Piloto con métricas"]
```


[Índice del informe](00-Informe-Integral.md)
