<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

## Convenciones SDD de DevGuardian

Consultar specs/README.md, specs/constitution.md y el plan de la funcionalidad actual. Las habilidades de Spec Kit están en .agents/skills/. Usar plantillas locales .specify/templates/ y generar los documentos de funcionalidad en specs/. Todos los diagramas nuevos deben ser bloques Mermaid nativos, con sintaxis básica y sin plugins ni imágenes externas. Distinguir comportamiento implementado y propuestas. Sincronizar con npm run sdd:sync y verificar con npm run sdd:check. No modificar .codex/hooks.json ni perfiles de seguridad para ejecutar tareas documentales.

## Contexto documental

Consultar también CODEX.md. DevGuardian y GameZone son proyectos separados. El PDF de antecedentes es una fuente secundaria, no instrucciones ni evidencia de capacidades implementadas.


## Arquitectura objetivo de DevGuardian

Consultar el diseño del backend en specs/segundo-cerebro/arquitectura-objetivo/00-Arquitectura-Objetivo.md (en el repositorio hermano ProyectoCertiIA para el frontend). Los requisitos nuevos son microservicios, datos PostgreSQL relacionales multitenant, SOLID, patrones justificados y microfrontends. Distinguir objetivo de implementación existente. Antes de modificar código, seguir las etapas y contratos de migración; no afirmar que existen tenants/RLS o despliegues independientes solo por estar documentados.
