# Piloto: dos profesores y tres alumnos

El código prepara las aulas y sus permisos. Las cuentas reales se crean en tu proyecto Supabase; las pruebas automáticas usan cuentas temporales y no crean usuarios en producción.

## 1. Activar la versión

1. En Supabase, comprueba que ejecutaste las migraciones 001–004. Después abre [`supabase/migrations/005_classrooms.sql`](supabase/migrations/005_classrooms.sql), copia **todo su contenido** en SQL Editor y pulsa Run. Pegar el nombre del archivo no ejecuta SQL. No vuelvas a ejecutar migraciones antiguas sobre la 005.
2. Comprueba que Netlify haya publicado el último cambio de `main`. Si falla, revisa el registro del despliegue antes de compartir el enlace.
3. Conserva `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Para probar DNI también necesitas `SUPABASE_SECRET_KEY` **solo en Netlify Functions**, sin prefijo `VITE_`. Sigue [la configuración de cuentas](STUDENT_ACCOUNTS.md). Esta actualización no requiere otra clave.
4. En Supabase Authentication, configura Site URL con tu dominio y Redirect URLs con `https://mini-proyectos.netlify.app/alumnos/` si ese sigue siendo tu dominio. Activa Email y la confirmación del correo. Para enviar a tres personas externas, comprueba las restricciones del correo de Supabase y configura SMTP propio si corresponde. Haz primero una prueba con un destinatario; los correos simulados de los tests no verifican la entrega real.

## 2. Repartir las cinco cuentas

| Persona | Rol | Aula |
| --- | --- | --- |
| Profesor 1 | Docente | 1.º A |
| Profesor 2 | Docente | 2.º B |
| Alumno 1 | Estudiante | 1.º A |
| Alumno 2 | Estudiante | 1.º A |
| Alumno 3 | Estudiante | 2.º B |

Usar dos aulas permite comprobar que no se mezclen alumnos ni tareas. No compartan la misma cuenta.

**Profesores:** en Authentication → Users → Add user, crea dos cuentas con correos distintos y contraseñas privadas de al menos 12 caracteres. Confirma administrativamente esas cuentas si usas la opción disponible en el panel. Abre [`supabase/pilot.example.sql`](supabase/pilot.example.sql), reemplaza los dos correos de ejemplo y ejecuta el contenido completo en SQL Editor. Asigna 1.º A al primero y 2.º B al segundo, sin convertir cuentas de alumnos ni quitar otras asignaciones silenciosamente. Si algo no coincide, se revierte el bloque completo. Entrega cada contraseña por un canal privado; nunca en GitHub, capturas o este documento.

**Alumnos:** cada uno abre `/alumnos/` → **Crear cuenta de alumno**, completa sus campos y elige el aula de la tabla. Para este ensayo, usa nombres y DNIs ficticios de ocho dígitos, diferentes entre sí, y correos reales que controlen los participantes para recibir la confirmación. Que cada uno elija su propia contraseña. No carguen fotos de menores ni notas reales durante este primer ensayo. Las cuentas administrativas creadas directamente en Auth no tienen DNI vinculado automáticamente: usa el formulario de registro para estos tres alumnos.

Si aparece **Aula pendiente de asignación**, la cuenta ya accedió pero falta asignarla. Sigue [CLASSROOMS.md](CLASSROOMS.md). Los datos antiguos no se eliminan ni se asignan automáticamente.

## 3. Comprobación de 15–20 minutos

1. Cada persona prueba una contraseña incorrecta: debe ver un error y permanecer fuera. Luego entra con la correcta, recarga y verifica su nombre y aula.
2. Cada alumno sale y vuelve a entrar primero con correo y después con DNI. Ambos deben abrir la misma cuenta. Un alumno no debe entrar en `/docentes/`, ni un profesor en `/alumnos/`.
3. Cada profesor crea una tarea con un título distinto. Los alumnos de su sección deben verla; los de la otra, no. La lista y el Excel del profesor solo deben contener su aula.
4. Un alumno sube una foto de prueba con una marca AD/A/B/C. Antes de importar una nota, debe aparecer la espera de actualización. El profesor descarga Excel, escribe la nota y lo importa. El alumno verifica la coincidencia o discrepancia. Cambiar Excel sin volver a importarlo no actualiza la app.
5. Desconecta internet brevemente: la app debe avisar. Reconecta y pulsa **Actualizar datos**. Si hay una respuesta perdida al enviar, revisa si ya quedó guardado antes de repetir.
6. Cierra sesión, especialmente en un equipo compartido. Anota resultado, dispositivo y navegador. No incluyas contraseñas, DNI ni fotos privadas en los reportes.

Plantilla de reporte: `Rol / aula / dispositivo / paso / resultado esperado / resultado observado / hora aproximada`.

## Mensaje que puedes compartir

> Estoy probando EduPuntos con cinco personas. Abre https://mini-proyectos.netlify.app y entra en Profesores o Alumnos según tu rol. Te indicaré tu aula por separado. Si eres alumno, crea tu cuenta y confirma el correo. Prueba entrar, salir y volver a entrar; los alumnos también deben probar el acceso con DNI. Avísame si aparece un error indicando el paso y tu navegador, sin enviar contraseñas ni datos personales.

Sustituye el dominio si lo cambiaste en Netlify. Envía las instrucciones de cuenta a cada profesor por separado.

## Alcance y limpieza

Este piloto verifica funcionamiento y aislamiento, no capacidad de miles de personas. Aún faltan cuotas totales por alumno y limpieza programada de fotos en Supabase, historial de notas, recuperación de contraseña desde la interfaz y aprobación de matrículas. Un alumno con correo confirmado puede elegir aula al registrarse: todavía no se comprueba institucionalmente que pertenezca a ella.

Se retira `render.yaml` y su guía de pago, y el antiguo ejemplo de perfiles se sustituye por el SQL del piloto con validaciones. Se pueden regenerar `dist/` y `test-results/`; no son archivos que deban subirse a GitHub. Se conservan migraciones, pruebas, servidor local y dependencias porque siguen usándose. No se borran datos de Supabase ni servicios contratados por eliminar archivos del repositorio.

## Verificación técnica realizada

- Tipos: `npm run lint`, correcto.
- Servidor y PostgreSQL embebido: **36 pruebas**, incluyendo permisos entre aulas, fotos privadas, Excel atómico, revocación de acceso, preservación de registros antiguos y validación del SQL administrativo del piloto.
- Aplicaciones compiladas con servidor local: **16 pruebas de navegador**, con cinco sesiones independientes, registro de tres alumnos, acceso por correo/DNI, dos docentes, cambio de aula y aviso de asignación pendiente.
- Compilación Netlify: **5 pruebas de navegador** con respuestas HTTP de Supabase simuladas. Verifican registro, sesión, fotos, Excel y que una clave secreta del servidor no se incluya en los archivos públicos.

Total: **57 pruebas aprobadas**. No acredita todavía la configuración de Auth, SMTP, Storage ni el despliegue de tu proyecto remoto. La compilación conserva un aviso de paquetes JavaScript mayores de 500 kB; no impide compilar, pero debe medirse en móviles y redes lentas.
