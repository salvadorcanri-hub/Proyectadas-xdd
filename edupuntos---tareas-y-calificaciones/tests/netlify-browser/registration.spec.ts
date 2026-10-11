import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

test('the private server key is absent from every published file', () => {
  for(const file of readdirSync('dist/netlify',{recursive:true}).filter((file): file is string => typeof file==='string' && /\.(js|html|css)$/.test(file))) {
    expect(readFileSync(path.join('dist/netlify',file),'utf8')).not.toContain('sb_secret_SERVER_ONLY_BUNDLE_TEST');
  }
});

test('Netlify registration, email confirmation, DNI/email login and role checks (mocked Supabase)', async ({ context,page }) => {
  const user={id:'20000000-0000-4000-8000-000000000001',email:'ana.netlify@example.invalid',role:'authenticated',aud:'authenticated'};
  const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test`;
  const session={access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user};
  let signedUp=false,confirmed=false,role='student',dniCalls=0;
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await context.routeWebSocket('wss://test-project.supabase.co/**',ws=>ws.close());
  await context.route('https://test-project.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url()),body=req.postData()?req.postDataJSON():{};
    const reply=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'x-supabase-api-version':'2024-01-01','access-control-expose-headers':'X-Supabase-Api-Version'},body:JSON.stringify(data)});
    if(url.pathname.endsWith('/edu_registration_available')) return reply(true);
    if(url.pathname==='/auth/v1/signup') {
      expect(body.data).toEqual({signup_kind:'student',first_name:'Ana',last_name:'Prueba',dni:'00889900'});
      expect(body.email).toBe(user.email); signedUp=true; return reply({...user,identities:[{id:'test'}]});
    }
    if(url.pathname==='/auth/v1/token') {
      if(!confirmed) return reply({code:'email_not_confirmed',msg:'Email not confirmed'},400);
      if(body.password!=='Netlify-student-test-123') return reply({code:'invalid_credentials',msg:'Invalid credentials'},400);
      return reply(session);
    }
    if(url.pathname==='/auth/v1/user') return reply(user);
    if(url.pathname==='/auth/v1/logout') return reply({});
    if(url.pathname.endsWith('/edu_current_user')) return reply({id:user.id,username:user.email,role,studentId:'registered-1'});
    if(url.pathname.endsWith('/edu_state')) return reply({students:[{id:'registered-1',name:'Ana Prueba',code:'EST-TEST',avatar:''}],assignments:[],submissions:[],grades:[],ranking:[],rewards:{firstPlace:'Uno',secondPlace:'Dos',thirdPlace:'Tres'}});
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  await context.route('**/.netlify/functions/dni-login',async route=>{
    const body=route.request().postDataJSON(); expect(body.dni).toBe('00889900');dniCalls++;
    const ok=body.password==='Netlify-student-test-123';
    await route.fulfill({status:ok?200:401,contentType:'application/json',body:JSON.stringify(ok?{access_token:token,refresh_token:'test-refresh'}:{error:'No se pudo iniciar sesión. Revisa tus datos.'})});
  });
  await page.goto('http://127.0.0.1:3200/alumnos/');
  await expect(page.getByText('Configuración',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Crear cuenta de alumno'}).click();
  for(const [label,value] of [['Nombres','Ana'],['Apellidos','Prueba'],['DNI','00889900'],['Correo electrónico',user.email],['Contraseña','Netlify-student-test-123'],['Repite la contraseña','Netlify-student-test-123']]) await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Revisa tu correo');expect(signedUp).toBe(true);
  await page.getByLabel('Contraseña',{exact:true}).fill('Netlify-student-test-123');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Confirma tu correo');
  confirmed=true;
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
  await page.getByRole('button',{name:'Configuración',exact:true}).click();
  await page.getByLabel('Tema de la aplicación').selectOption('dark');
  const second=await context.newPage();await second.goto('http://127.0.0.1:3200/');
  await expect(second.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(second.getByText('Configuración',{exact:true})).toHaveCount(0);await second.close();
  await page.getByRole('button',{name:'Cerrar configuración'}).click();
  await page.getByRole('button',{name:'Cerrar sesión'}).click();
  await page.getByRole('button',{name:'DNI',exact:true}).click();
  await page.getByLabel('DNI',{exact:true}).fill('00889900');
  await page.getByLabel('Contraseña',{exact:true}).fill('Wrong-password-123');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Revisa tus datos');
  await page.getByLabel('Contraseña',{exact:true}).fill('Netlify-student-test-123');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();expect(dniCalls).toBe(2);
  await page.reload();await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
  await page.getByRole('button',{name:'Cerrar sesión'}).click();
  await page.goto('http://127.0.0.1:3200/docentes/');
  await expect(page.getByRole('button',{name:'Crear cuenta de alumno'})).toHaveCount(0);
  await page.getByLabel('Correo electrónico',{exact:true}).fill(user.email);
  await page.getByLabel('Contraseña',{exact:true}).fill('Netlify-student-test-123');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('no tiene acceso');
  role='teacher';
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
  expect(errors).toEqual([]);
});
