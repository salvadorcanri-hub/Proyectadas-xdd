# Revisión de seguridad — 10 de octubre de 2026

Se revisaron las aplicaciones docente y de alumnos, Express/SQLite, los archivos de despliegue y las políticas y funciones SQL de Supabase. Las pruebas usan cuentas y datos temporales. No se desplegaron servicios ni se modificó una base de Supabase real.

## Problemas corregidos

| Hallazgo | Evidencia y alcance | Corrección |
| --- | --- | --- |
| Dependencias con avisos de seguridad | La auditoría encontró dos avisos de severidad alta en `xlsx@0.18.5`: contaminación de prototipos y denegación de servicio por expresiones regulares. Se importaban archivos con esa biblioteca en el servidor y en docentes. | Se sustituyó SheetJS por `read-excel-file` y `write-excel-file`. Se conservaron la descarga de plantillas y la importación de notas. |
| Dependencia transitiva vulnerable | `braces@3.0.3` tenía un aviso de agotamiento de pila. Llegaba mediante `http-proxy-middleware`; no se demostró una entrada explotable de patrones en esta app. | Se eliminó ese intermediario y se usa directamente `http-proxy` con coincidencia literal de rutas. |
| Permisos antiguos en una conexión en vivo | Una prueba cambió la vinculación de una cuenta de alumno mientras seguía abierto su flujo SSE. La conexión continuaba recibiendo datos del alumno anterior. | Cambiar rol, alumno asociado o contraseña revoca las sesiones locales. Cada actualización vuelve a comprobar la identidad y corta conexiones desactualizadas. |
| Fotografías del perfil anterior en Supabase | Al reasignar una cuenta, el prefijo de propietario seguía permitiendo leer fotos anteriores. La comprobación de borrado consultaba referencias sujetas a RLS, que podían quedar ocultas. | La migración `002_photo_authorization.sql` comprueba todas las referencias desde una función restringida. Deniega lectura, reutilización y borrado de fotos vinculadas al perfil anterior. |
| Procesamiento de cuerpos grandes sin autenticación | Una petición anónima de más de 8 MB alcanzaba el analizador JSON y producía 413, en lugar de rechazarse antes por falta de sesión. | Se comprueba la sesión antes del cuerpo de las peticiones protegidas. El inicio de sesión tiene un límite separado de 4 KB. La prueba ahora obtiene 401. |
| Acumulación de fotos reemplazadas en SQLite | Dos entregas sucesivas dejaban ambas imágenes en disco. Repetirlas permitía consumir almacenamiento sin aumentar las entregas visibles. | Se retiran las fotos reemplazadas o de tareas eliminadas después de guardar, solo cuando ninguna entrega las utiliza. No se borran archivos históricos ajenos a esa operación. |

Avisos consultados:

- https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
- https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

## Protecciones adicionales verificadas

- El lector de Excel limita el archivo a 5 MB, cada entrada descomprimida a 8 MB, el total descomprimido a 20 MB y el número de entradas a 256. Valida XML antes de procesarlo; rechaza DTD, filas/columnas desmesuradas y coordenadas codificadas que intenten saltar los límites. Reconstruye el ZIP con los bytes verificados para evitar discrepancias entre sus directorios.
- Se admiten hasta 10000 filas de datos, 256 columnas y 100000 celdas. CSV se analiza con límites y se mantiene la validación completa antes de guardar notas.
- Los textos exportados se conservan como texto literal; no se convierten en fórmulas. Se comprobó un texto con apariencia de `HYPERLINK`.
- Se limitan las conexiones SSE a cinco por cuenta y 256 en total; se cierran conexiones lentas cuando no aceptan las actualizaciones.
- Express y la salida de Netlify incluyen CSP, protección contra marcos, `nosniff` y `no-referrer`. La CSP de Netlify permite conexiones al proyecto Supabase configurado; bloquea scripts insertados en línea. Los estilos en línea y los workers de Blob necesarios para la aplicación siguen permitidos.
- Las URLs firmadas de fotos generadas por la aplicación caducan en cinco minutos. Se renuevan mientras la sesión está activa.
- Se verificó que un alumno no puede calificarse, administrar tareas, escalar su rol, leer notas privadas ajenas ni enviar una foto en nombre de otro estudiante.

