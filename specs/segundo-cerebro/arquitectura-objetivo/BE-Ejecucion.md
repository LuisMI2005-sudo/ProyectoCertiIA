---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: backend
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/backend]
---

# Microservicio: Ejecución segura del workspace

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

## Responsabilidad y frontera

Agrupa Analyzer, Git Controller, Test Runner y workers confiables. Es dueño de archivos preparados, locks, checkpoints, runs y evidencia autoritativa de comparación.

**Procedencia actual:** src/analyzer, src/git-controller, src/test-runner y src/subagents/runtime.ts. Esto no convierte las carpetas en microservicios por sí solo: se requieren proceso, contrato, credenciales, pipeline y despliegue propios.

## Contratos y datos

- Entradas de aplicación validadas con Zod y contexto tenant autenticado.
- Propietario exclusivo de [DB-Ejecucion](DB-Ejecucion.md); ningún otro servicio tiene su usuario SQL.
- Comandos con commandId/idempotencyKey y expectedVersion cuando haya concurrencia.
- Eventos de integración versionados con outbox local e inbox deduplicada en consumidores.
- Tiempos límite, cancelación explícita y correlación sin secretos.

## Regla de seguridad

Serializar escrituras por tenant y workspace con lease y fencing token. Commit requiere evidencia local completa y comparable del mismo tenant, workspace e intento. Nunca usar la proyección de Telemetría como autorización.

## SOLID y patrones aplicados

SRP: este dominio es la razón de cambio. DIP: casos de uso dependen de puertos, no del cliente HTTP/SQL concreto. Adapter y Repository aíslan infraestructura; Outbox solo para cambios que deban publicar eventos. Ver [SOLID](AR-SOLID.md) y [patrones](AR-Patrones.md).

## Criterios de aceptación

Aislamiento entre dos tenants, acceso denegado sin contexto, contrato compatible, reintento sin duplicar efecto y fallo recuperable. Para Ejecución se añaden pruebas de fencing, cancelación, hashes y evidencia de commit.

```mermaid
flowchart LR
  C["Contrato de entrada"] --> S["Ejecución segura del workspace"]
  S --> D["DB-Ejecucion: PostgreSQL privado"]
  S --> O["Outbox y eventos cuando corresponde"]
  classDef frontend fill:#1e3a8a,color:#fff,stroke:#60a5fa
  classDef backend fill:#7c2d12,color:#fff,stroke:#fb923c
  classDef datos fill:#064e3b,color:#fff,stroke:#34d399
  classDef infraestructura fill:#334155,color:#fff,stroke:#94a3b8
  classDef arquitectura fill:#4c1d95,color:#fff,stroke:#a78bfa
  classDef seguridad fill:#7f1d1d,color:#fff,stroke:#f87171
  class C,S backend
  class D datos
  class O infraestructura
```


## Relaciones

- [DB-Ejecucion](DB-Ejecucion.md)
- [BE-Politicas](BE-Politicas.md)
- [DB-Ejecucion](DB-Ejecucion.md)
- [AR-SOLID](AR-SOLID.md)
- [AR-Flujos](AR-Flujos.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
