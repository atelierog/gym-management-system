import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return Response.json({error:"Method not allowed"},{status:405,headers:CORS});
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,url=Deno.env.get("SUPABASE_URL")!;
  const admin=createClient(url,service);
  const auth=req.headers.get("Authorization");
  if(!auth) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:{user:actor},error:ae}=await admin.auth.getUser(auth.replace("Bearer ",""));
  if(ae||!actor) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:platform}=await admin.from("platform_admins").select("status").eq("id",actor.id).single();
  if(!platform||platform.status!=="active") return Response.json({error:"Super Admin access required"},{status:403,headers:CORS});

  const body=await req.json();
  let gymId=String(body.gym_id||"").trim();

  // Resolve the gym on the trusted server side. The browser previously performed
  // a direct PostgREST lookup before calling this function, which could surface a
  // generic "Failed to fetch" even though the delete function itself was healthy.
  if(!gymId && body.loginId){
    const {data:owner}=await admin.from("profiles").select("gym_id").eq("login_id",String(body.loginId).trim()).eq("role","admin").limit(1).maybeSingle();
    gymId=String(owner?.gym_id||"").trim();
  }
  if(!gymId && body.ownerEmail){
    const {data:owner}=await admin.from("profiles").select("gym_id").eq("email",String(body.ownerEmail).trim().toLowerCase()).eq("role","admin").limit(1).maybeSingle();
    gymId=String(owner?.gym_id||"").trim();
  }
  if(!gymId && body.gymName){
    const {data:gymByName}=await admin.from("gyms").select("id").eq("name",String(body.gymName).trim()).limit(1).maybeSingle();
    gymId=String(gymByName?.id||"").trim();
  }
  if(!gymId) return Response.json({error:"Could not identify the selected gym"},{status:400,headers:CORS});

  const {data:gym,error:ge}=await admin.from("gyms").select("id,name").eq("id",gymId).single();
  if(ge||!gym) return Response.json({error:"Gym not found"},{status:404,headers:CORS});

  const {data:profiles,error:pe}=await admin.from("profiles").select("id,login_id,role").eq("gym_id",gymId);
  if(pe) return Response.json({error:pe.message},{status:400,headers:CORS});

  const authIds=(profiles||[]).map(p=>p.id).filter(Boolean);
  const failures:string[]=[];
  for(const userId of authIds){
    const {error}=await admin.auth.admin.deleteUser(userId);
    if(error) failures.push(userId);
  }

  const {error:deleteGymError}=await admin.from("gyms").delete().eq("id",gymId);
  if(deleteGymError) return Response.json({error:deleteGymError.message,auth_delete_failures:failures.length},{status:400,headers:CORS});

  return Response.json({ok:true,gym_id:gymId,gym_name:gym.name,deleted_accounts:authIds.length,auth_delete_failures:failures.length},{headers:{...CORS,"Content-Type":"application/json"}});
});
