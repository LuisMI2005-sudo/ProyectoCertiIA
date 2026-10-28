# Evidencia de verificación

**Fecha:** 2026-10-28.

- Specify CLI 0.8.9: inicialización oficial completada con integración Codex y PowerShell.
- npm run sdd:sync: copias visibles generadas desde las fuentes operativas.
- npm run sdd:check: sincronización, enlaces relativos y estructura Mermaid correctos.
- Control negativo: una copia alterada temporalmente fue rechazada; se restauró su contenido y la comprobación volvió a pasar.
- check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks, con SPECIFY_FEATURE=001-sdd-foundation: reconoció la carpeta de esta funcionalidad sin cambiar la rama Git.
- npm run check: TypeScript y ESLint correctos.
- No se ejecutó la suite funcional completa: los cambios son documentación, plantillas y utilidades de validación documental, sin cambios en src/.
- No se verificó visualmente Obsidian ni se ejecutó un parser completo de Mermaid: queda la revisión humana de Vista de lectura o Live Preview.
- No se realizaron commits, push, despliegues ni migraciones.
