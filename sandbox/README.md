# Runner aislado para reparaciones

Este ejecutor sustituye la ejecución de Jest/pytest en el host cuando un administrador lo configura. No se habilita mediante un parámetro MCP ni instalando Docker CLI únicamente.

## Construcción y uso local

```powershell
docker build -f sandbox/Dockerfile -t devguardian-tests:local .
$env:DEVGUARDIAN_SANDBOX_IMAGE_ID = docker image inspect --format '{{.Id}}' devguardian-tests:local
npm run platform:start
```

En Windows, si Docker no está en PATH, configurar también `DEVGUARDIAN_DOCKER_BINARY` con la ruta absoluta de `docker.exe`. La imagen se ejecuta por su ID SHA-256, nunca por una etiqueta mutable y nunca se descarga durante la auditoría. El lockfile fija las dependencias Node; la imagen resultante identifica la versión efectiva usada en baseline y candidato.

## Garantías del perfil

- Snapshot separado del checkout original, con límites de tamaño, profundidad y cantidad de archivos.
- Exclusión de `.env`, claves, enlaces, metadatos Git y dependencias locales.
- Snapshot de solo lectura; no se monta ninguna carpeta del host con escritura ni el socket Docker.
- Red deshabilitada, usuario sin privilegios, capacidades eliminadas, límites de CPU, memoria y procesos.
- Reportes y temporales en tmpfs con tamaño acotado. Solo se exporta el reporte JSON con salida limitada.
- El contenedor se destruye antes de aceptar evidencia. Si no puede confirmarse la destrucción, se rechaza la verificación y se conserva el snapshot para recuperación.
- Hash de configuración incluye el ID de imagen. El servidor conserva la autoridad de comparación y commit.

## Compatibilidad y límites

La imagen contiene Jest, TypeScript y pytest. No instala dependencias ni ejecuta scripts del repositorio importado. Proyectos que requieran otras dependencias necesitan una imagen revisada por el administrador; un import no garantiza poder ejecutar cualquier proyecto.

La CI construye esta imagen y ejecuta `tests/test-runner/sandbox.test.mjs`, con baseline/candidato reales, commit y rollback en repositorios temporales. Esta prueba usa propuestas controladas, no acredita generación con Anthropic. Sin `DEVGUARDIAN_SANDBOX_IMAGE_ID`, los casos Docker se omiten explícitamente.

Render ejecutando el backend Node no constituye por sí mismo este sandbox. Hasta disponer de un ejecutor compatible y configurado, `/api/health` publica `capabilities.isolatedTests: false` y se bloquean las reparaciones de repositorios importados. No se deben eliminar esos bloqueos para simular que el entorno está listo.
