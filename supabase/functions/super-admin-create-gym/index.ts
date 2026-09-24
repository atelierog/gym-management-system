import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.7";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const APP_URL="https://gym-management-system.atelierog-co.workers.dev/";
const esc=(v:string)=>String(v??"").replace(/[&<>"]/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]||m));

async function sendOwnerWelcomeEmail(args:{gymId:string,gymName:string,ownerName:string,ownerEmail:string,ownerPhone:string,loginId:string,password:string}) {
  const dbUrl=Deno.env.get("SUPABASE_DB_URL");
  if(!dbUrl) return {sent:false,reason:"Email service is not configured."};
  const sql=postgres(dbUrl,{max:1,prepare:false});
  try{
    const rows=await sql`select decrypted_secret from vault.decrypted_secrets where name='gymos_resend_api_key' limit 1`;
    const key=String(rows[0]?.decrypted_secret||"");
    if(!key) return {sent:false,reason:"Email service is not configured."};
    const from=Deno.env.get("GYMOS_FROM_EMAIL")||"Atelier OG GymOS <noreply@atelierog.co.in>";
    const subject=`Welcome to GymOS — ${args.gymName}`;
    const text=[
      `Welcome to GymOS, ${args.ownerName}.`,
      "",
      "Your gym owner account has been created by Atelier OG.",
      "",
      `Gym: ${args.gymName}`,
      `Owner: ${args.ownerName}`,
      `Email: ${args.ownerEmail}`,
      `Phone: ${args.ownerPhone||"Not provided"}`,
      "",
      "LOGIN DETAILS",
      `Login ID: ${args.loginId}`,
      `Temporary password: ${args.password}`,
      `GymOS app: ${APP_URL}`,
      "",
      "Please change the temporary password after your first login.",
      "Keep these credentials private.",
      "",
      "Atelier OG GymOS"
    ].join("\n");
    const html=`<div style="margin:0;background:#f3f4f6;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;color:#111827">
      <div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden">
        <div style="background:#0e1626;color:#fff;padding:30px 34px">
          <div style="font-size:26px;font-weight:800;letter-spacing:1px">GYMOS</div>
          <div style="margin-top:7px;font-size:12px;letter-spacing:2px;color:#cbd5e1">BY ATELIER OG</div>
        </div>
        <div style="height:4px;background:#c99528"></div>
        <div style="padding:32px 34px">
          <p style="font-size:20px;font-weight:700;margin:0 0 8px">Welcome, ${esc(args.ownerName)}!</p>
          <p style="color:#6b7280;line-height:1.6;margin:0 0 24px">Your GymOS gym-owner account has been created successfully by Atelier OG.</p>
          <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:20px;margin-bottom:18px">
            <div style="font-size:11px;letter-spacing:1.5px;color:#6b7280;font-weight:700;margin-bottom:14px">GYM DETAILS</div>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:7px 0;color:#6b7280">Gym name</td><td style="padding:7px 0;text-align:right;font-weight:700">${esc(args.gymName)}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280">Owner</td><td style="padding:7px 0;text-align:right;font-weight:700">${esc(args.ownerName)}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280">Owner email</td><td style="padding:7px 0;text-align:right;font-weight:700">${esc(args.ownerEmail)}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280">Owner phone</td><td style="padding:7px 0;text-align:right;font-weight:700">${esc(args.ownerPhone||"Not provided")}</td></tr>
            </table>
          </div>
          <div style="background:#0e1626;color:#fff;border-radius:14px;padding:22px;margin-bottom:20px">
            <div style="font-size:11px;letter-spacing:1.5px;color:#cbd5e1;font-weight:700;margin-bottom:14px">GYMOS LOGIN</div>
            <p style="margin:7px 0"><span style="color:#cbd5e1">Login ID</span><br><strong style="font-size:17px">${esc(args.loginId)}</strong></p>
            <p style="margin:16px 0 0"><span style="color:#cbd5e1">Temporary password</span><br><strong style="font-size:17px">${esc(args.password)}</strong></p>
          </div>
          <div style="text-align:center">
            <a href="${APP_URL}" style="display:inline-block;background:#0e1626;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:700">Open GymOS</a>
            <div style="margin-top:10px;font-size:11px;color:#6b7280;word-break:break-all">${APP_URL}</div>
          </div>
          <div style="margin-top:24px;padding:16px;border-radius:12px;background:#fffaf0;border:1px solid #ead7a3;color:#6b5a2a;font-size:12px;line-height:1.6">
            Please change the temporary password after your first login. Keep your login details private.
          </div>
        </div>
        <div style="padding:18px 34px;background:#f8fafc;color:#9ca3af;font-size:11px">Atelier OG GymOS • Gym Management System</div>
      </div>
    </div>`;
    const rr=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[args.ownerEmail],subject,text,html,idempotencyKey:"gymos-gym-owner-welcome-"+args.gymId})});
    if(!rr.ok){let detail="Welcome email could not be sent.";try{const body=await rr.json();if(body?.message)detail=body.message;}catch{}return {sent:false,reason:"Resend: "+detail};}
    const result=await rr.json();
    return {sent:true,id:result?.id||null};
  }catch(e){
    console.error("gym owner welcome email failed",e);
    return {sent:false,reason:"Welcome email could not be sent."};
  }finally{
    await sql.end({timeout:2}).catch(()=>{});
  }
}

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
  const name=String(body.name||"").trim();
  const ownerName=String(body.owner_name||"").trim();
  const ownerPhone=String(body.owner_phone||"").trim();
  const ownerEmail=String(body.owner_email||"").trim().toLowerCase();
  const requestedLogin=String(body.login_id||"").trim();
  const password=String(body.password||"");

  const passwordRequirements=[];
  if(password.length<8) passwordRequirements.push("at least 8 characters");
  if(!/[A-Z]/.test(password)) passwordRequirements.push("1 uppercase letter");
  if(!/[a-z]/.test(password)) passwordRequirements.push("1 lowercase letter");
  if(!/[0-9]/.test(password)) passwordRequirements.push("1 number");
  if(!/[^A-Za-z0-9]/.test(password)) passwordRequirements.push("1 special character");
  if(!name||!ownerName||!ownerEmail) return Response.json({error:"Gym name, owner name and owner email are required."},{status:400,headers:CORS});
  if(passwordRequirements.length) return Response.json({error:"Password must contain "+passwordRequirements.join(", ")+"."},{status:400,headers:CORS});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return Response.json({error:"Enter a valid owner email address."},{status:400,headers:CORS});

  const base=(requestedLogin||name).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8)||"GYM";
  let loginId=requestedLogin.toUpperCase().replace(/\s+/g,"").replace(/[^A-Z0-9_-]/g,"");
  if(!loginId) { for(let i=1;i<=999;i++){ const candidate=base+String(i).padStart(2,"0"); const {data:used}=await admin.from("profiles").select("id").eq("login_id",candidate).limit(1); if(!used?.length){loginId=candidate;break;} } }
  if(!loginId) return Response.json({error:"Could not generate a unique GymOS login ID."},{status:409,headers:CORS});
  const {data:existing}=await admin.from("profiles").select("id").eq("login_id",loginId).limit(1);
  if(existing?.length) return Response.json({error:"That login ID is already in use."},{status:409,headers:CORS});

  const {data:gym,error:ge}=await admin.from("gyms").insert({name}).select().single();
  if(ge) return Response.json({error:ge.message},{status:400,headers:CORS});

  const authEmail=loginId.toLowerCase()+"@gymos.local";
  const {data:newUser,error:ue}=await admin.auth.admin.createUser({email:authEmail,password,email_confirm:true});
  if(ue){await admin.from("gyms").delete().eq("id",gym.id);return Response.json({error:ue.message},{status:400,headers:CORS});}

  const {data:profile,error:pe}=await admin.from("profiles").insert({id:newUser.user.id,gym_id:gym.id,login_id:loginId,full_name:ownerName,role:"admin",status:"active",phone:ownerPhone||null,email:ownerEmail,password_change_required:true,password_reset_at:new Date().toISOString()}).select().single();
  if(pe){await admin.auth.admin.deleteUser(newUser.user.id);await admin.from("gyms").delete().eq("id",gym.id);return Response.json({error:pe.message},{status:400,headers:CORS});}

  const emailResult=await sendOwnerWelcomeEmail({gymId:gym.id,gymName:name,ownerName,ownerEmail,ownerPhone,loginId,password});
  const emailStatus=emailResult.sent?"Welcome email sent to the gym owner.":emailResult.reason||"Welcome email could not be sent.";

  return Response.json({gym,owner:profile,temporary_password:password,password_change_required:true,email_sent:emailResult.sent,email_status:emailStatus},{headers:{...CORS,"Content-Type":"application/json"}});
});