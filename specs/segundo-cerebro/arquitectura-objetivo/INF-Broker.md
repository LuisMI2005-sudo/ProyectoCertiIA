---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: infraestructura
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/infraestructura]
---

# Broker, outbox e inbox

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

Proveedor por seleccionar; el contrato exige eventos de integración al menos una vez, por lo que los consumidores deben deduplicar por tenant_id y event_id. No prometer entrega exactamente una vez.

Un cambio de dominio y su outbox se confirman en una transacción local. Un publicador reintenta con backoff; el consumidor registra inbox y proyección en su propia transacción. TTL, retención, DLQ y permisos deben presupuestarse. Los mensajes llevan referencias mínimas, no claves ni fuente completa.

Orden por agregado y aggregateVersion cuando se necesite. Detectar huecos y reconciliar. Un evento recibido tarde no permite sobrescribir un estado más nuevo. No usar la cola como lock distribuido del workspace.

## Relaciones

- [BE-Auditorias](BE-Auditorias.md)
- [BE-Telemetria](BE-Telemetria.md)
- [AR-Patrones](AR-Patrones.md)
- [INF-Contratos](INF-Contratos.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
