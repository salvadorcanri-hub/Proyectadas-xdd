import { test, expect } from '@playwright/test';

test('independent apps: student submits, teacher grades, both receive live updates', async ({ browser }) => {
  const context = await browser.newContext();
  await context.route('**/images.unsplash.com/**', route => route.abort());
  const teacher = await context.newPage(); const student = await context.newPage();
  if (process.env.SERVE_HOSTED) {
    await teacher.goto('http://127.0.0.1:3100/');
    await expect(teacher.getByRole('link', { name: /Profesores/ })).toHaveAttribute('href', '/docentes/');
    await expect(teacher.getByRole('link', { name: /Alumnos/ })).toHaveAttribute('href', '/alumnos/');
    const redirect = await teacher.request.get('http://127.0.0.1:3100/docentes', { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    const missing = await teacher.request.get('http://127.0.0.1:3100/docentes/assets/missing.js');
    expect(missing.status()).toBe(404);
  }
  const errors: string[] = [];
  teacher.on('pageerror', error => errors.push(error.message)); student.on('pageerror', error => errors.push(error.message));
  for (const [page, port, username, title] of [[teacher,3101,'test-teacher','EduPuntos Docentes'],[student,3102,'test-student','EduPuntos Alumnos']] as const) {
    await page.goto(process.env.SERVE_HOSTED ? `http://127.0.0.1:3100/${port === 3101 ? 'docentes' : 'alumnos'}/` : `http://127.0.0.1:${port}`);
    await expect(page.getByRole('heading', { name:title,exact:true })).toBeVisible();
    await page.getByLabel('Usuario',{exact:true}).fill(username);
    await page.getByLabel('Contraseña',{exact:true}).fill('Browser-test-only-123');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
  }
  // Cookies use separate paths, so both identities coexist even in one browser context.
  await teacher.reload(); await expect(teacher.getByRole('button',{name:'Conectar Excel',exact:true})).toBeVisible();
  await expect(student.getByRole('button',{name:'Conectar Excel',exact:true})).toHaveCount(0);
  await expect(student.getByTitle('Cambiar de estudiante')).toHaveCount(0);
  await expect(student.getByRole('button',{name:/App Docente/})).toHaveCount(0);
  await expect(student.locator('header')).toHaveCSS('position', 'sticky');
  await teacher.getByRole('button',{name:'Tareas',exact:true}).click();
  await teacher.getByPlaceholder('Ej: Problemas de Porcentajes').fill('Tarea de integración');
  await teacher.locator('input[type=date]').fill('2026-12-01');
  await teacher.getByPlaceholder('Detalles sobre los ejercicios y cómo tomar la foto...').fill('Subir una foto');
  await teacher.getByRole('button',{name:'Publicar Tarea',exact:true}).click();
  await expect(student.getByRole('heading',{name:'Tarea de integración',exact:true})).toBeVisible();
  const card = student.locator('div').filter({has:student.getByRole('heading',{name:'Tarea de integración',exact:true})}).filter({has:student.getByRole('button',{name:/Subir|Enviar/})}).last();
  await card.getByRole('button',{name:/Subir|Enviar/}).click();
  await student.locator('input[type=file]').setInputFiles({name:'tarea.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  const hostileComment = '<img src=x onerror=window.__commentXss=true>';
  await student.locator('textarea').fill(hostileComment);
  await student.getByRole('button',{name:'Confirmar Entrega',exact:true}).click();
  await expect(student.getByRole('button',{name:'Confirmar Entrega',exact:true})).toHaveCount(0);
  await teacher.getByRole('navigation').getByRole('button',{name:/Revisar Fotos/}).click();
  const reviewId = await teacher.getByRole('option',{name:/Tarea de integración/}).getAttribute('value');
  await teacher.getByLabel('Filtrar por Tarea:').selectOption(reviewId!);
  await expect(teacher.getByText(hostileComment)).toBeVisible();
  expect(await teacher.evaluate(() => (window as any).__commentXss)).toBeUndefined();
  await teacher.getByRole('button',{name:'Planilla Rápida'}).click();
  const row = teacher.getByRole('row').filter({hasText:'Camila Mendoza'});
  const grade = row.locator('select').last();
  await expect(row.getByTitle('Ver foto de la tarea').last()).toBeVisible();
  await grade.selectOption('AD');
  await student.getByRole('button',{name:'Mi Libreta'}).click();
  const report = student.locator('div.py-3\\.5').filter({hasText:'Tarea de integración'});
  await expect(report.getByText('Nota AD')).toBeVisible();
  await student.getByRole('button',{name:'Cerrar sesión'}).click();
  await expect(student.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
  await teacher.reload(); await expect(teacher.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
