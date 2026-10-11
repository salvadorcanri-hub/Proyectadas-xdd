# Prueba de uso de EduPuntos

**Actualización del flujo:** el profesor corrige primero en el cuaderno. La foto del alumno se usa para comparar la nota con Excel. Consulta [la implementación y las pruebas de esta comprobación](PHOTO_GRADE_WORKFLOW.md). Sustituye la interpretación anterior de volver a calificar cada foto.

## Resultado

El flujo principal funciona en una simulación con un profesor y tres alumnos conectados en sesiones independientes. Se publicaron tareas, se entregaron fotos, se calificaron trabajos y se actualizaron notas, comentarios, puntos y ranking entre las cuentas. Se corrigieron los fallos reproducidos durante el recorrido.

La recomendación es preparar un **piloto pequeño supervisado**, después de configurar y verificar Netlify y Supabase reales. Estas pruebas son automatizadas en Chromium; no equivalen a observar personas usando la aplicación ni a validar un servicio de producción.

## Cómo se probó

- Base SQLite temporal con estudiantes ficticios; sin modificar los datos existentes.
- Profesor en escritorio y alumnos con ventanas de 390, 768 y 1440 píxeles. La prueba de diseño adicional recorre todas las secciones a 320, 390 y 1440 píxeles.
- Las acciones principales se ejecutan desde la interfaz: acceso, publicación, entrega, revisión, comentarios, Excel, ranking y cierre de sesión.
- Dos alumnos envían a la vez; el tercero experimenta una conexión interrumpida y después un envío retenido para comprobar los controles durante la espera.
- Fotos PNG sintéticas y archivos Excel creados en la prueba. La cámara física y las fotos de teléfonos reales no se han probado.

## Recorridos comprobados

| Situación | Resultado observado |
| --- | --- |
| Un alumno intenta entrar al portal docente; otro escribe mal su contraseña y la corrige | El acceso incorrecto se rechaza y el alumno puede volver a intentarlo en su portal. |
| El profesor publica una tarea con instrucciones largas | Aparece en las tres cuentas sin recargar; el alumno puede desplegar y leer las instrucciones completas. |
| Un alumno elige una foto y después un PDF o una imagen de más de 5 MB | Se explica el rechazo, se retira la foto anterior y se bloquea la entrega hasta elegir una imagen válida. |
| Falla la conexión al enviar | Aparece un error; la foto y el comentario permanecen en el formulario para volver a intentar. No se muestra una entrega exitosa. |
| El envío tarda | El botón de envío y los controles de cierre quedan deshabilitados; Escape no cierra el formulario mientras la petición sigue pendiente. |
| Dos alumnos entregan simultáneamente | Ambas entregas llegan al profesor. La respuesta privada del tercer alumno contiene solo sus entregas y notas. |
| El profesor asigna AD, A y B y escribe comentarios | Cada alumno ve su nota y comentario; se suman exactamente 10, 8 y 6 puntos respectivamente. |
| Se abre una foto para revisarla | Funcionan ampliar, girar y cerrar con Escape. Los diálogos mantienen el foco y lo devuelven al control de apertura. |
| Se reenvía la foto de una tarea calificada | Se conservan nota, puntos y comentario oficial; se vuelve a leer la nota de la nueva foto y se recalcula la comparación. |
| El profesor escribe un premio mientras un alumno entrega | El borrador se conserva. Al publicarlo y recargar, permanece el premio guardado. |
| Un Excel contiene una nota válida y otra inválida | Se rechaza todo el lote. Tras recargar, la nota válida tampoco se ha aplicado. |
| Se corrige ese Excel y se vuelve a importar | Las notas llegan a las cuentas correspondientes y permanecen tras recargar. |
| Los alumnos consultan el ranking y vuelven a entrar | Comparten el mismo puesto para un estudiante y los datos guardados sobreviven al nuevo inicio de sesión. |

## Incidencias corregidas

