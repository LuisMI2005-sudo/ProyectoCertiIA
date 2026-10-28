---
proyecto: DevGuardian
tipo: conocimiento
grupo: verificacion
estado: documentado
fecha: 2026-10-28
tags: [devguardian, dg/verificacion]
---

# Verificación, baseline y regresiones

El baseline representa el comportamiento previo al parche y el candidato el posterior. Las ejecuciones deben ser completas, comparables y corresponder al estado correcto del workspace.

Un fallo que pasa a skipped/todo no es una reparación acreditada. Un JSON de reporte incompleto tampoco demuestra éxito. No basta con ver un contador verde: revisar los casos, las omisiones y la comparación.

El diagnóstico solo puede terminar sin baseline/candidato porque no ejecuta una reparación. Las rutas generativa y determinista tienen políticas propias; no se debe inventar una traza común para ambas.

## Relaciones

- [Estático y dinámico](02-Auditoria-de-codigo.md)
- [Decisión de commit o rollback](10-Flujo-reparacion.md)
- [Pruebas pendientes](11-Validacion-pendiente.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)
