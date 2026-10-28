---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: infraestructura
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/infraestructura]
---

# Contratos, correlación y compatibilidad

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

Contratos HTTP/eventos versionados y validados con Zod. Comandos y eventos transportan tenantId validado internamente, correlationId, causationId, eventId/commandId, aggregateId y aggregateVersion. Los servicios revalidan audiencia y permisos; confiar en un header arbitrario del gateway no es suficiente.

Timeout HTTP no implica fracaso ni autoriza reenviar una mutación ciegamente: consultar commandId. IdempotencyKey se indexa por tenant y operación; un mismo identificador con payload diferente debe rechazarse.

OpenAPI para REST, catálogo MCP para herramientas y contratos de eventos para mensajería; pruebas consumidor/proveedor. SSE transmite eventos persistidos y cursor last-event-id para reconexión; la UI no inventa porcentajes. No publicar stack traces, tokens ni rutas sensibles en respuestas.

## Relaciones

- [BE-Gateway](BE-Gateway.md)
- [INF-Broker](INF-Broker.md)
- [AR-Flujos](AR-Flujos.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
