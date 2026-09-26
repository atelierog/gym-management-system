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

  const body=await req.json();
  const gymId=String(body.gym_id||"").trim();
  const status=String(body.owner_status||"").trim();
  if(!gymId) return Response.json({error:"Gym ID is required"},{status:400,headers:CORS});
  if(!["active","suspended"].includes(status)) return Response.json({error:"Owner status must be active or suspended."},{status:400,headers:CORS});

  const {data:gym,error:ge}=await admin.from("gyms").select("id,name,platform_status").eq("id",gymId).single();
  if(ge||!gym) return Response.json({error:"Gym not found."},{status:404,headers:CORS});

  const {data:owner,error:oe}=await admin.from("profiles").update({status}).eq("gym_id",gymId).eq("role","admin").select("id,login_id,status").maybeSingle();
  if(oe) return Response.json({error:oe.message},{status:400,headers:CORS});
  if(!owner) return Response.json({error:"Gym Owner account not found."},{status:404,headers:CORS});

  // platform_admins are not rows in profiles, while audit_logs.actor_id
  // references profiles. Keep the platform actor in JSON details instead
  // of violating the audit_logs foreign key.
  const {error:ae2}=await admin.from("audit_logs").insert({
    gym_id:gymId,
    actor_id:null,
    action:"update_gym_owner_status",
    entity:"profile",
    entity_id:owner.id,
    details:{owner_status:status,platform_admin_id:actor.id}
  });
  if(ae2) return Response.json({error:ae2.message},{status:400,headers:CORS});

  return Response.json({ok:true,gym,owner},{headers:{...CORS,"Content-Type":"application/json"}});
});
