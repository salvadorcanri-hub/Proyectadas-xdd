import { test, expect, type Page } from '@playwright/test';

const portal = (role: 'teacher' | 'student') => process.env.SERVE_HOSTED
  ? `http://127.0.0.1:3100/${role === 'teacher' ? 'docentes' : 'alumnos'}/`
  : `http://127.0.0.1:${role === 'teacher' ? 3101 : 3102}/`;
const password = 'Browser-test-only-123';
async function login(page: Page, role: 'teacher' | 'student', name: string) {
  await page.goto(portal(role));
  await page.getByLabel('Usuario',{exact:true}).fill(name);
  await page.getByLabel('Contraseña',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
}

test('five-person pilot: two assigned teachers and three students register and log in independently', async ({ browser }, info) => {
  test.setTimeout(90000);
  const contexts = await Promise.all([1440,1440,390,768,1440].map(width=>browser.newContext({viewport:{width,height:900}})));
  const pages = await Promise.all(contexts.map(context=>context.newPage()));
  const [teacher1,teacher2,...students]=pages;
  const errors:string[]=[];
  pages.forEach(page=>page.on('pageerror',e=>errors.push(e.message)));
  try {
    await Promise.all([login(teacher1,'teacher','pilot-teacher-1'),login(teacher2,'teacher','pilot-teacher-2')]);
    await expect(teacher1.getByLabel('Aula activa')).toHaveValue('sec-4-c');
    await expect(teacher2.getByLabel('Aula activa')).toHaveValue('sec-5-d');
    await expect(teacher1.getByLabel('Aula activa').locator('option')).toHaveCount(1);
    for (const [i,page] of students.entries()) {
      const classroom=i===2?'sec-5-d':'sec-4-c';
      await page.goto(portal('student'));
      await page.getByRole('button',{name:'Crear cuenta de alumno',exact:true}).click();
      await expect(page.getByLabel('Grado y sección').locator('option')).toHaveCount(21);
      await page.getByLabel('Grado y sección').selectOption(classroom);
      await page.getByLabel('Nombres',{exact:true}).fill(['Prueba Uno','Prueba Dos','Prueba Tres'][i]);
      await page.getByLabel('Apellidos',{exact:true}).fill('Piloto');
      await page.getByLabel('DNI',{exact:true}).fill(`9000000${i}`);
      await page.getByLabel('Correo electrónico',{exact:true}).fill(`pilot${i}@example.invalid`);
      await page.getByLabel('Contraseña',{exact:true}).fill(password);
      await page.getByLabel('Repite la contraseña',{exact:true}).fill(password);
      await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
      await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
      await page.getByRole('button',{name:'Cerrar sesión'}).click();
      await page.getByRole('button',{name:'DNI',exact:true}).click();
      await page.getByLabel('DNI',{exact:true}).fill(`9000000${i}`);
      await page.getByLabel('Contraseña',{exact:true}).fill(password);
      await page.getByRole('button',{name:'Entrar',exact:true}).click();
      await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading',{name:/Hola, Prueba/})).toBeVisible();
      const response=await page.request.get(new URL('/api/student/state',page.url()).href);
      const {state}=await response.json();
      expect(state.classroom.id).toBe(classroom);
      expect(state.students).toHaveLength(1);
      const denied=await page.request.get(new URL('/api/student/state?classroom=sec-1-a',page.url()).href);
      expect(denied.status()).toBe(403);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await teacher1.getByRole('button',{name:'Tareas',exact:true}).click();
    await teacher1.getByPlaceholder('Ej: Problemas de Porcentajes').fill('Tarea privada del piloto 4C');
    await teacher1.locator('input[type=date]').fill('2026-12-01');
    await teacher1.getByRole('button',{name:'Publicar Tarea',exact:true}).click();
    for (const page of students.slice(0,2)) await expect(page.getByRole('heading',{name:'Tarea privada del piloto 4C'})).toBeVisible();
    await expect(students[2].getByRole('heading',{name:'Tarea privada del piloto 4C'})).toHaveCount(0);
    const own=await (await teacher1.request.get(new URL('/api/teacher/state',teacher1.url()).href)).json();
    expect(own.state.students).toHaveLength(2);
    const foreign=await teacher2.request.get(new URL('/api/teacher/state?classroom=sec-4-c',teacher2.url()).href);
    expect(foreign.status()).toBe(403);
    const denied=await teacher2.request.post(new URL('/api/teacher/grades',teacher2.url()).href,{headers:{'X-EduPuntos-Client':'teacher'},data:{assignmentId:own.state.assignments[0].id,studentId:own.state.students[0].id,grade:'AD'}});
    expect(denied.status()).toBe(404);
    for (const page of students) {
      await page.getByRole('button',{name:'Cerrar sesión'}).click();
      const i=students.indexOf(page);
      await login(page,'student',`pilot${i}@example.invalid`);
    }
    await teacher1.screenshot({path:info.outputPath('pilot-teacher.png'),fullPage:true});
    await students[0].screenshot({path:info.outputPath('pilot-student-mobile.png'),fullPage:true});
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context=>context.close())); }
});

test('teachers can switch only assigned classrooms; unassigned accounts get an actionable notice',async ({page})=>{
  await login(page,'teacher','pending-teacher');
  await expect(page.getByRole('heading',{name:'Aula pendiente de asignación'})).toBeVisible();
  await page.getByRole('button',{name:'Comprobar asignación'}).click();
  await expect(page.getByRole('heading',{name:'Aula pendiente de asignación'})).toBeVisible();
  await page.getByRole('button',{name:'Cerrar sesión'}).click();
  await login(page,'teacher','multi-teacher');
  await expect(page.getByLabel('Aula activa').locator('option')).toHaveCount(2);
  await page.getByRole('button',{name:'Tareas',exact:true}).click();
  await page.getByPlaceholder('Ej: Problemas de Porcentajes').fill('Borrador sin guardar');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByLabel('Aula activa').selectOption('sec-3-b');
  await expect(page.getByLabel('Aula activa')).toHaveValue('sec-3-a');
  await expect(page.getByPlaceholder('Ej: Problemas de Porcentajes')).toHaveValue('Borrador sin guardar');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByLabel('Aula activa').selectOption('sec-3-b');
  await expect(page.getByLabel('Aula activa')).toHaveValue('sec-3-b');
  await page.getByRole('button',{name:'Tareas',exact:true}).click();
  await expect(page.getByPlaceholder('Ej: Problemas de Porcentajes')).toHaveValue('');
});
