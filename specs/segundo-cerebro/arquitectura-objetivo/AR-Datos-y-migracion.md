---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/datos]
---

# Propiedad de datos y migración relacional

> Diseño objetivo, no implementación. Los cambios de aplicación requieren migración y verificación.

## Estado actual comprobado

El esquema src/db/schema.sql tiene cinco tablas de dominio y no incluye tenant_id ni policies RLS. El modo local JSON no demuestra aislamiento multitenant de PostgreSQL. La versión actual debe seguir operativa mientras se prepara la migración.

## Distribución propuesta

| Datos actuales o nuevos | Propietario objetivo | Integridad |
| --- | --- | --- |
| Tenants y membresías nuevos | Identidad | Plano de control y membresías restringidos |
| projects y preparación | Proyectos | Claves y unicidad tenantizadas |
| audit_sessions, estados y saga | Auditorías | Referencias lógicas a ejecuciones; sin FK remota |
| test_runs, intentos y evidencia de comparación | Ejecución | FK tenant/workspace/attempt y hashes/versiones |
| hook_logs y subagent_delegations consultables | Telemetría | Proyecciones de eventos; evidencia original en Ejecución |
| Políticas versionadas nuevas | Políticas | Versión y asignación autorizada por tenant |
| Trabajos del planificador nuevos | Planificador IA | Presupuesto y referencias redactadas |

## Migración segura

1. Respaldar y ensayar la restauración. Identificar a quién pertenecen los registros existentes; no asignar todos a un tenant público.
2. Añadir tenant_id inicialmente con backfill controlado, resolver ambigüedades y medir filas sin propietario.
3. Crear índices, UNIQUE y FK compuestas locales. Sustituir accesos sin tenant y rechazar contexto ausente.
4. Habilitar RLS/roles y validar ataques cruzados A/B con usuario runtime real.
5. Extraer un dominio por vez, copiar/verificar conteos y hashes de registros; evitar doble escritura no transaccional.
6. Cambiar propietarios y retirar FK antiguas solo cuando el nuevo contrato valide el vínculo y la lectura anterior deje de ser autoridad.
7. Publicar eventos vía outbox, comprobar reconstrucción de proyecciones y retirar rutas antiguas con plan de reversión probado.

No es un script listo para ejecutar ni un cambio de SQL realizado en esta tarea. Los datos de producción requieren plan específico, ventana y autorización.


[Volver al índice](00-Arquitectura-Objetivo.md)
