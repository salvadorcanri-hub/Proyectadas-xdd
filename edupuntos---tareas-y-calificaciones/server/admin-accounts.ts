import { createClient } from '@supabase/supabase-js';
import { validateNewAccount, type NewAccount } from '../src/utils/admin-account';
export function createAdminAccountsHandler(config: { url?: string; serverKey?: string; fetch?: typeof fetch }) {
 const reply=(status:number,body:object)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 return async(request:Request):Promise<Response>=>{
  if(request.method!=='POST') return reply(405,{error:'Método no permitido.'});
  if(!request.headers.get('content-type')?.startsWith('application/json') || (request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin)) return reply(403,{error:'Solicitud no permitida.'});
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!token) return reply(401,{error:'Inicia sesión como administrador.'});
  if(!config.url || !config.serverKey) return reply(503,{error:'Falta configurar la administración en Netlify.'});
  try {
   const admin=createClient(config.url,config.serverKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:config.fetch || ((input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)}))}});
   const identity=await admin.auth.getUser(token);
   if(identity.error || !identity.data.user) return reply(401,{error:'Inicia sesión de nuevo.'});
   const access=await admin.rpc('edu_authorize_account_creation',{p_actor:identity.data.user.id});
   if(access.error) return reply(access.error.code==='42501'?403:503,{error:access.error.code==='42501'?'Solo el administrador puede crear cuentas.':'Falta activar o verificar la migración 006.'});
   if(!access.data) return reply(429,{error:'Has alcanzado 20 intentos. Espera 15 minutos.'});
   const reader=request.body?.getReader(); if(!reader) return reply(400,{error:'Completa los datos.'});
   const chunks:Uint8Array[]=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>8192){await reader.cancel();return reply(413,{error:'Solicitud demasiado grande.'});}chunks.push(value);}
   let data:NewAccount;
   try{data=validateNewAccount(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){return reply(400,{error:error instanceof SyntaxError?'Solicitud inválida.':(error as Error).message});}
   const created=await admin.auth.admin.createUser({email:data.email,password:data.password,email_confirm:true,
    ...(data.role==='student'?{user_metadata:{signup_kind:'student',first_name:data.firstName,last_name:data.lastName,dni:data.dni,classroom_id:data.classroomIds[0]}}:{app_metadata:{edu_role:'teacher',edu_classrooms:data.classroomIds}})});
   if(created.error) return reply(created.error.status && created.error.status<500?400:503,{error:created.error.status && created.error.status<500?'No se pudo crear la cuenta. Revisa si el correo o DNI ya existe y comprueba los datos.':'No pudimos confirmar la creación. Revisa Authentication en Supabase antes de repetir.'});
   return reply(201,{message:'Cuenta creada. Ya puede iniciar sesión con su correo y contraseña.'});
  }catch{return reply(503,{error:'No pudimos confirmar la creación. Revisa Authentication en Supabase antes de repetir.'});}
 };
}
