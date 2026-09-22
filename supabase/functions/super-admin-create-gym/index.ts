import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return new Response("Method not allowed",{status:405,headers:CORS});
  const url=Deno.env.get("SUPABASE_URL")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(url,service);
  const auth=req.headers.get("Authorization");
  if(!auth) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const token=auth.replace("Bearer ","");
  const {data:{user:actor},error:ae}=await admin.auth.getUser(token);
  if(ae||!actor) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:pa}=await admin.from("platform_admins").select("status").eq("id",actor.id).single();
  if(!pa||pa.status!=="active") return Response.json({error:"Super Admin access required"},{status:403,headers:CORS});
  const body=await req.json();
  const name=String(body.name||"").trim(),ownerName=String(body.owner_name||"").trim(),ownerPhone=String(body.owner_phone||"").trim(),requestedLogin=String(body.login_id||"").trim(),password=String(body.password||"");
  if(!name||!ownerName||password.length<8) return Response.json({error:"Gym name, owner name and an 8+ character password are required"},{status:400,headers:CORS});
  const base=(requestedLogin||name).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8)||"GYM";
  let loginId=requestedLogin.toUpperCase().replace(/\s+/g,"").replace(/[^A-Z0-9_-]/g,"");
  if(!loginId) { for(let i=1;i<=999;i++){ const candidate=base+String(i).padStart(2,"0"); const {data:used}=await admin.from("profiles").select("id").eq("login_id",candidate).limit(1); if(!used?.length){loginId=candidate;break;} } }
  if(!loginId) return Response.json({error:"Could not generate a unique GymOS login ID."},{status:409,headers:CORS});
  const {data:existing}=await admin.from("profiles").select("id").eq("login_id",loginId).limit(1);
  if(existing?.length) return Response.json({error:"That login ID is already in use."},{status:409,headers:CORS});
  const {data:gym,error:ge}=await admin.from("gyms").insert({name}).select().single();
  if(ge) return Response.json({error:ge.message},{status:400,headers:CORS});
  const email=loginId.toLowerCase()+"@gymos.local";
  const {data:newUser,error:ue}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(ue){await admin.from("gyms").delete().eq("id",gym.id);return Response.json({error:ue.message},{status:400,headers:CORS});}
  const {data:profile,error:pe}=await admin.from("profiles").insert({id:newUser.user.id,gym_id:gym.id,login_id:loginId,full_name:ownerName,role:"admin",status:"active",phone:ownerPhone||null,password_change_required:true,password_reset_at:new Date().toISOString()}).select().single();
  if(pe){await admin.auth.admin.deleteUser(newUser.user.id);await admin.from("gyms").delete().eq("id",gym.id);return Response.json({error:pe.message},{status:400,headers:CORS});}
  return Response.json({gym,owner:profile,temporary_password:password,password_change_required:true},{headers:{...CORS,"Content-Type":"application/json"}});
});