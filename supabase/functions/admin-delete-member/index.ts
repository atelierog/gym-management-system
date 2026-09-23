import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return json({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization"); if(!auth) return json({error:"Unauthorized"},401);
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const token=auth.replace(/^Bearer\s+/,"");
 const {data:{user:actor},error:ae}=await admin.auth.getUser(token);
 if(ae||!actor) return json({error:"Unauthorized"},401);
 const {data:ap}=await admin.from("profiles").select("gym_id,role").eq("id",actor.id).single();
 if(!ap||ap.role!=="admin") return json({error:"Admin access required"},403);
 let body:Record<string,unknown>; try{body=await req.json()}catch{return json({error:"Invalid JSON request"},400)}
 const memberId=String(body.member_id||"").trim(); if(!memberId) return json({error:"member_id is required"},400);
 const {data:member,error:me}=await admin.from("profiles").select("id,login_id,role,gym_id,full_name").eq("id",memberId).eq("gym_id",ap.gym_id).single();
 if(me||!member) return json({error:"Member not found"},404);
 if(member.role!=="member") return json({error:"Only member accounts can be deleted"},400);
 if(member.id===actor.id) return json({error:"You cannot delete your own admin account"},400);
 const {error:ae2}=await admin.from("audit_logs").delete().eq("actor_id",member.id);
 if(ae2) return json({error:ae2.message},400);
 const {error:pe}=await admin.from("profiles").delete().eq("id",member.id).eq("gym_id",ap.gym_id);
 if(pe) return json({error:pe.message},400);
 const {error:ue}=await admin.auth.admin.deleteUser(member.id);
 if(ue) return json({error:"Profile deleted, but Auth account cleanup failed: "+ue.message},500);
 await admin.from("audit_logs").insert({gym_id:ap.gym_id,actor_id:actor.id,action:"delete_member",entity:"member",entity_id:null,details:{login_id:member.login_id,full_name:member.full_name}});
 return json({deleted:true,login_id:member.login_id});
});