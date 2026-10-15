import { test, expect } from '@playwright/test';

test('new student registers, signs out, and signs in with either DNI or email', async ({ page }, testInfo) => {
  const errors: string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});
  await page.route('**/images.unsplash.com/**',route=>route.abort());
  const url=process.env.SERVE_HOSTED?'http://127.0.0.1:3100/alumnos/':'http://127.0.0.1:3102/';
  await page.goto(url);
  await expect(page.getByText('Configuración',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Crear cuenta de alumno',exact:true}).click();
  await page.getByLabel('Grado y sección').selectOption('sec-1-a');
  await page.getByLabel('Nombres',{exact:true}).fill('Ana María');
  await page.getByLabel('Apellidos',{exact:true}).fill('Prueba Escolar');
  await page.getByLabel('DNI',{exact:true}).fill('00334455');
  await page.getByLabel('Correo electrónico',{exact:true}).fill('ana.browser@example.invalid');
  await page.getByLabel('Contraseña',{exact:true}).fill('Register-test-only-123');
  await page.getByLabel('Repite la contraseña',{exact:true}).fill('Register-test-only-123');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('student-registration-mobile.png'),fullPage:true});
  await page.getByLabel('Repite la contraseña',{exact:true}).fill('Another-password-123');
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Las contraseñas no coinciden.');
  await page.getByLabel('Repite la contraseña',{exact:true}).fill('Register-test-only-123');
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
  await expect(page.getByRole('heading',{name:/Hola, Ana/})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
  await page.getByRole('button',{name:'Configuración',exact:true}).click();
  await page.getByLabel('Tema de la aplicación').selectOption('dark');
  await page.getByRole('button',{name:'Cerrar configuración'}).click();
  await page.getByRole('button',{name:'Cerrar sesión'}).click();
  for(const [method,value] of [['DNI','00334455'],['Correo electrónico','ana.browser@example.invalid']]) {
    await expect(page.getByText('Configuración',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:method,exact:true}).click();
    await page.getByLabel(method==='DNI'?'DNI':'Usuario',{exact:true}).fill(value);
    if(method==='DNI') await page.screenshot({path:testInfo.outputPath('student-dni-login-dark.png'),fullPage:true});
    await page.getByLabel('Contraseña',{exact:true}).fill('wrong-password');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('incorrectos');
    await page.getByLabel('Contraseña',{exact:true}).fill('Register-test-only-123');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page.getByRole('heading',{name:/Hola, Ana/})).toBeVisible();
    await page.getByRole('button',{name:'Cerrar sesión'}).click();
  }
  expect(errors).toEqual([]);
});
