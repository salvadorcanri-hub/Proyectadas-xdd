# Aulas y asignaciones

Existen exactamente 20 aulas: grados **1.º, 2.º, 3.º, 4.º y 5.º de secundaria**, cada uno con secciones **A, B, C y D**. Los identificadores van de `sec-1-a` a `sec-5-d`.

El profesor selecciona **Aula activa** entre las aulas que el administrador le asignó. Cambiar de aula avisa antes de descartar formularios abiertos. El alumno pertenece a una sola aula, que elige al registrarse; no puede cambiarla editando metadatos de su cuenta. Las tareas, notas, fotos, ranking, premios e importaciones de Excel se autorizan por aula en el servidor y en las políticas de Supabase.

## Activación en Supabase

Aplica el contenido completo de `supabase/migrations/005_classrooms.sql` después de 001–004. La 005 se puede repetir sin borrar registros. Los alumnos y tareas anteriores quedan con `classroom_id = null`: se conservan, pero no aparecen hasta que el administrador los asigne. Los profesores anteriores tampoco reciben acceso automático a las 20 aulas.

Para el primer ensayo de cinco personas sigue [PILOT_FIVE_USERS.md](PILOT_FIVE_USERS.md). Para asignar aulas adicionales a un **profesor existente**, usa SQL Editor con una cuenta administrativa y sustituye el correo y el aula:

```sql
do $$
declare teacher_id uuid;
begin
  select p.user_id into teacher_id from public.edu_profiles p
    join auth.users u on u.id=p.user_id
    where p.role='teacher' and lower(u.email)=lower('CORREO_DEL_PROFESOR');
  if teacher_id is null then raise exception 'No existe ese perfil docente.'; end if;
  insert into public.edu_teacher_classrooms(user_id,classroom_id)
    values(teacher_id,'sec-1-a') on conflict do nothing;
end $$;
```

Para revocar un aula elimina únicamente la fila correspondiente de `edu_teacher_classrooms` en Table Editor. Nuevas consultas y escrituras vuelven a comprobar el permiso aunque la sesión siga abierta. Los enlaces de fotos ya firmados duran como máximo cinco minutos; retirar el permiso no revoca un enlace ya emitido instantáneamente.

La administración se realiza en Supabase; no se añadió un panel de administrador público en la app. No habilites escrituras directas para `authenticated` ni conviertas usuarios mediante metadatos.

## Datos anteriores

Consulta primero los registros pendientes:

```sql
select id, code, name from public.edu_students where classroom_id is null;
select id, title from public.edu_assignments where classroom_id is null;
```

En Table Editor asigna `classroom_id` según el aula real de cada alumno y tarea. Las tareas compartidas anteriormente necesitan revisión: no asignes una tarea a una sección si sus notas/entregas pertenecen a alumnos de otra. Conserva una copia administrativa antes de reorganizar datos reales. No cambies `id`, no elimines las notas y no copies una tarea esperando que se copien también sus entregas.

En cuentas registradas pero todavía sin confirmar, el aula está en `edu_student_accounts.classroom_id`; si corriges esa matrícula antes de confirmar, corrige ese campo administrativamente. En cuentas confirmadas la pertenencia activa se toma de `edu_students.classroom_id`; mantén ambos campos coherentes. El cambio de grado de un curso con historial requiere un plan de traslado, no una reasignación indiscriminada.

Después revisa posibles relaciones incoherentes; el resultado debe estar vacío:

```sql
select g.student_id, g.assignment_id from public.edu_grades g
join public.edu_students s on s.id=g.student_id
join public.edu_assignments a on a.id=g.assignment_id
where s.classroom_id is distinct from a.classroom_id
union
select x.student_id, x.assignment_id from public.edu_submissions x
join public.edu_students s on s.id=x.student_id
join public.edu_assignments a on a.id=x.assignment_id
where s.classroom_id is distinct from a.classroom_id;
```

Una cuenta sin aula muestra **Aula pendiente de asignación**. Después de corregir su asignación puede pulsar **Comprobar asignación** o volver a entrar.

## Modo local

Una base nueva de desarrollo coloca explícitamente los ejemplos en 1.º A. Una base antigua conserva sus valores pendientes. Los profesores se crean desde la consola administrativa:

```sh
npm run user:create -- --username profesor --role teacher --classrooms sec-1-a,sec-2-b
```

La contraseña se solicita por entrada privada. Las asignaciones se guardan en `teacher_classrooms` de SQLite; los alumnos y tareas conservan su `classroomId` en sus registros. El comando local no crea usuarios en Supabase.

## Límites

Las aulas pertenecen a una sola institución; no existe separación por colegio ni por año académico. La inscripción del alumno aún no tiene invitación o aprobación institucional. La consulta de estado se limita al aula activa, pero las notificaciones siguen usando un contador global: varios cursos activos pueden provocar más consultas de las necesarias. Las fotos necesitan cuotas y limpieza antes de ampliar el uso.
