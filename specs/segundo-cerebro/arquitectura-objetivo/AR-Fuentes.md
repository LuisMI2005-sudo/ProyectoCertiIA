---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/arquitectura]
---

# Fuentes y decisiones pendientes

> Diseño objetivo, no implementación. Los cambios de aplicación requieren migración y verificación.

## Fuentes primarias consultadas

- [PostgreSQL: RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html): roles y controles por fila. Se cita la documentación de PostgreSQL 18; validar la versión real del servidor antes de aplicar DDL.
- [Microsoft: datos en microservicios](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations): propiedad de datos y consistencia distribuida.
- [Module Federation: React Bridge](https://module-federation.io/guide/bridge/react/getting-started): integración y dependencias compartidas; validar compatibilidad con las versiones instaladas.

La topología, la definición de tenant y las pruebas de DevGuardian son decisiones de esta propuesta. No se atribuyen al PDF de antecedentes ni a estas fuentes como si ellas describieran el proyecto.

## ADR pendientes de cerrar

Proveedor OIDC, infraestructura de ejecutores, broker, retención, dominios/cookies/CSRF, versión PostgreSQL, compatibilidad Vite/federación, costos por tenant y objetivos de rendimiento. No instalar paquetes ni contratar infraestructura a partir de un supuesto documental.


[Volver al índice](00-Arquitectura-Objetivo.md)
