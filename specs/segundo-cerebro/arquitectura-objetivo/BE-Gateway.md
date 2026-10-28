---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: backend
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/backend]
---

# Gateway BFF y adaptador MCP

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

Punto de entrada de los microfrontends y clientes MCP. Adapta REST/SSE/MCP a contratos internos sin duplicar reglas de dominio. Es stateless respecto al negocio; no necesita base propia. Una eventual sesión BFF tendrá almacenamiento operacional separado y TTL, no acceso SQL a bases de dominio.

Autenticación OIDC por seleccionar, validación de membresía del tenant, controles de audiencia, límites y correlación. La selección del tenant en UI es una solicitud, no una autorización. El MCP conserva esquemas y guardrails aunque sea entrada avanzada. No se expone acceso arbitrario a shell ni rutas del host.

**Patrones:** BFF/API Gateway, Facade de transporte y Adapter MCP. No es un coordinador omnipotente ni posee la evidencia para confirmar cambios.

## Relaciones

- [BE-Identidad](BE-Identidad.md)
- [BE-Proyectos](BE-Proyectos.md)
- [BE-Auditorias](BE-Auditorias.md)
- [BE-Telemetria](BE-Telemetria.md)
- [BE-Politicas](BE-Politicas.md)
- [MF-Shell](MF-Shell.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
