import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
function json(data:Record<string,unknown>,status=200){return Response.json(data,{status,headers:{...CORS,"Content-Type":"application/json"}})}

async function requireSuperAdmin(admin:any,req:Request){
  const auth=req.headers.get("Authorization");
  if(!auth) throw new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...CORS,"Content-Type":"application/json"}});
  const {data:{user:actor},error:ae}=await admin.auth.getUser(auth.replace(/^Bearer\s+/i,""));
  if(ae||!actor) throw new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...CORS,"Content-Type":"application/json"}});
  const {data:platform,error:pe}=await admin.from("platform_admins").select("status").eq("id",actor.id).maybeSingle();
  if(pe) throw new Response(JSON.stringify({error:pe.message}),{status:500,headers:{...CORS,"Content-Type":"application/json"}});
  if(!platform||platform.status!=="active") throw new Response(JSON.stringify({error:"Super Admin access required"}),{status:403,headers:{...CORS,"Content-Type":"application/json"}});
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,url=Deno.env.get("SUPABASE_URL")!;
  const admin=createClient(url,service);
  try{
    await requireSuperAdmin(admin,req);
    let body:any={};try{body=await req.json()}catch{return json({error:"Invalid request body."},400)}
    let gymId=String(body.gym_id||"").trim();
    const loginId=String(body.loginId||body.login_id||"").trim();
    const ownerEmail=String(body.ownerEmail||body.owner_email||"").trim().toLowerCase();
    const gymName=String(body.gymName||body.gym_name||"").trim();
    const action=String(body.action||"suspend").toLowerCase()==="activate"?"active":"suspended";
    if(!gymId&&loginId){const {data:owner}=await admin.from("profiles").select("gym_id").eq("login_id",loginId).eq("role","admin").maybeSingle();gymId=owner?.gym_id||"";}
    if(!gymId&&ownerEmail){const {data:owner}=await admin.from("profiles").select("gym_id").eq("email",ownerEmail).eq("role","admin").maybeSingle();gymId=owner?.gym_id||"";}
    if(!gymId&&gymName){const {data:gyms}=await admin.from("gyms").select("id").eq("name",gymName).limit(2);if(gyms?.length===1)gymId=gyms[0].id;else if((gyms?.length||0)>1)return json({error:"Multiple gyms have this name. Reopen the gym profile and try again."},409)}
    if(!gymId)return json({error:"Could not identify this gym."},404);
    const {data:gym,error:ge}=await admin.from("gyms").select("id,name,platform_status").eq("id",gymId).maybeSingle();
    if(ge)return json({error:ge.message},500);
    if(!gym)return json({error:"Gym not found."},404);
    const {data:updatedRows,error:ue}=await admin.from("gyms").update({platform_status:action}).eq("id",gymId).select("id,name,platform_status");
    if(ue)return json({error:ue.message},400);
    const updated=updatedRows?.[0];
    if(!updated)return json({error:"Gym status could not be updated."},409);
    return json({ok:true,gym:updated,gym_id:gymId,gym_name:gym.name,platform_status:action});
  }catch(error){
    if(error instanceof Response)return error;
    return json({error:error instanceof Error?error.message:"Unexpected error"},500);
  }
});
