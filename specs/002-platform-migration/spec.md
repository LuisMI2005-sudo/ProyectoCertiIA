# Especificación: migración completa de DevGuardian

Autorización del usuario: 2026-10-28, multitenancy, microservicios y microfrontends. El despliegue y los datos de Render quedan fuera de esta implementación local.

## Aceptación

- Usuarios autenticados pueden seleccionar organizaciones autorizadas; el servidor rechaza proyectos y evidencias de otro tenant.
- PostgreSQL aplica RLS y claves compuestas en la ejecución tenantizada, con roles runtime sin privilegios administrativos.
- Identidad, Proyectos, Auditorías, Ejecución, Políticas, Telemetría y Planner son procesos con contratos autenticados y bases privadas; BFF no lee esas bases directamente.
- El motor existente conserva análisis, guardrails y evidencia Git; no se ejecutan tests de repositorios importados sin aislamiento.
- Shell y seis remotos tienen artefactos y entradas independientes, recuperación ante fallos y contexto de sesión limpiado al cambiar de tenant.
- Las pruebas cubren aislamiento A/B, autenticación, contratos y carga de remotos; cualquier limitación se informa sin acreditar pruebas no realizadas.

## Restricciones

No modificar datos ni configuración de producción. Credenciales locales generadas se guardan en archivos ignorados. Sin commits, push ni despliegue. La compatibilidad legacy no debe convertirse en una puerta de acceso sin autenticación al entorno distribuido.
