import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const esc=(v:string)=>String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]!));
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers:CORS});
  const auth=req.headers.get("Authorization");if(!auth)return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token=auth.replace("Bearer ","");const {data:{user:actor},error:ae}=await admin.auth.getUser(token);
  if(ae||!actor)return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:ap}=await admin.from("profiles").select("gym_id,role").eq("id",actor.id).single();
  if(!ap||ap.role!=="admin")return Response.json({error:"Admin access required"},{status:403,headers:CORS});
  const b=await req.json();const email=String(b.email||"").trim().toLowerCase();
  if(!email)return Response.json({sent:false,configured:false,reason:"No email address supplied"},{headers:{...CORS,"Content-Type":"application/json"}});
  const key=Deno.env.get("RESEND_API_KEY");if(!key)return Response.json({sent:false,configured:false,reason:"RESEND_API_KEY is not configured"},{headers:{...CORS,"Content-Type":"application/json"}});
  const from=Deno.env.get("GYMOS_FROM_EMAIL")||"GYMOS <onboarding@resend.dev>";
  const html='<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#111827"><h1 style="margin-bottom:4px">'+esc(b.gym_name||"Gym")+'</h1><p>Welcome to the gym. Your membership has been registered successfully.</p><h2>Membership</h2><p><b>Member:</b> '+esc(b.member_name)+'<br><b>Member ID:</b> '+esc(b.member_id)+'<br><b>Duration:</b> '+esc(String(b.duration_months))+' month(s)<br><b>Start:</b> '+esc(b.start_date)+'<br><b>Expiry:</b> '+esc(b.expiry_date)+'<br><b>Amount:</b> ₹'+esc(b.amount)+'<br><b>Payment:</b> '+esc(b.payment_method)+'<br><b>Receipt:</b> '+esc(b.receipt_no)+'</p><h2>Login details</h2><p><b>Login ID:</b> '+esc(b.member_id)+'<br><b>Temporary password:</b> '+esc(b.password)+'</p><p>Please change your password after your first login and do not share your login details.</p><p>Your membership receipt is attached as a PDF.</p><p>— GYMOS</p></div>';
  const body:any={from,to:[email],subject:"Welcome to "+String(b.gym_name||"GYMOS")+" — Membership & Login Details",html};
  if(b.pdf_base64)body.attachments=[{filename:"GYMOS-"+String(b.member_id||"member")+"-membership.pdf",content:b.pdf_base64}];
  const rr=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!rr.ok){const detail=await rr.text();return Response.json({sent:false,configured:true,error:detail},{status:502,headers:CORS})}
  const result=await rr.json();await admin.from("audit_logs").insert({gym_id:ap.gym_id,actor_id:actor.id,action:"send_welcome_email",entity:"member",details:{email,member_id:b.member_id,receipt_no:b.receipt_no}});
  return Response.json({sent:true,configured:true,id:result?.id||null},{headers:{...CORS,"Content-Type":"application/json"}});
});