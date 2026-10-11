import { test, expect } from '@playwright/test';
import { seedState } from '../../server/seed';
import { calculateStudentScores } from '../../src/utils/scoreCalculator';
import { workbookBuffer, readWorkbook } from '../workbook-helpers';
import { readFileSync } from 'node:fs';
import { markedPhoto } from '../photo-fixture';

test('Netlify bundles: separate Supabase logins, lost upload response recovery, grading and Excel (mocked HTTP boundary)', async ({ browser }) => {
  const state = seedState(); state.submissions=[]; state.grades=[]; state.students.forEach(s=>s.avatar='');
  const users = {
    'teacher@test.invalid': { id:'10000000-0000-4000-8000-000000000001', username:'teacher@test.invalid', role:'teacher', studentId:null },
    'student@test.invalid': { id:'10000000-0000-4000-8000-000000000002', username:'student@test.invalid', role:'student', studentId:'est-1' },
  };
  const context = await browser.newContext();
  const unexpected: string[] = [];
  const errors: string[] = [];
  let submissions = 0; let uploads = 0; let signedRequests = 0;
  const sockets: any[] = [];
  await context.routeWebSocket('wss://test-project.supabase.co/**', ws => {
    ws.onMessage(message => {
      const [join_ref, ref, topic, event] = JSON.parse(message.toString());
      if (event==='phx_join') {
        sockets.push({ws,topic,join_ref});
        ws.send(JSON.stringify([join_ref,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:[{id:1,event:'UPDATE',schema:'public',table:'edu_changes'}]}}]));
      } else if (event==='heartbeat' || event==='phx_leave') ws.send(JSON.stringify([join_ref,ref,topic,'phx_reply',{status:'ok',response:{}}]));
    });
  });
  function notify() {
    for(const {ws,topic,join_ref} of sockets) ws.send(JSON.stringify([join_ref,null,topic,'postgres_changes',{ids:[1],data:{schema:'public',table:'edu_changes',type:'UPDATE',commit_timestamp:new Date().toISOString(),columns:[{name:'id',type:'bool'},{name:'revision',type:'int8'}],record:{id:true,revision:1},old_record:{id:true},errors:null}}]));
  }
  await context.route('https://test-project.supabase.co/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    const body = req.headers()['content-type']?.includes('application/json') ? req.postDataJSON() || {} : {};
    const reply = (data: unknown, status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(url.pathname==='/auth/v1/token') {
      const user = users[body.email as keyof typeof users];
      if(!user || body.password!=='Test-only-password-123') return reply({error:'invalid_grant',error_description:'Invalid login credentials'},400);
      const encoded = Buffer.from(JSON.stringify({sub:user.id,email:user.username,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
      return reply({access_token:`header.${encoded}.test`,refresh_token:`test-refresh-${user.role}`,token_type:'bearer',expires_in:3600,user:{id:user.id,email:user.username,role:'authenticated',aud:'authenticated',created_at:new Date().toISOString()}});
    }
    if(url.pathname==='/auth/v1/logout') return reply({});
    if(url.pathname.startsWith('/storage/v1/object/sign/edupuntos-homework/')) return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
    const token = req.headers().authorization?.replace('Bearer ','');
    let user: typeof users[keyof typeof users] | undefined;
    try { const claims = JSON.parse(Buffer.from(token!.split('.')[1],'base64url').toString()); user = Object.values(users).find(u=>u.id===claims.sub); } catch { /* Anonymous request. */ }
    if(!user) return reply({message:'Unauthorized'},401);
    const name = url.pathname.split('/').pop();
    if(name==='edu_current_user') return reply(user);
    if(name==='edu_state') {
      const own = user.role==='teacher' ? state : {...state,students:state.students.filter(s=>s.id===user.studentId),submissions:state.submissions.filter(s=>s.studentId===user.studentId),grades:state.grades.filter(g=>g.studentId===user.studentId)};
      return reply({...own,ranking:calculateStudentScores(state)});
    }
    if(url.pathname.startsWith('/storage/v1/object/edupuntos-homework/')) { uploads++; return reply({Key:url.pathname.split('/object/')[1]}); }
    if(url.pathname==='/storage/v1/object/sign/edupuntos-homework') {
      signedRequests++;
      return reply(body.paths.map((p:string)=>({path:p,signedURL:`/object/sign/edupuntos-homework/${p}?token=test-only`,error:null})));
    }
    if(name==='edu_submit') {
      submissions++;
      state.submissions.push({id:'submitted',studentId:user.studentId!,assignmentId:body.p_assignment_id,photoUrl:body.p_photo_path,submittedAt:new Date().toISOString(),comment:body.p_comment,photoReading:body.p_photo_reading});
      notify(); return route.abort('failed');
    }
    if(name==='edu_set_grade') {
      state.grades.push({studentId:body.p_student_id,assignmentId:body.p_assignment_id,grade:body.p_grade,feedback:body.p_feedback,updatedAt:new Date().toISOString()});
      notify(); return reply(null);
    }
    if(name==='edu_import_grades') {
      for(const change of body.p_changes) {
        const record = state.grades.find(g=>g.studentId===change.studentId && g.assignmentId===change.assignmentId);
        if(record) record.grade=change.grade; else state.grades.push({...change,updatedAt:new Date().toISOString()});
      }
      notify(); return reply(body.p_changes.length);
    }
    unexpected.push(url.pathname); return reply({message:'Unexpected test request'},500);
  });
  const teacher = await context.newPage(); const student = await context.newPage();
  teacher.on('pageerror',e=>errors.push(e.message)); student.on('pageerror',e=>errors.push(e.message));
  await teacher.goto('http://127.0.0.1:3200/');
  await teacher.getByRole('link',{name:/Profesores/}).click();
  await student.goto('http://127.0.0.1:3200/alumnos/');
  for(const [page,email] of [[teacher,'teacher@test.invalid'],[student,'student@test.invalid']] as const) {
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña',{exact:true}).fill('Test-only-password-123');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
  }
  await student.getByRole('button',{name:'Tomar / Subir Foto',exact:true}).first().click();
  await student.locator('input[type=file]').setInputFiles(await markedPhoto(student, 'AD'));
  await expect(student.getByRole('status')).toHaveText('Nota detectada en la foto: AD', {timeout:35000});
  await student.getByRole('button',{name:'Confirmar Entrega',exact:true}).click();
  await expect(student.getByRole('heading',{name:/Subir Foto:/})).toHaveCount(0);
  expect(uploads).toBe(1); expect(submissions).toBe(1); expect(signedRequests).toBeGreaterThan(0);
  await expect(student.getByText('Espera la próxima actualización', {exact:true})).toBeVisible();
  await teacher.getByRole('button',{name:'Planilla Rápida'}).click();
  const row = teacher.getByRole('row').filter({hasText:'Camila Mendoza'});
  await expect(row.getByTitle('Ver foto de la tarea')).toBeVisible();
  await row.locator('select').first().selectOption('AD');
  await student.getByRole('button',{name:'Mi Libreta'}).click();
  await expect(student.getByText('Nota AD',{exact:true})).toBeVisible();
  await expect(student.getByText('Coincide con Excel',{exact:true})).toBeVisible();
  await teacher.getByRole('button',{name:'Conectar Excel'}).click();
  const downloaded = teacher.waitForEvent('download');
  await teacher.getByRole('button',{name:'Descargar .XLSX'}).click();
  const download = await downloaded;
  const sheet = await readWorkbook(readFileSync((await download.path())!));
  sheet[1][2] = 'B';
  await teacher.locator('input[type=file]').setInputFiles({name:'notas.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await workbookBuffer(sheet)});
  await teacher.getByRole('button',{name:'Confirmar y Guardar Notas'}).click();
  await expect(student.getByText('Nota B',{exact:true})).toBeVisible();
  await expect(student.getByText('Las notas son diferentes',{exact:true})).toBeVisible();
  await student.getByRole('button',{name:'Cerrar sesión'}).click();
  await expect(student.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
  await teacher.reload(); await expect(teacher.getByRole('button',{name:'Cerrar sesión'})).toBeVisible();
  // Compiled pages must enforce the CSP generated for this project.
  const violation = teacher.evaluate(() => new Promise<string>(resolve => {
    document.addEventListener('securitypolicyviolation', event => resolve(event.violatedDirective), { once: true });
    const script = document.createElement('script'); script.textContent = 'window.__edupuntosInjected = true'; document.body.append(script);
  }));
  expect(await violation).toBe('script-src-elem');
  expect(await teacher.evaluate(() => (window as any).__edupuntosInjected)).toBeUndefined();
  expect(unexpected).toEqual([]); expect(errors).toEqual([]);
  await context.close();
});
