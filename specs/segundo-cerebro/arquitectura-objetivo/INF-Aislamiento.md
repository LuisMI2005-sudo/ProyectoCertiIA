---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: infraestructura
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/infraestructura]
---

# Aislamiento del código externo

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

Cada workspace pertenece a un tenant y trabajo autorizado. Usar ejecutores aislados con recursos, filesystem, red y ciclo de vida restringidos. Los workers de Node y los subprocesos actuales no son un sandbox del sistema operativo para código hostil.

El repositorio externo y sus scripts no reciben secretos del host ni credenciales de bases de dominio. Concurrencia por tenant y limpieza segura con retención de evidencia. Los secretos del proveedor LLM quedan fuera del ejecutor. La solución de aislamiento concreta requiere un ADR y pruebas antes de habilitar tests de repositorios externos.

## Relaciones

- [BE-Ejecucion](BE-Ejecucion.md)
- [BE-Proyectos](BE-Proyectos.md)
- [AR-Multitenancy](AR-Multitenancy.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
