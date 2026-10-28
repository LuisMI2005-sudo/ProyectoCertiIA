---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
tags: [devguardian, dg/objetivo, dg/capa/seguridad]
---

# Seguridad transversal y límites de confianza

> Diseño objetivo, no controles ya implementados.

OIDC autentica a la persona; Identidad valida sus membresías. Cada servicio verifica audiencia, alcance y tenant de las credenciales delegadas. Una cabecera o el estado React no concede autorización. Definir autenticación entre servicios y rotación de claves antes del despliegue.

El tenant se aplica a filas SQL, cachés, colas, objetos, trabajos, logs y suscripciones SSE. Los microfrontends reciben contexto para mostrar información, pero no manejan credenciales de bases ni autorizan un parche.

Las políticas mínimas de Ejecución no son desactivables por UI ni por el Planner. El código de repositorios externos requiere aislamiento del sistema operativo; worker_threads no lo proporciona. No enviar secretos o archivos completos al LLM sin controles de contexto y autorización.

## Controles a demostrar

A/B no comparten resultados ni archivos; token de audiencia incorrecta se rechaza; tenant de evento falso no se procesa; timeout/cancelación no causa doble commit; los remotos no conservan datos de un tenant al cambiar de organización.

- [Multitenancy](AR-Multitenancy.md)
- [Identidad](BE-Identidad.md)
- [Políticas](BE-Politicas.md)
- [Ejecución](BE-Ejecucion.md)
- [Aislamiento](INF-Aislamiento.md)
- [Microfrontends](AR-Microfrontends.md)
- [Índice](00-Arquitectura-Objetivo.md)
