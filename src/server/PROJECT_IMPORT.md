# Importación de proyectos públicos desde GitHub

## Recorrido

En el dashboard, abrir **Nuevo proyecto**, pegar `https://github.com/usuario/repositorio` y pulsar **Importar y preparar**. Sin proyectos registrados, el formulario aparece directamente. Ya no se necesita una ruta de la laptop: el checkout se crea en el equipo donde corre el backend.

El progreso muestra etapas confirmadas por operaciones reales, sin porcentajes simulados: descarga, inspección de archivos, validación y registro. Al terminar se selecciona el proyecto y se abre Auditoría con un archivo fuente del repositorio. El diagnóstico se inicia explícitamente por el usuario.

La ruta absoluta sigue disponible como opción avanzada para administradores del servidor.

## API

`POST /api/projects/import` recibe JSON `{ "url": "https://github.com/usuario/repositorio" }`. Aplica los controles existentes de CORS, bearer opcional y capacidad HTTP. El frontend usa fetch streaming para poder enviar Authorization; no coloca tokens en la URL.

Una entrada inválida responde JSON HTTP 422; sin autorización responde 401; otra importación simultánea responde 429. Una vez abierto SSE, HTTP es 200 y el resultado definitivo se obtiene del evento terminal, no del código HTTP.

| Evento | Datos |
|---|---|
| `progress` | `phase`: cloning / inspecting / validating / registering; `message` |
| `incompatible` | `compatible: false`, `scope`, `entryFile`, `missing[]`, `warnings[]` |
| `ready` | `project` persistido y `validation` compatible |
| `failed` | `message` sanitizado |

Cada incidencia contiene `path`, `code` y `message`. Hay comentarios SSE keep-alive cada 10 segundos. La conexión se cierra al recibir un evento terminal. No hay reanudación por Last-Event-ID ni trabajos durables en background: desconectar cancela el trabajo en curso. Si la conexión se pierde durante el registro, revisar la lista antes de reintentar; el proyecto puede haberse guardado.

## Compatibilidad y alcance

- Repositorios públicos de github.com por HTTPS, sin credenciales, query ni fragmentos. Se usa la rama predeterminada y un clone superficial. No se importan repositorios privados ni se permiten comandos o rutas enviados por el cliente.
- Análisis estático JavaScript / TypeScript con `package.json` objeto JSON válido en la raíz; TypeScript requiere `tsconfig.json`, aceptando JSONC. Se valida su sintaxis sin cargar módulos ni scripts. No se garantiza que extends, referencias o dependencias externas estén resueltos.
- Se enumeran configuraciones ausentes/incorrectas. Jest y ESLint propios ausentes producen advertencias, no un falso fallo del análisis básico. El analizador aplica las reglas ESLint internas y no ejecuta configuraciones del repositorio por defecto.
- No se instalan dependencias, no se ejecuta npm install, scripts, pruebas ni código importado. Pueden aparecer diagnósticos por imports/tipos sin resolver. Python tiene adaptador de pruebas en el motor, pero no análisis AST Python en este flujo.
- `run_tests` por MCP y reparaciones REST se bloquean para checkouts administrados de importación. El botón de reparación también queda deshabilitado. Ejecutar código de terceros requiere una futura infraestructura de sandbox; no basta con instalar paquetes en el servidor compartido.

## Almacenamiento y límites

Se crean carpetas UUID bajo `.devguardian-imports/` dentro de la primera raíz autorizada del backend. Están ignoradas por Git. Los proyectos compatibles se registran mediante el controlador existente y la BD configurada; los incompatibles o fallidos se limpian sin tocar otros proyectos.

Se permite una importación simultánea por instancia y diez checkouts retenidos en esa raíz. Varios procesos requerirían un lock compartido o una cola externa. El administrador gestiona la limpieza de checkouts y registros; no hay eliminación automática de proyectos ya registrados.

Antes de checkout se inspecciona el árbol Git: máximo 10.000 archivos, 2 MB por archivo, 25 MB de contenido; se rechazan symlinks, submódulos y rutas inseguras. Cada comando Git tiene timeout de 90 segundos y toda la preparación 180 segundos. Un monitor de disco comprueba periódicamente un presupuesto de 100 MB incluyendo metadatos Git; es un límite por muestreo que puede sobrepasarse entre comprobaciones, no una cuota de filesystem. Git se ejecuta sin shell, sin prompts, sin configuración global/sistema, sin templates/hooks ni credenciales del backend.

En Render con disco efímero, los checkouts pueden desaparecer al reiniciar o desplegar; los registros de PostgreSQL por sí solos no conservan el código. Para retenerlos se requiere almacenamiento persistente y configurar `DEVGUARDIAN_WORKSPACE_ROOT` dentro de él. No se ha desplegado este cambio automáticamente.

## Verificación

`npm run check` y `npm run build` verifican el backend. La suite específica es:

```sh
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand tests/server/project-import.test.mjs
```

Sus 21 casos cubren URL, árbol Git, manifiestos/configuración, eventos SSE sobre HTTP real con subprocess controlado, persistencia de registro, limpieza, autorización y bloqueo de ejecución. Una comprobación adicional realizó clone real del repositorio público DevGuardian, registro y listado con la API y una base local temporal; no modificó producción.

Frontend: `npm run check`, `npm run build`, `npm test`. Las pruebas incluyen parsing SSE fragmentado con UTF-8, conexión interrumpida, archivos faltantes y selección/transición automática a Auditoría.
