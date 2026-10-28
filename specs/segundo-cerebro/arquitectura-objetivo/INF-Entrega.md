---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: infraestructura
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/infraestructura]
---

# CI y entrega independiente

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

Cada servicio y remoto necesita build, check de tipos/lint, pruebas de contratos y pruebas de aislamiento tenant. Los remotos necesitan smoke tests dentro del Shell, compatibilidad de dependencias compartidas y rollback de manifest/versiones.

Base de datos: migraciones expand/contract por servicio con respaldo y plan de reversión. La CI no ejecuta SQL de producción ni cobra al proveedor LLM. Trazabilidad correlaciona tenant y operación con redacción de datos.

El despliegue actual de Render y sus variables no demuestra que esta distribución exista. Decidir costos, capacidad, certificados y plataforma antes de desplegar. Mantener temporalmente el monolito modular detrás de la fachada durante la migración.

## Relaciones

- [AR-Migracion](AR-Migracion.md)
- [INF-Contratos](INF-Contratos.md)
- [AR-Microfrontends](AR-Microfrontends.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
