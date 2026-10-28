---
proyecto: DevGuardian
tipo: evaluacion-integral
fecha: 2026-10-28
estado: documento-de-evaluacion
tags: [devguardian, dg/direccion]
---

# Alcance, metodología y límites

## Objeto

Evaluar DevGuardian como software y como propuesta de producto: implementación actual, arquitectura futura, seguridad, operación, usabilidad, factibilidad comercial y comercialización. La auditoría corresponde al workspace local del 2026-10-28, que contiene cambios sin commit; no certifica el despliegue de Render.

## Evidencia

Código y contratos de backend/frontend; package.json, workflows, esquema SQL y documentación local. Check y pruebas se ejecutan sobre los repositorios del equipo, no sobre repositorios externos ni producción. Los resultados y revisiones quedan en [evidencia](02-Evidencia-tecnica.md).

## Método

Inventariar módulos; comparar diseño y código; revisar límites de confianza; ejecutar checks y suites; registrar hallazgos con riesgo y criterio de cierre; evaluar hipótesis comerciales separadas de hechos. Severidad cualitativa: alta para barreras de seguridad/comercialización, media para fiabilidad o adopción, baja para presentación. No se asignan CVSS, nota docente ni certificación.

## Exclusiones

No se hizo pentest, revisión exhaustiva de cada línea, análisis dinámico de producción, auditoría legal, búsqueda completa de secretos históricos, carga masiva, llamada pagada a Anthropic ni investigación de mercado con clientes reales. Los riesgos comerciales no son vulnerabilidades confirmadas. Los benchmarks, entrevistas y pruebas tenant A/B todavía requieren ejecución.

## Convenciones

Hecho observado = evidencia local verificable. Diseño = requisito documentado sin implementación. Hipótesis = propuesta a contrastar. Un test verde respalda su caso específico, no demuestra ausencia universal de errores. El PDF de antecedentes es una fuente secundaria y no constituye la auditoría del software actual.


[Índice del informe](00-Informe-Integral.md)
