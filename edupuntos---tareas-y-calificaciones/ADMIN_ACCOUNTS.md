# Administrador y creación de cuentas

El administrador entra por `/docentes/` con su correo y contraseña. No existe una contraseña especial compartida ni se determina el permiso por comparar el correo en el navegador. La pertenencia a `edu_admins`, comprobada en el servidor, habilita **Administrar cuentas**. Un administrador sin aulas asignadas abre directamente ese apartado; no obtiene acceso automático a las 20 aulas.

## Activar salvadorcanri@gmail.com

1. En Supabase SQL Editor ejecuta el contenido de `supabase/migrations/006_admin_accounts.sql` después de la 005. No repitas las migraciones anteriores.
2. En Authentication → Users comprueba si ya existe `salvadorcanri@gmail.com`. Si no existe, usa Add user → Create new user, una contraseña nueva de al menos 12 caracteres y Auto Confirm User. Si ya existe, conserva la cuenta; no la dupliques. Debe estar confirmada.
3. Ejecuta el contenido completo de `supabase/bootstrap-admin.sql` en SQL Editor. Este archivo concede el permiso a ese correo de forma explícita y se puede repetir. Si pertenece a un alumno, se detiene: hace falta revisar esa matrícula antes de convertirla. No cambia la contraseña ni elimina datos.
4. En Netlify confirma que `SUPABASE_SECRET_KEY` esté disponible para Functions. Es la misma variable privada utilizada para DNI; nunca uses `VITE_` para esa clave. Vuelve a desplegar `main` y comprueba que se publica la función `admin-accounts`.
5. Abre `/docentes/` e inicia sesión con ese correo y tu contraseña nueva. Si ya habías iniciado sesión, sal y vuelve a entrar.

Los pasos del panel requieren acceso administrativo al proyecto real de Supabase. El desarrollo y las pruebas no crean esa cuenta remota ni conocen su contraseña. Las contraseñas no se guardan en SQL, GitHub ni los mensajes de éxito.

## Crear profesores y alumnos

En **Administrar cuentas**, elige Profesor o Alumno. Introduce un correo de hasta 80 caracteres y una contraseña inicial de 12–128 caracteres, repítela y selecciona aulas. Un profesor puede tener varias; un alumno debe tener exactamente una y completar nombres, apellidos y DNI de ocho dígitos. El formulario no permite crear otros administradores.

Las cuentas creadas aquí se confirman administrativamente. No se envía correo ni invitación: comunica las credenciales por un canal privado al titular cuya identidad has comprobado. El alumno puede entrar con ese correo o DNI y la misma contraseña. El registro público de alumnos conserva su flujo de confirmación por correo.

Si aparece «Cuenta creada», ya puede entrar. El formulario limpia la contraseña al terminar. Si la respuesta se pierde o dice que no se pudo confirmar la creación, revisa Authentication antes de repetir; no se reintenta automáticamente. Correos y DNI duplicados son rechazados. Todavía no hay listado de cuentas, restablecimiento de contraseña ni cambio obligatorio de contraseña en el primer acceso.

## Permisos y límites

La función de Netlify verifica el token con Supabase Auth y consulta el permiso administrativo en PostgreSQL en cada solicitud. El navegador no recibe la clave de servidor. La RPC de autorización solo permite llamadas de `service_role`, limita a 20 intentos por administrador cada 15 minutos y no registra contraseñas, correos ni DNI. Los profesores se crean usando metadatos internos de Auth; los metadatos públicos del registro no conceden permisos. Un trigger crea perfil y asignaciones en la misma transacción que el usuario: un aula inválida revierte el alta.

Para revocar la capacidad de crear cuentas elimina la fila del usuario de `edu_admins` desde el panel administrativo. La siguiente solicitud será rechazada aunque la interfaz conserve el botón. Ser administrador no concede acceso a aulas no asignadas. Las asignaciones de cuentas existentes siguen gestionándose en Supabase.

El servidor local tiene el mismo formulario y comprueba la tabla privada `admins` de SQLite; no replica cuentas hacia Supabase. Para desarrollo un administrador local se crea con `user:create` y un operador autorizado añade su ID a `admins`. Las pruebas usan usuarios temporales en bases aisladas.

## Pruebas realizadas

Tipos correctos; 38 pruebas de servidor/SQL, 17 de navegador con servidor local y 5 del cliente Netlify con Supabase simulado. El recorrido del administrador crea un profesor y un alumno y prueba sus accesos, incluido DNI. Las pruebas SQL verifican que no se puedan conceder permisos con metadatos públicos, que un alta docente inválida se revierta y que exista un límite de intentos. La función Netlify se prueba con respuestas Auth/RPC simuladas: no se ha creado ni probado una cuenta en el proyecto remoto.
