import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};

function json(data:Record<string,unknown>,status=200){return Response.json(data,{status,headers:{...CORS,"Content-Type":"application/json"}})}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);

  const auth=req.headers.get("Authorization");
  if(!auth) return json({error:"Unauthorized"},401);

  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token=auth.replace(/^Bearer\s+/i,"");
  const {data:{user:actor},error:ae}=await admin.auth.getUser(token);
  if(ae||!actor) return json({error:"Unauthorized"},401);

  const {data:platform,error:pe}=await admin.from("platform_admins").select("id,status").eq("id",actor.id).maybeSingle();
  if(pe) return json({error:pe.message},500);
  if(!platform||platform.status!=="active") return json({error:"Super Admin access required"},403);

  let body:any={};
  try{body=await req.json()}catch{return json({error:"Invalid request body."},400)}
  const gymId=String(body.gym_id||"").trim();
  const status=String(body.owner_status||"").trim();
  if(!gymId) return json({error:"Gym ID is required"},400);
  if(!["active","suspended"].includes(status)) return json({error:"Owner status must be active or suspended."},400);

  const {data:gym,error:ge}=await admin.from("gyms").select("id,name,platform_status").eq("id",gymId).maybeSingle();
  if(ge) return json({error:ge.message},500);
  if(!gym) return json({error:"Gym not found."},404);

  const {data:ownerRows,error:ue}=await admin.from("profiles").update({status}).eq("gym_id",gymId).eq("role","admin").select("id,login_id,status");
  if(ue) return json({error:ue.message},400);
  const owner=ownerRows?.[0];
  if(!owner) return json({error:"Gym Owner account not found."},404);

  let auditRecorded=true;
  const {error:ae2}=await admin.from("audit_logs").insert({
    gym_id:gymId,
    actor_id:null,
    action:"update_gym_owner_status",
    entity:"profile",
    entity_id:owner.id,
    details:{owner_status:status,platform_admin_id:actor.id}
  });
  if(ae2) auditRecorded=false;

  return json({ok:true,gym,owner,audit_recorded:auditRecorded});
});
