import { createDniLoginHandler } from '../../server/dni-login';

export default async (request: Request, context: { ip: string }) => createDniLoginHandler({
  url: process.env.VITE_SUPABASE_URL,
  publicKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  serverKey: process.env.SUPABASE_SECRET_KEY,
})(request, context.ip);
