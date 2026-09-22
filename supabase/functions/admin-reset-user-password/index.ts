import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};

Deno.serve(async (req) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return Response.json({error:"Method not allowed"},{status:405,headers:CORS});
  const auth=req.headers.get("Authorization");
  if(!auth) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const url=Deno.env.get("SUPABASE_URL")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(url,service);
  const token=auth.replace("Bearer ","");
  const {data:{user:actor},error:ae}=await admin.auth.getUser(token);
  if(ae||!actor) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:actorProfile}=await admin.from("profiles").select("gym_id,role").eq("id",actor.id).single();
  if(!actorProfile||actorProfile.role!=="admin") return Response.json({error:"Admin access required"},{status:403,headers:CORS});
  const body=await req.json();
  const userId=String(body.user_id||"");
  const password=String(body.password||"");
  if(!userId||password.length<8) return Response.json({error:"user_id and a password of at least 8 characters are required"},{status:400,headers:CORS});
  const {data:target}=await admin.from("profiles").select("id,login_id,full_name,role,gym_id,status").eq("id",userId).eq("gym_id",actorProfile.gym_id).single();
  if(!target||!["member","trainer"].includes(target.role)) return Response.json({error:"Member or trainer not found in this gym"},{status:404,headers:CORS});
  const {error:ue}=await admin.auth.admin.updateUserById(target.id,{password});
  if(ue) return Response.json({error:ue.message},{status:400,headers:CORS});
  const {error:pe}=await admin.from("profiles").update({password_change_required:true,password_reset_at:new Date().toISOString()}).eq("id",target.id);
  if(pe) return Response.json({error:pe.message},{status:400,headers:CORS});
  await admin.from("audit_logs").insert({gym_id:actorProfile.gym_id,actor_id:actor.id,action:"reset_password",entity:target.role,entity_id:target.id,details:{login_id:target.login_id}});
  return Response.json({ok:true,login_id:target.login_id,password_change_required:true},{headers:{...CORS,"Content-Type":"application/json"}});
});