---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/arquitectura]
---

# Plan por etapas y criterios de aceptación

> Diseño objetivo, no implementación. Los cambios de aplicación requieren migración y verificación.

## No confundir diseño con implementación

Esta tarea modifica la documentación y grafos. Los servicios, bases por dominio, roles RLS y remotos aún deben construirse. El diseño microservicios añade operación, red, fallos parciales y costo; no se obtiene por renombrar carpetas.

## Etapas

| Etapa | Entrega | Criterio antes de avanzar |
| --- | --- | --- |
| 1. Contratos y tenant | ADRs, TenantContext, permisos y modelo de propiedad | Matriz A/B, backfill y prototipo RLS con rol runtime |
| 2. Puertos internos | Separar transporte, coordinación y dominio en el backend actual | Suite existente y contratos siguen pasando; sin regresión Git |
| 3. Ejecución aislada | Servicio con journal, evidencia, leases y cuarentena | Crash recovery, doble escritor, cancelación y rollback probados |
| 4. Servicios de dominio | Extraer Proyectos, Políticas y Auditorías por etapas | Privacidad de bases, outbox/inbox y compatibilidad |
| 5. Telemetría | Proyecciones reconstruibles y SSE tenantizado | Duplicados, desorden y reconexión sin fuga entre tenants |
| 6. Shell y primer remoto | Spike de federación y primer microfrontend | Deploy/rollback independiente, fallo aislado y temas accesibles |
| 7. Resto de remotos y Planner | Completar fronteras de producto | Compatibilidad Shell/remotos y presupuestos IA verificables |
| 8. Corte de migración | Retirar autoridad anterior y limpiar deuda | Restauración ensayada, monitoreo y aceptación del equipo |

## Pruebas requeridas

Tenant A no lee, ejecuta, exporta ni suscribe resultados de B. Consumidor duplica eventos sin duplicar proyecciones. Timeout de commit se resuelve por journal. Proceso vencido no sigue escribiendo en un workspace reutilizado. Un remoto caído no rompe el Shell ni revela datos del tenant anterior. Los tests hostiles no reciben red/secretos del host.

Los tiempos y presupuesto no se inventan: definir SLO medibles después del spike, benchmark y selección de infraestructura. No se cambia CI para desplegar automáticamente una arquitectura todavía inexistente.


[Volver al índice](00-Arquitectura-Objetivo.md)
