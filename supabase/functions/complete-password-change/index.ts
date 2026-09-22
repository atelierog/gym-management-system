import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return Response.json({error:"Method not allowed"},{status:405,headers:CORS});
  const url=Deno.env.get("SUPABASE_URL")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(url,service);
  const auth=req.headers.get("Authorization");
  if(!auth) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const token=auth.replace("Bearer ","");
  const {data:{user},error:ae}=await admin.auth.getUser(token);
  if(ae||!user) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:profile,error:pe}=await admin.from("profiles").select("id,status").eq("id",user.id).maybeSingle();
  if(pe) return Response.json({error:pe.message},{status:400,headers:CORS});
  if(!profile||profile.status!=="active") return Response.json({error:"Active account required"},{status:403,headers:CORS});
  const {error}=await admin.from("profiles").update({password_change_required:false}).eq("id",user.id);
  if(error) return Response.json({error:error.message},{status:400,headers:CORS});
  return Response.json({ok:true,password_change_required:false},{headers:{...CORS,"Content-Type":"application/json"}});
});