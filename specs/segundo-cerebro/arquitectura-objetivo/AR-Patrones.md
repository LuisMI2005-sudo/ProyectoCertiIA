---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/arquitectura]
---

# Patrones de diseño e integración

> Diseño objetivo, no implementación. Los cambios de aplicación requieren migración y verificación.

## Catálogo y uso concreto

| Patrón | Dónde | Problema que resuelve | Límite y prueba |
| --- | --- | --- | --- |
| Hexagonal / Ports and Adapters | Cada microservicio | Separar reglas de dominio de REST/MCP/SQL/proveedor | Probar caso de uso sin infraestructura; probar adaptadores aparte |
| Repository + Unit of Work local | Cada base de dominio | Persistencia y cambios/outbox en una transacción | Ninguna transacción ni FK entre bases |
| Strategy + Adapter | Runners, análisis y proveedor LLM | Variar implementación conservando contrato | No crear plugins arbitrarios con permisos del host |
| Chain of Responsibility / Pipeline | Hooks en Ejecución | Evaluar políticas ordenadas y registrar decisiones | Un bloqueo impide la mutación aunque otro hook permita |
| Facade + BFF | REST/MCP y composición web | Presentar contratos estables a clientes | No duplicar reglas de commit ni conectar todas las bases |
| Saga orquestada | Auditorías | Reparación distribuida recuperable | Rollback Git es compensación limitada, no undo universal |
| Outbox + Inbox | Servicios que publican y consumen cambios | Evento ligado a cambio local y deduplicación | Entrega al menos una vez; fallos y reprocesado no duplican efectos |
| CQRS de lectura | Telemetría | Consultar historial sin bloquear ejecución | Proyección retrasada nunca autoriza commit |
| State machine + Command journal | Ejecución y Auditorías | Reanudar, cancelar y resolver timeouts ambiguos | Consultar commandId antes de reenviar una mutación |
| Lease + Fencing y workspace quarantine | Ejecución | Evitar dos escritores y rechazar dueños vencidos | Git no valida un fencing token remoto: detener/quarantinar ejecutor antes de reutilizar ruta |
| Error Boundary + composición | Shell y remotos | Fallo de un remoto sin derribar la navegación | No es aislamiento de seguridad entre microfrontends |

## Reintentos y fallos

Timeouts y backoff con jitter solo en operaciones seguras o idempotentes. Circuit breaker limita presión ante dependencias caídas; no convierte un fallo de seguridad en permiso. No reintentar ciegamente git_apply_patch ni commit. No añadir un event bus interno por cada llamada de función.

Los patrones se incorporan donde exista su problema; no deben multiplicar abstracciones sin justificación. Registrar ADRs, alternativas, costo operacional y prueba que acredita el comportamiento.

Consultar [Datos en microservicios](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations) para el principio de propiedad privada por servicio. La selección concreta de patrones anterior es la propuesta de DevGuardian.


[Volver al índice](00-Arquitectura-Objetivo.md)
