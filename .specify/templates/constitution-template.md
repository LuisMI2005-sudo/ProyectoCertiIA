# [PROJECT_NAME] Constitution
<!-- Example: Spec Constitution, TaskFlow Constitution, etc. -->

## Core Principles

### [PRINCIPLE_1_NAME]
<!-- Example: I. Library-First -->
[PRINCIPLE_1_DESCRIPTION]
<!-- Example: Every feature starts as a standalone library; Libraries must be self-contained, independently testable, documented; Clear purpose required - no organizational-only libraries -->

### [PRINCIPLE_2_NAME]
<!-- Example: II. CLI Interface -->
[PRINCIPLE_2_DESCRIPTION]
<!-- Example: Every library exposes functionality via CLI; Text in/out protocol: stdin/args → stdout, errors → stderr; Support JSON + human-readable formats -->

### [PRINCIPLE_3_NAME]
<!-- Example: III. Test-First (NON-NEGOTIABLE) -->
[PRINCIPLE_3_DESCRIPTION]
<!-- Example: TDD mandatory: Tests written → User approved → Tests fail → Then implement; Red-Green-Refactor cycle strictly enforced -->

### [PRINCIPLE_4_NAME]
<!-- Example: IV. Integration Testing -->
[PRINCIPLE_4_DESCRIPTION]
<!-- Example: Focus areas requiring integration tests: New library contract tests, Contract changes, Inter-service communication, Shared schemas -->

### [PRINCIPLE_5_NAME]
<!-- Example: V. Observability, VI. Versioning & Breaking Changes, VII. Simplicity -->
[PRINCIPLE_5_DESCRIPTION]
<!-- Example: Text I/O ensures debuggability; Structured logging required; Or: MAJOR.MINOR.BUILD format; Or: Start simple, YAGNI principles -->

## [SECTION_2_NAME]
<!-- Example: Additional Constraints, Security Requirements, Performance Standards, etc. -->

[SECTION_2_CONTENT]
<!-- Example: Technology stack requirements, compliance standards, deployment policies, etc. -->

## [SECTION_3_NAME]
<!-- Example: Development Workflow, Review Process, Quality Gates, etc. -->

[SECTION_3_CONTENT]
<!-- Example: Code review requirements, testing gates, deployment approval process, etc. -->

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

[GOVERNANCE_RULES]
<!-- Example: All PRs/reviews must verify compliance; Complexity must be justified; Use [GUIDANCE_FILE] for runtime development guidance -->

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->

## Documentación visual obligatoria (DevGuardian)

Redactar en español. Representar todos los diagramas de arquitectura, modelos de datos y flujos en bloques independientes de código Mermaid, delimitados por tres backticks y el identificador mermaid en minúsculas. Mantener el bloque al nivel raíz, sin sangría, sin envolverlo en otro bloque ni en HTML. Usar flowchart, sequenceDiagram, erDiagram o stateDiagram-v2; IDs ASCII y etiquetas descriptivas entre comillas para flowchart. No usar imágenes, diagramas ASCII, PlantUML, plugins, JavaScript, enlaces click ni directivas init. Los comandos y ejemplos JSON sí conservan su lenguaje propio.

Guardar los documentos de cada funcionalidad en specs/NNN-nombre/ y enlazarlos con rutas Markdown relativas. Arquitectura en architecture.md, entidades y cardinalidades en data-model.md, secuencias y estados en processes.md. Si no hay persistencia propia, explicarlo y representar solo las entidades lógicas reales; no inventar tablas. Indicar estado actual frente a propuestas.

Consultar specs/README.md y specs/constitution.md. Después de cambiar plantillas o constitución, ejecutar npm run sdd:sync y npm run sdd:check para mantener las copias visibles de Obsidian.
