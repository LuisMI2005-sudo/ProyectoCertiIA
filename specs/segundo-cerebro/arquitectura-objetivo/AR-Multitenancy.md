---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/datos]
---

# Datos relacionales multitenant

> Diseño objetivo, no implementación. Los cambios de aplicación requieren migración y verificación.

## Decisión de tenant

Un tenant es una organización/equipo propietario de proyectos y auditorías. No es un usuario ni cada proyecto: un usuario puede pertenecer a varios tenants y un tenant puede tener varios proyectos. La UI solicita la organización; el backend comprueba pertenencia, rol y acceso al proyecto en cada operación. El proveedor de identidad y el flujo de alta quedan por seleccionar.

## Modelo de aislamiento

PostgreSQL por servicio, esquema de negocio compartido por sus tenants, tenant_id obligatorio por fila, restricciones compuestas y RLS como defensa adicional. Identidad es dueña del catálogo global de tenants; cada base de dominio guarda tenant_id como referencia lógica, sin FK remota. Usar UUID globales no reemplaza la autorización tenant.

## Reglas verificables

1. PK o UNIQUE en (tenant_id, id); unicidad de nombres/slugs dentro de tenant según dominio.
2. FK entre filas tenantizadas incluye tenant_id; no se admiten referencias locales entre A y B.
3. Roles runtime separados por servicio, sin SUPERUSER ni BYPASSRLS y sin ser propietarios; migrador separado.
4. Habilitar y forzar RLS donde corresponda. Rutas administrativas globales se aíslan y auditan.
5. El backend inicia una transacción, valida contexto y establece el tenant con set_config(..., true), equivalente a un valor local a la transacción; nunca usar SET persistente en conexiones del pool.
6. Falta de contexto deniega acceso. El request HTTP no puede elegir libremente app.tenant_id ni ejecutar SQL. RLS con una variable de sesión no protege contra un servicio comprometido con capacidad de fijarla arbitrariamente: controlar puertos de datos, credenciales y consultas parametrizadas.
7. Contexto tenant también en claves de caché, objetos, colas, leases y telemetría. Prohibido cachear solo por projectId.

## Ejemplo de referencia, no migración ejecutada

Se muestra una tabla conceptual de Proyectos. Requiere definir roles, grants, DDL completo, policies adicionales y pruebas antes de producción.

```sql
CREATE TABLE projects_example (
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (tenant_id, project_id),
  UNIQUE (tenant_id, name)
);
ALTER TABLE projects_example ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects_example FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON projects_example
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

Las consultas usan parámetros y conexión de rol runtime. La transacción usa set_config con el tenant autorizado; una cadena UUID mal formada se rechaza antes de acceder a datos. Un rollback elimina el contexto local. RLS no se presenta como una funcionalidad ya existente en el esquema actual.

## Matriz mínima de pruebas

| Escenario | Resultado requerido |
| --- | --- |
| A intenta leer o mutar registro de B | Sin acceso y sin cambios |
| A cambia tenantId del body/header | Revalidación y rechazo si no es miembro |
| Falta contexto de sesión SQL | Denegación, nunca acceso global |
| Pool sirve A y después B | Ningún dato ni contexto residual |
| A publica evento falso de B | Autenticación/audiencia/tenant invalidan mensaje |
| Operación administrativa | Solo rol especial y registro explícito |

Fundamento técnico: [PostgreSQL RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html). El ejemplo de organización, los límites y las pruebas son decisiones de diseño de DevGuardian.


[Volver al índice](00-Arquitectura-Objetivo.md)
