import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdminAccountsHandler} from '../server/admin-accounts';
const input={role:'teacher',email:'new@example.invalid',password:'Test-only-password-123',classroomIds:['sec-1-a']};
test('Netlify account creation verifies identity and admin status before privileged Auth writes',async()=>{
 let permission=true, valid=true, allowed=true;const writes:any[]=[];
 const handler=createAdminAccountsHandler({url:'https://test.supabase.co',serverKey:'sb_secret_TEST',fetch:async(url,options)=>{
  const path=String(url);
  if(path.endsWith('/auth/v1/user')) return Response.json(valid?{id:'admin-id',email:'admin@example.invalid'}:{msg:'Invalid token'},{status:valid?200:401});
  if(path.includes('/rpc/edu_authorize_account_creation')) {assert.deepEqual(JSON.parse(String(options?.body)),{p_actor:'admin-id'});return Response.json(permission?allowed:{code:'42501',message:'denied'},{status:permission?200:403});}
  if(path.endsWith('/auth/v1/admin/users')) {writes.push(JSON.parse(String(options?.body)));return Response.json({id:'new-user',email:input.email});}
  throw new Error('Unexpected request');
 }});
 const request=(data:any=input,token=true)=>new Request('https://app.example/.netlify/functions/admin-accounts',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer verified-token'}:{})},body:JSON.stringify(data)});
 assert.equal((await handler(request(input,false))).status,401);
 valid=false;assert.equal((await handler(request())).status,401);valid=true;
 permission=false;assert.equal((await handler(request())).status,403);permission=true;
 allowed=false;assert.equal((await handler(request())).status,429);allowed=true;
 assert.equal(writes.length,0);
 assert.equal((await handler(request({...input,role:'admin'}))).status,400);
 assert.equal((await handler(request({...input,password:'too-short'}))).status,400);
 assert.equal((await handler(request({...input,classroomIds:['sec-6-a']}))).status,400);
 assert.equal((await handler(request())).status,201);
 assert.deepEqual(writes[0].app_metadata,{edu_role:'teacher',edu_classrooms:['sec-1-a']});
 assert.equal(writes[0].email_confirm,true);
 assert.equal((await handler(request({...input,role:'student',firstName:'Alumno',lastName:'Prueba',dni:'90000111'}))).status,201);
 assert.equal(writes[1].user_metadata.signup_kind,'student');assert.equal(writes[1].app_metadata,undefined);
 const response=await handler(request());assert.equal(JSON.stringify(await response.json()).includes(input.password),false);
});
