import { createAdminAccountsHandler } from '../../server/admin-accounts';
export default async(request:Request)=>createAdminAccountsHandler({url:process.env.VITE_SUPABASE_URL,serverKey:process.env.SUPABASE_SECRET_KEY})(request);
