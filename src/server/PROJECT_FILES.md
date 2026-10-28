# Árbol de archivos y comprobaciones de diagnóstico

`GET /api/projects/{projectId}/files` responde `{ ok: true, data: { files: [{ path, analyzable }], truncated } }`. Las rutas son relativas al checkout registrado, no a la laptop del visitante. El endpoint hereda autenticación, CORS, límites y validación de pertenencia a las raíces autorizadas. No acepta rutas ni parámetros query. Un checkout inexistente responde 409 con indicación de volver a importar, en vez de un listado vacío exitoso.

`project-files.ts` recorre directorios reales con WorkspacePathGuard, sin seguir symlinks ni listar archivos con múltiples hard links. Excluye `.git`, `.env*`, carpetas de dependencias/build, configuraciones privadas de asistentes, nombres habituales de secretos y archivos fuera de los tipos de texto permitidos. No garantiza detectar secretos incrustados en cualquier archivo de código; el listado no lee su contenido ni sustituye los controles de lectura existentes.

Límites: 2.000 archivos listados, 10.000 entradas visitadas, 15 niveles, ocho segundos y archivos de hasta 2 MB. Si se alcanza un límite o hay errores de acceso parciales, `truncated` es true. No son un snapshot transaccional: cada lectura posterior vuelve a pasar por sus controles de ruta y tamaño. Los archivos se ordenan por ruta y se marca si pertenecen a las extensiones JS/TS soportadas por el analizador.

El contrato de `POST /api/audits/run` acepta ahora `checks` opcional en modo diagnose: una lista no vacía y sin duplicados de syntax, semantic y lint. Al omitirlo se mantienen las tres comprobaciones históricas. El coordinador registra esa selección en el contexto delegado, el worker la usa y el proxy rechaza que cambie los checks de una delegación explícita. Las reparaciones no pueden reducir sus comprobaciones mediante este campo.

Pruebas específicas: `tests/server/project-files.test.mjs`, con árbol temporal real, enlaces/hard links, endpoint HTTP autenticado y workers reales para las comprobaciones seleccionadas. La suite previa `tests/server/project-import.test.mjs` verifica que importar no habilita ejecutar código de terceros.
