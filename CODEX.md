# Contexto de Codex: DevGuardian Backend

Este archivo es contexto documental; no configura por sí solo el asistente ni se presupone que sea cargado automáticamente. Consultar AGENTS.md y specs/README.md.

## Alcance

DevGuardian audita código y puede verificar reparaciones autorizadas con Git, pruebas y guardrails. Los workers deterministas y el Agent Client generativo son componentes distintos. GameZone es otro proyecto: no trasladar aquí sus requisitos de tienda o arquitectura distribuida.

## Trabajo actual

Adopción SDD y segundo cerebro con fuentes, diagramas y preguntas verificables. La única ubicación activa del segundo cerebro es el backend, specs/segundo-cerebro/, dentro de la bóveda ProyectoCertiIA. La carpeta anterior practica/DevGuardian se trasladó el 2026-10-28; el respaldo está en Informes del workspace. No publicar secretos ni afirmar como implementado algo que solo está planificado.

## Validación

Ejecutar npm run sdd:sync tras cambiar plantillas y npm run sdd:check para documentos. Mantener npm run check y las pruebas pertinentes para cambios de código. No crear commits o despliegues sin autorización.


## Evolución arquitectónica 2026-10-28

Se documentó el objetivo distribuido multitenant en el backend, specs/segundo-cerebro/arquitectura-objetivo/. Se añadió el perfil local de migración en src/platform/ del backend y Shell/remotos en el frontend. Consultar specs/002-platform-migration/ en el backend para capacidades, evidencia y límites reales. La migración de producción y datos históricos sigue pendiente; npm start y npm run dev conservan el modo anterior.

