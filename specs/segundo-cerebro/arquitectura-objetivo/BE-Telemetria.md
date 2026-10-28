---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: backend
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/backend]
---

# Microservicio: Telemetría e historial consultable

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

## Responsabilidad y frontera

Proyecta eventos de auditoría, hooks, runs y delegaciones para consultas de UI y flujos SSE.

**Procedencia actual:** src/db/hook_logs y subagent_delegations, consultas de src/server. Esto no convierte las carpetas en microservicios por sí solo: se requieren proceso, contrato, credenciales, pipeline y despliegue propios.

## Contratos y datos

- Entradas de aplicación validadas con Zod y contexto tenant autenticado.
- Propietario exclusivo de [DB-Telemetria](DB-Telemetria.md); ningún otro servicio tiene su usuario SQL.
- Comandos con commandId/idempotencyKey y expectedVersion cuando haya concurrencia.
- Eventos de integración versionados con outbox local e inbox deduplicada en consumidores.
- Tiempos límite, cancelación explícita y correlación sin secretos.

## Regla de seguridad

Autorización por tenant y proyecto, paginación y redacción de datos sensibles. Es eventualmente consistente; un estado retrasado no autoriza commit ni significa que la operación no ocurrió.

## SOLID y patrones aplicados

SRP: este dominio es la razón de cambio. DIP: casos de uso dependen de puertos, no del cliente HTTP/SQL concreto. Adapter y Repository aíslan infraestructura; Outbox solo para cambios que deban publicar eventos. Ver [SOLID](AR-SOLID.md) y [patrones](AR-Patrones.md).

## Criterios de aceptación

Aislamiento entre dos tenants, acceso denegado sin contexto, contrato compatible, reintento sin duplicar efecto y fallo recuperable. Para Ejecución se añaden pruebas de fencing, cancelación, hashes y evidencia de commit.

```mermaid
flowchart LR
  C["Contrato de entrada"] --> S["Telemetría e historial consultable"]
  S --> D["DB-Telemetria: PostgreSQL privado"]
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

- [DB-Telemetria](DB-Telemetria.md)
- [BE-Auditorias](BE-Auditorias.md)
- [BE-Ejecucion](BE-Ejecucion.md)
- [INF-Broker](INF-Broker.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