1. **Borradores de premios perdidos:** cada actualización del aula sustituía los campos aunque el profesor estuviese escribiendo. Ahora los cambios locales pendientes se conservan hasta publicar; se muestra que quedan cambios sin guardar.
2. **Foto anterior enviada por error:** seleccionar un archivo inválido dejaba habilitada la entrega de la foto previa. Ahora se vacía la selección anterior y se cancelan lecturas de archivos reemplazados.
3. **Comentario antiguo tras una nueva entrega:** el comentario ya guardado seguía almacenado como borrador en el navegador docente. Ahora, al guardar, se libera ese borrador y se refleja el estado del servidor. Se conserva una edición más reciente si el profesor escribe mientras guarda.
4. **Instrucciones recortadas:** solo se podían ver tres líneas de la descripción en la tarjeta del alumno. Ahora pueden desplegarse y también se muestran en el formulario de entrega.
5. **Reenvío incompatible con la corrección en el cuaderno:** el flujo se corrigió para conservar siempre la nota y los puntos oficiales al reemplazar la foto.
6. **Ventanas difíciles de usar con teclado:** los formularios de entrega y el visor usan diálogos identificados, recorrido de foco, Escape y retorno al botón de apertura. El campo de archivo es accesible con teclado.
7. **Errores de conexión poco claros en el modo local:** el fallo de red se explica en español y la entrega se puede reintentar conservando el formulario abierto.

Las dos primeras incidencias y el comentario antiguo se reprodujeron con pruebas que fallaron antes de corregir el código y pasaron después.

## Comprobaciones ejecutadas

- `npm run lint`: sin errores de TypeScript.
- `npm test`: 26 pruebas aprobadas, incluyendo permisos, persistencia, fotos, Excel, comparación de notas y políticas SQL de Supabase en PGlite.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:hosted`: pruebas aprobadas en las aplicaciones compiladas, incluidos el recorrido completo del aula y el OCR real con una imagen sintética.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:netlify`: 1 prueba aprobada de las compilaciones de Netlify con las respuestas de Supabase **simuladas**.
- `git diff --check`: sin errores de formato del parche.

El recorrido queda automatizado en `tests/browser/classroom.spec.ts`. Genera capturas del profesor y de la libreta móvil en su carpeta de `test-results/local/`.

## Lo que falta comprobar con personas reales

1. **Servicio publicado:** crear Supabase, aplicar ambas migraciones y comprobar autenticación, fotos privadas y sincronización desde Netlify. La prueba simulada no valida credenciales, cuotas ni configuración del proyecto real.
2. **Preparación del aula:** el [registro de alumnos](STUDENT_ACCOUNTS.md) permite crear fichas nuevas con nombres, apellidos, DNI y correo. La vinculación de fichas anteriores y la recuperación de contraseña requieren un administrador; no hay interfaz de grupos/clases separados.
3. **Teléfonos reales:** probar cámara y galería en Android y iPhone, orientación de fotos y legibilidad del cuaderno. Se acepta una imagen JPG/PNG/WebP de hasta 5 MB por tarea; PDF, HEIC y entregas de varias páginas necesitan una decisión de producto.
4. **Conexión irregular:** el reintento conserva la foto mientras el formulario sigue abierto. No hay guardado persistente sin conexión; cerrar o recargar puede perder el borrador.
5. **Uso cotidiano:** observar si los alumnos distinguen pendiente, enviada y calificada; si el profesor encuentra todas las entregas; y si los mensajes y botones se entienden sin ayuda. También conviene sustituir los avisos nativos del profesor por confirmaciones visibles dentro de la página.
6. **Reglas del curso:** actualmente se permite entregar después de la fecha y reenviar una tarea calificada. Confirmar la política de retrasos, la necesidad de historial de versiones y cómo se quiere explicar el ranking y sus empates.
7. **Volumen:** tres alumnos simultáneos no constituyen una prueba de carga. Medir el funcionamiento con el tamaño previsto del aula, fotos reales y el plan gratuito elegido antes de ampliar el uso.

Para el primer piloto: un profesor y entre tres y cinco alumnos voluntarios, una tarea de ensayo y una sesión observada. Pedir que entren sin ayuda, lean las instrucciones, entreguen, consulten la devolución y corrijan una entrega. Registrar dónde se atascan y cuánto tarda cada acción antes de incorporar calificaciones oficiales.
