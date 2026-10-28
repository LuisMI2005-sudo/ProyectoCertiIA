---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: datos
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/datos]
---

# Base relacional: Identidad y organizaciones

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

## Propiedad y tenant

Propietario: [BE-Identidad](BE-Identidad.md). Base PostgreSQL lógica privada por servicio. Pueden compartir un clúster al principio con bases y roles separados; no implica siete servidores físicos. No existe una cuenta SQL compartida entre servicios.

El catálogo tenants pertenece al plano de control: su ID es la frontera de tenant. memberships usa tenant_id y subject_id. Acciones administrativas globales necesitan un rol separado, nunca el acceso genérico del tenant.

## Modelo mínimo propuesto

Este ER muestra una relación local central, no una migración exhaustiva. Cada servicio podrá añadir tablas de dominio, outbox, inbox y claves de idempotencia sin permitir joins entre bases.

```mermaid
erDiagram
  tenants ||--o{ memberships : agrupa
  tenants {
    uuid id PK
    text name
  }
  memberships {
    uuid tenant_id PK,FK
    text subject_id PK
    text role
  }
```

## Integridad y acceso

FK solo dentro de esta base. Referencias a proyectos, usuarios o auditorías de otros servicios se validan por contrato/proyección; no se crean FK a otra base. RLS, roles separados y transacciones con contexto tenant se detallan en [multitenancy](AR-Multitenancy.md).



## Verificaciones

Insertar, leer, actualizar y eliminar con tenant A nunca accede a B. Cambiar tenant en el body no elude autorización. Las conexiones reutilizadas del pool no heredan el contexto anterior. Las rutas administrativas se prueban aparte.

## Relaciones

- [BE-Identidad](BE-Identidad.md)
- [AR-Multitenancy](AR-Multitenancy.md)
- [AR-Datos-y-migracion](AR-Datos-y-migracion.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