## Validación

- `npm run lint`: correcto.
- `npm test`: 22 pruebas correctas, incluyendo regresiones de seguridad y PostgreSQL/RLS con PGlite.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:hosted`: flujo de entrega/calificación y diseño en navegador con las aplicaciones compiladas y Express.
- `CHROMIUM_PATH=/usr/bin/chromium SERVE_BUILT=1 npm run test:browser`: las aplicaciones compiladas con el proxy de cada app; incluye un comentario con HTML malicioso que debe mostrarse como texto.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:netlify`: acceso, fotos, notas, Excel y bloqueo de scripts con las respuestas de Supabase simuladas y las cabeceras generadas para Netlify.
- `bun install --frozen-lockfile`: instalación reproducible correcta.
- `bun audit --json`: resultado final `{}` (sin avisos conocidos para el conjunto de dependencias consultado en esta fecha).

## Aplicación de los cambios y límites

La función de comparación posterior a esta revisión añade `003_photo_grade_comparison.sql`, que debe aplicarse después de `001` y `002`. Guarda la lectura de la foto como dato orientativo del cliente y conserva el registro oficial. Las lecturas no conceden puntos ni cambian notas. La CSP permite `wasm-unsafe-eval` para el OCR local y mantiene bloqueados los scripts insertados en línea y la evaluación de JavaScript arbitrario. Consulta [sus pruebas y límites](PHOTO_GRADE_WORKFLOW.md).

Cuando crees Supabase, ejecuta las migraciones en orden: `001_edupuntos.sql`, `002_photo_authorization.sql` y `003_photo_grade_comparison.sql`. Aplica solo las migraciones pendientes. El archivo de cabeceras se genera al compilar para Netlify; será efectivo al desplegar esa compilación.

El registro de alumnos añade posteriormente `004_student_registration.sql`. El DNI se guarda en una tabla privada sin lectura para alumnos o profesores; la función de Netlify comprueba la contraseña con Supabase Auth antes de devolver una sesión y no revela el correo resuelto en respuestas fallidas. Se verifican límites por DNI y origen en PostgreSQL, duplicados sin fichas huérfanas, espera de confirmación de correo y rechazo de metadatos que intentan conceder el rol docente. Las claves del servidor se excluyen de los archivos públicos mediante una prueba de compilación. Consulta [la configuración y los límites del registro](STUDENT_ACCOUNTS.md); el formato del DNI no acredita la identidad de su titular.

Los archivos `.xls` antiguos deben guardarse como `.xlsx` o `.csv` en UTF-8. Este cambio evita conservar el lector vulnerable por compatibilidad. Las plantillas `.xlsx` del proyecto siguen siendo compatibles.

Las fotos antiguas sin referencias que ya existan en SQLite requieren una limpieza administrativa aparte. En Supabase la limpieza física de objetos reemplazados sigue siendo administrativa; no se borra directamente de `storage.objects`, porque eso no elimina los archivos almacenados por el servicio. Deben revisarse las cuotas de almacenamiento y los límites de solicitudes del proyecto al configurarlo.

PGlite verifica SQL y RLS sobre esquemas mínimos de Auth/Storage; no sustituye las pruebas del servicio real. Quedan pendientes HTTPS, configuración de Auth, límites de solicitudes, políticas adicionales que pudiera haber en el proyecto y funcionamiento de Storage/Realtime reales. Un enlace firmado emitido antes de retirar permisos permanece válido hasta su caducidad. Esta revisión reduce los problemas comprobados; no certifica ausencia de toda vulnerabilidad.
