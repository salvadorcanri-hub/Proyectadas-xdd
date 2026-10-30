import {test,expect} from '@playwright/test';
const url=(role:string)=>process.env.SERVE_HOSTED?`http://127.0.0.1:3100/${role==='teacher'?'docentes':'alumnos'}/`:`http://127.0.0.1:${role==='teacher'?3101:3102}/`;
test('administrator creates teacher and student accounts which can log in; ordinary teachers are denied',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();
 const password='Browser-created-only-123';
 try{
 await page.goto(url('teacher'));await page.getByLabel('Usuario',{exact:true}).fill('test-admin');await page.getByLabel('Contraseña',{exact:true}).fill('Browser-test-only-123');await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Administración de cuentas'})).toBeVisible();
 for(const role of ['teacher','student']){
 await page.getByLabel('Tipo de cuenta').selectOption(role);
 await page.getByLabel('Correo de la nueva cuenta').fill(`admin-created-${role}@example.invalid`);
 if(role==='student'){await page.getByLabel('Nombres',{exact:true}).fill('Alumno');await page.getByLabel('Apellidos').fill('Administrado');await page.getByLabel('DNI',{exact:true}).fill('90000112');}
 await page.getByLabel('Contraseña inicial').fill(password);await page.getByLabel('Repetir contraseña').fill(password);
 await page.getByLabel('5.º de secundaria · A',{exact:true}).check();
 await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();await expect(page.getByRole('status')).toContainText('Cuenta creada');
 await expect(page.getByLabel('Contraseña inicial')).toHaveValue('');
 }
 await page.getByRole('button',{name:'Cerrar sesión'}).click();
 for(const role of ['teacher','student']){
 await page.goto(url(role));await page.getByLabel('Usuario',{exact:true}).fill(`admin-created-${role}@example.invalid`);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();await expect(page.getByRole('button',{name:'Administrar cuentas'})).toHaveCount(0);
 const denied=await page.request.post(new URL(`/api/${role}/admin/accounts`,page.url()).href,{headers:{'X-EduPuntos-Client':role},data:{}});expect(denied.status()).toBe(403);
 await page.getByRole('button',{name:'Cerrar sesión'}).click();
 }
 await page.getByRole('button',{name:'DNI',exact:true}).click();await page.getByLabel('DNI',{exact:true}).fill('90000112');await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Hola, Alumno/})).toBeVisible();
 }finally{await context.close();}
});
