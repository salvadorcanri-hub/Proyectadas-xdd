import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../server/store';
import { createApp } from '../server/app';
import { createDniLoginHandler } from '../server/dni-login';

test('registration creates only a student; email/DNI share login, data stays private, duplicates roll back', async t => {
  const dir = mkdtempSync(path.join(tmpdir(),'edupuntos-register-'));
  const store = new Store(dir), { app,close } = createApp(store,{secureCookies:false});
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  t.after(async () => { close(); server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r())); store.close(); rmSync(dir,{recursive:true,force:true}); });
  const call = (portal:string,route:string,body:any,cookie='') => fetch(`${base}/api/${portal}${route}`,{method:'POST',headers:{'Content-Type':'application/json','X-EduPuntos-Client':portal,cookie},body:JSON.stringify(body)});
  const data = {classroomId:'sec-1-a',firstName:'Ana',lastName:'Prueba',dni:'00123456',email:'ANA@example.invalid',password:'Student-test-only-123',role:'teacher',studentId:'est-1'};
  const before = store.load().students.length;
  assert.equal((await call('teacher','/auth/register',data)).status,403);
  assert.equal((await call('student','/auth/register',{...data,dni:'ABC'})).status,400);
  const created = await call('student','/auth/register',data); assert.equal(created.status,201);
  assert.match(created.headers.get('set-cookie')!,/HttpOnly/);
  const initialCookie = created.headers.get('set-cookie')!.split(';')[0];
  const snapshot = async (cookie:string) => (await (await fetch(base+'/api/student/state',{headers:{cookie}})).json()).state;
  const initial = await snapshot(initialCookie);
  assert.equal(initial.students[0].name,'Ana Prueba'); assert.notEqual(initial.students[0].id,'est-1');
  assert.equal(JSON.stringify(initial).includes(data.dni),false); assert.equal(JSON.stringify(initial).includes('ana@example.invalid'),false);
  for(const duplicate of [{...data,email:'another@example.invalid'},{...data,dni:'11223344'}]) assert.equal((await call('student','/auth/register',duplicate)).status,400);
  assert.equal(store.load().students.length,before+1);
  await call('student','/auth/logout',{},initialCookie);
  assert.equal((await fetch(base+'/api/student/state',{headers:{cookie:initialCookie}})).status,401);
  for(const username of [data.dni,'ana@example.invalid','ANA@example.invalid']) {
    assert.equal((await call('student','/auth/login',{username,password:'wrong'})).status,401);
    const login = await call('student','/auth/login',{username,password:data.password}); assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie')!.split(';')[0];
    assert.deepEqual((await snapshot(cookie)).students,initial.students);
    assert.equal((await call('student','/rewards',{firstPlace:'hacked'},cookie)).status,403);
    assert.equal((await call('teacher','/auth/login',{username,password:data.password})).status,401);
  }
});

test('DNI function never reveals lookup email or credentials, applies limits, and returns only authenticated tokens', async () => {
  const requests: {url:string;body:any;apikey:string|null}[]=[];
  let allowed=true,known=true;
  const remote: typeof fetch = async (input,init) => {
    const req = new Request(input,init), body=await req.json();
    requests.push({url:req.url,body,apikey:req.headers.get('apikey')});
    if(req.url.includes('/rpc/edu_login_email')) return Response.json({allowed,email:known?'private@example.invalid':null});
    if(req.url.includes('/auth/v1/token')) return body.password==='Correct-password-123' && known ? Response.json({access_token:'access-only-after-auth',refresh_token:'refresh-only-after-auth',token_type:'bearer',expires_in:3600,user:{id:'test-user',email:'private@example.invalid'}}) : Response.json({error:'invalid_grant',error_description:'Invalid login credentials'},{status:400});
    throw new Error('Unexpected endpoint');
  };
  const handler=createDniLoginHandler({url:'https://test-project.supabase.co',publicKey:'sb_publishable_TEST',serverKey:'sb_secret_SERVER_ONLY',fetch:remote});
  const request=(password='Wrong-password-123')=>new Request('https://school.example/.netlify/functions/dni-login',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://school.example'},body:JSON.stringify({dni:'00123456',password})});
  const wrong=await handler(request(),'192.0.2.1'); assert.equal(wrong.status,401);
  const failure=await wrong.text(); assert.equal(failure.includes('private@example.invalid'),false);
  known=false; assert.equal(await (await handler(request(),'192.0.2.1')).text(),failure);
  known=true; const success=await handler(request('Correct-password-123'),'192.0.2.1');
  assert.equal(success.status,200); assert.deepEqual(await success.json(),{access_token:'access-only-after-auth',refresh_token:'refresh-only-after-auth'});
  assert.equal(success.headers.get('cache-control'),'no-store');
  assert.equal(requests[0].body.p_source_hash.length,64); assert.equal(requests[0].body.password,undefined);
  assert.equal(requests.find(r=>r.url.includes('/auth/'))!.apikey,'sb_publishable_TEST');
  allowed=false; const count=requests.length; assert.equal((await handler(request(),'192.0.2.1')).status,429); assert.equal(requests.length,count+1);
  assert.equal((await handler(new Request('https://school.example/x'),'192.0.2.1')).status,405);
  const forged = new Request(request(),{headers:{'Content-Type':'application/json',origin:'https://other.example'}});
  assert.equal((await handler(forged,'192.0.2.1')).status,403);
  assert.equal((await createDniLoginHandler({})(request(),'192.0.2.1')).status,503);
});
