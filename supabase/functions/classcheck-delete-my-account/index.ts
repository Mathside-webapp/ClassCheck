import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const respond = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {status,headers:cors});
Deno.serve(async (req: Request) => {
  if(req.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
  if(req.method !== "POST") return respond(405,{error:"POST only."});
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if(!token) return respond(401,{error:"Sign in first."});
    const body = await req.json().catch(()=>null);
    if(body?.confirmation !== "DELETE MY ACCOUNT" || typeof body?.password !== "string" || !body.password) return respond(400,{error:"Password and explicit deletion confirmation required."});
    const url=Deno.env.get("SUPABASE_URL");
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
    if(!url||!serviceKey||!anonKey) return respond(500,{error:"Server is not configured."});
    const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:{user},error:userError}=await admin.auth.getUser(token);
    if(userError||!user) return respond(401,{error:"You must be signed in to delete your own account."});
    if(!user.email) return respond(400,{error:"Account has no email for password confirmation."});
    // Reconfirm current password on the trusted server; never trust a client-side checkbox alone.
    const verifier=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:verified,error:passwordError}=await verifier.auth.signInWithPassword({email:user.email,password:body.password});
    if(passwordError||verified?.user?.id !== user.id) return respond(403,{error:"Password confirmation failed. Account was not deleted."});
    // User ID comes solely from the validated token, never from browser JSON.
    const {error:deleteError}=await admin.auth.admin.deleteUser(user.id);
    if(deleteError) return respond(500,{error:"Supabase could not delete this account. No successful deletion was confirmed."});
    return respond(200,{deleted:true});
  } catch(err) {
    console.error('classcheck self deletion failed',err);
    return respond(500,{error:"Account deletion failed. Please retry later."});
  }
});
