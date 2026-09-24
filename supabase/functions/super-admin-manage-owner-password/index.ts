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
  const {data:{user:actor},error:ae}=await admin.auth.getUser(token);
  if(ae||!actor) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:pa}=await admin.from("platform_admins").select("status").eq("id",actor.id).maybeSingle();
  if(!pa||pa.status!=="active") return Response.json({error:"Super Admin access required"},{status:403,headers:CORS});
  const body=await req.json();
  const targetId=String(body.user_id||"").trim();
  const action=String(body.action||"").trim();
  if(!targetId||!["reset","force_change"].includes(action)) return Response.json({error:"A valid user and action are required"},{status:400,headers:CORS});
  const {data:target,error:te}=await admin.from("profiles").select("id,gym_id,login_id,full_name,role,status").eq("id",targetId).single();
  if(te||!target) return Response.json({error:"Gym owner account not found"},{status:404,headers:CORS});
  if(target.role!=="admin"||!target.gym_id) return Response.json({error:"Only Gym Owner administrator accounts can be managed here"},{status:400,headers:CORS});
  if(action==="force_change"){
    const {error}=await admin.from("profiles").update({password_change_required:true}).eq("id",target.id);
    if(error) return Response.json({error:error.message},{status:400,headers:CORS});
    await admin.from("audit_logs").insert({gym_id:target.gym_id,actor_id:null,action:"force_password_change",entity:"profile",entity_id:target.id,details:{actor_type:"platform_super_admin",login_id:target.login_id}});
    return Response.json({ok:true,password_change_required:true},{headers:{...CORS,"Content-Type":"application/json"}});
  }
  const password=String(body.password||"");
  const passwordMissing=[];if(password.length<8)passwordMissing.push("at least 8 characters");if(!/[A-Z]/.test(password))passwordMissing.push("1 uppercase letter");if(!/[a-z]/.test(password))passwordMissing.push("1 lowercase letter");if(!/[0-9]/.test(password))passwordMissing.push("1 number");if(!/[^A-Za-z0-9]/.test(password))passwordMissing.push("1 special character");if(passwordMissing.length)return Response.json({error:"Password must contain "+passwordMissing.join(", ")+"."},{status:400,headers:CORS});
  const {error:ue}=await admin.auth.admin.updateUserById(target.id,{password});
  if(ue) return Response.json({error:ue.message},{status:400,headers:CORS});
  const now=new Date().toISOString();
  const {error:pe}=await admin.from("profiles").update({password_change_required:true,password_reset_at:now}).eq("id",target.id);
  if(pe) return Response.json({error:pe.message},{status:400,headers:CORS});
  await admin.from("audit_logs").insert({gym_id:target.gym_id,actor_id:null,action:"reset_password",entity:"profile",entity_id:target.id,details:{actor_type:"platform_super_admin",login_id:target.login_id}});
  return Response.json({ok:true,temporary_password:password,password_change_required:true},{headers:{...CORS,"Content-Type":"application/json"}});
});