import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return Response.json({error:"Method not allowed"},{status:405,headers:CORS});
  const auth=req.headers.get("Authorization");
  if(!auth) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token=auth.replace("Bearer ","");
  const {data:{user:actor},error:ae}=await admin.auth.getUser(token);
  if(ae||!actor) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:platform}=await admin.from("platform_admins").select("id,status").eq("id",actor.id).single();
  if(!platform||platform.status!=="active") return Response.json({error:"Super Admin access required"},{status:403,headers:CORS});

  const b=await req.json(),gymId=String(b.gym_id||"");
  if(!gymId) return Response.json({error:"Gym ID is required"},{status:400,headers:CORS});
  const phone=String(b.phone||"").trim(),gymStatus=String(b.gym_status||"active"),ownerStatus=String(b.owner_status||"active");
  if(!["active","suspended"].includes(gymStatus)) return Response.json({error:"Gym status must be active or suspended."},{status:400,headers:CORS});
  if(!["active","suspended"].includes(ownerStatus)) return Response.json({error:"Owner status must be active or suspended."},{status:400,headers:CORS});

  const {error:pe}=await admin.from("profiles").update({phone:phone||null}).eq("gym_id",gymId).eq("role","admin");
  if(pe) return Response.json({error:pe.message},{status:400,headers:CORS});
  const {error:oe}=await admin.from("profiles").update({status:ownerStatus}).eq("gym_id",gymId).eq("role","admin");
  if(oe) return Response.json({error:oe.message},{status:400,headers:CORS});
  const {data:gym,error:ge}=await admin.from("gyms").update({platform_status:gymStatus}).eq("id",gymId).select().single();
  if(ge) return Response.json({error:ge.message},{status:400,headers:CORS});

  await admin.from("audit_logs").insert({gym_id:gymId,actor_id:actor.id,action:"update_platform_gym_details",entity:"gym",entity_id:gymId,details:{gym_status:gymStatus,owner_status:ownerStatus}});
  return Response.json({gym},{headers:{...CORS,"Content-Type":"application/json"}});
});
