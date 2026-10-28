---
proyecto: DevGuardian
tipo: evaluacion-integral
fecha: 2026-10-28
estado: documento-de-evaluacion
tags: [devguardian, dg/seguridad]
---

# Hallazgos, riesgos y plan de cierre

## Registro priorizado

| ID | Tipo / prioridad | Evidencia actual | Impacto | Acción y aceptación | Responsable propuesto |
| --- | --- | --- | --- | --- | --- |
| H01 | Configuración / alta | src/server/http.ts: authenticated devuelve true si no hay apiToken | Un servicio expuesto sin token admite operaciones; no se comprobó la configuración de producción | Exigir autenticación para rutas sensibles en entrega comercial; probar arranque sin secreto y 401/403. No es prueba de exposición actual | Backend/DevOps |
| H02 | Brecha / alta | src/db/schema.sql carece de tenant_id y RLS | No acredita aislamiento entre organizaciones | Migrar con backfill autorizado, roles y tests A/B; no aceptar clientes multiempresa antes de verificar | Datos/Backend |
| H03 | Límite / alta | src/server/PROJECT_IMPORT.md y src/subagents/README.md | Workers y subprocesos no aíslan código hostil; importación estática bloquea ejecución externa | Mantener restricciones hasta contar con ejecutores aislados y pruebas de escape/recursos. No retirar el bloqueo como atajo | Ejecución/DevOps |
| H04 | Brecha de entrega / media | Entradas actuales package.json y frontend integrado frente al diseño objetivo | Microservicios y microfrontends aún no acreditados | Migración por contratos con despliegue y rollback independientes, sin romper evidencia Git | Arquitectura |
| H05 | Evidencia / media | 11-Validacion-pendiente y tests con proveedor simulado | No prueba uso real de LLM ni ahorro de tiempo | Prueba autorizada con proveedor, sin exponer código o claves; medir tokens, latencia y aceptación de parches | IA/QA |
| H06 | Validación / media | No hay corpus de seguridad, benchmark ni entrevistas registrados | No sustenta promesas de cobertura, escalabilidad o demanda | Ejecutar protocolo de rendimiento y piloto; publicar muestra, ambiente y límites | QA/Producto |
| H07 | Gobernanza / media | Datos de repositorio e historial pueden contener información sensible | Antes de vender faltan retención, borrado, permisos y revisión de licencias/condiciones | Inventario de datos y revisión especializada; probar exportación/borrado por alcance autorizado | Producto/Seguridad |
| H08 | Evidencia inconclusa / media | La suite backend no completó el resumen en esta sesión; primer intento falló por permisos y el segundo conservó un hijo Git activo | No se acredita una nueva ejecución verde del backend | Reproducir por archivo, registrar entorno Git y acotar subprocesos; exigir una suite completa reproducible antes de entrega operativa | QA/Backend |

## Estado

Todos están abiertos como decisiones, condiciones o brechas; esta tarea no corrigió código ni confirmó incidentes. Las prioridades representan impacto potencial en comercialización, no explotabilidad demostrada. Las acciones de código requieren su propia especificación y verificación.

## Registro de cierre

Un hallazgo solo se cierra con cambio identificado, test reproducible, resultado, revisión y riesgo residual. Mantener ID, commit/versión, fecha y evidencia. No sustituir evidencia con una captura de un contador verde.


[Índice del informe](00-Informe-Integral.md)
