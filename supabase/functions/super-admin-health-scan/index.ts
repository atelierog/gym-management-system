import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return Response.json({error:"Method not allowed"},{status:405,headers:CORS});
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth=req.headers.get("Authorization"); if(!auth) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:{user:actor},error:ae}=await admin.auth.getUser(auth.replace("Bearer ",""));
  if(ae||!actor) return Response.json({error:"Unauthorized"},{status:401,headers:CORS});
  const {data:pa}=await admin.from("platform_admins").select("status").eq("id",actor.id).single();
  if(!pa||pa.status!=="active") return Response.json({error:"Super Admin access required"},{status:403,headers:CORS});

  const queries=[
    ["Gyms",admin.from("gyms").select("id,name,auto_checkout_enabled,auto_checkout_minutes,timezone,latitude,longitude,allowed_radius_m,platform_status").order("created_at",{ascending:false})],
    ["Profiles",admin.from("profiles").select("id,gym_id,full_name,login_id,role,status,email,phone,created_at")],
    ["Memberships",admin.from("memberships").select("id,gym_id,member_id,start_date,expiry_date,status,payment_status,amount,amount_paid,amount_due,due_date,created_at")],
    ["Attendance",admin.from("attendance").select("id,gym_id,user_id,check_in,check_out,checkout_type,status")],
    ["Payments",admin.from("payments").select("id,gym_id,member_id,membership_id,receipt_no,amount,method,paid_at")],
    ["Audit logs",admin.from("audit_logs").select("id,gym_id,action,entity,entity_id,details,created_at").order("created_at",{ascending:false}).limit(300)],
    ["Platform errors",admin.from("platform_error_events").select("id,gym_id,actor_id,actor_role,source,operation,error_code,message,detail,status,remediation,created_at,resolved_at").order("created_at",{ascending:false}).limit(200)]
  ];
  const settled=await Promise.all(queries.map(async([name,q])=>({name,result:await q})));
  const readErrors=settled.filter(x=>x.result.error).map(x=>({name:x.name,error:x.result.error}));
  const get=(name)=>settled.find(x=>x.name===name)?.result?.data||[];
  const gyms=get("Gyms"),profiles=get("Profiles"),memberships=get("Memberships"),attendance=get("Attendance"),payments=get("Payments"),auditLogs=get("Audit logs"),platformErrors=get("Platform errors");
  const gymById=new Map(gyms.map(g=>[g.id,g])), profileById=new Map(profiles.map(p=>[p.id,p]));
  const issues=[]; const add=(gym,severity,type,message,detail)=>issues.push({id:crypto.randomUUID(),gym_id:gym?.id||null,gym_name:gym?.name||"Platform",severity,type,message,detail:detail||null});
  for(const r of readErrors)add(null,"critical","SYSTEM_READ_ERROR","Super Admin could not read the "+r.name+" area.","Database/API reason: "+r.error.message);

  for(const g of gyms||[]){
    const owners=(profiles||[]).filter(p=>p.gym_id===g.id&&p.role==="admin");
    if(!owners.length) add(g,"critical","OWNER_MISSING","Gym has no Gym Owner account.","A tenant without an owner cannot be administered normally.");
    if(!Number.isFinite(Number(g.allowed_radius_m))||Number(g.allowed_radius_m)<=0) add(g,"error","CHECKIN_CONFIG","Check-in radius is invalid.","Allowed radius must be greater than 0 metres.");
    if(g.auto_checkout_enabled&&(!Number.isFinite(Number(g.auto_checkout_minutes))||Number(g.auto_checkout_minutes)<=0)) add(g,"error","AUTO_CHECKOUT_CONFIG","Auto-checkout is enabled with an invalid duration.","Set a positive auto-checkout duration.");
    if(g.platform_status==="suspended") add(g,"info","GYM_SUSPENDED","Gym is suspended.","Platform access is currently blocked.");
    for(const o of owners) if(o.status!=="active") add(g,"warning","OWNER_ACCESS","Gym Owner access is suspended.","Owner account: "+o.full_name+" ("+o.login_id+").");
  }

  const today=new Date().toISOString().slice(0,10);
  for(const m of memberships||[]){
    const g=gymById.get(m.gym_id), person=profileById.get(m.member_id);
    if(m.expiry_date<m.start_date) add(g,"critical","MEMBERSHIP_DATES","Membership has an invalid date range.","Member: "+(person?.full_name||m.member_id)+".");
    if(m.status==="active"&&m.expiry_date<today) add(g,"error","EXPIRED_ACTIVE_MEMBERSHIP","Membership is marked active after its expiry date.","Member: "+(person?.full_name||m.member_id)+"; expiry: "+m.expiry_date+".");
    if(Number(m.amount_due||0)<0||Number(m.amount_paid||0)<0||Number(m.amount_paid||0)>Number(m.amount||0)+0.01) add(g,"error","PAYMENT_TOTAL_MISMATCH","Membership payment totals are inconsistent.","Member: "+(person?.full_name||m.member_id)+".");
    if(Number(m.amount_due||0)>0&&m.payment_status==="paid") add(g,"warning","PAYMENT_STATUS_MISMATCH","Membership is marked paid but still has an outstanding balance.","Member: "+(person?.full_name||m.member_id)+"; due: ₹"+Number(m.amount_due).toLocaleString("en-IN")+".");
  }

  for(const a of attendance||[]){
    const g=gymById.get(a.gym_id), person=profileById.get(a.user_id);
    if(a.check_out&&new Date(a.check_out)<new Date(a.check_in)) add(g,"critical","ATTENDANCE_TIME","Attendance has a checkout time before check-in.","Person: "+(person?.full_name||a.user_id)+".");
    if(!a.check_out&&g?.auto_checkout_enabled){
      const age=(Date.now()-new Date(a.check_in).getTime())/60000, limit=Number(g.auto_checkout_minutes||180);
      if(age>limit+15) add(g,"warning","OPEN_ATTENDANCE","An attendance record is still open beyond the auto-checkout limit.","Person: "+(person?.full_name||a.user_id)+"; open for about "+Math.round(age)+" minutes.");
    }
  }

  const recentFailures=(auditLogs||[]).filter(a=>/(fail|error|exception|unable|could not)/i.test(a.action+" "+JSON.stringify(a.details||{}))).slice(0,50);
  for(const a of recentFailures){
    const g=gymById.get(a.gym_id);
    add(g,"error","RECENT_OPERATION_FAILURE","A recent operation failure was recorded.","Action: "+a.action+" · "+new Date(a.created_at).toLocaleString("en-IN"));
  }

  for(const e of (platformErrors||[]).filter(x=>x.status==="open"||x.status==="investigating").slice(0,100)){
    const g=gymById.get(e.gym_id);
    const severity=e.error_code==="AUTHENTICATION"?"warning":"error";
    add(g,severity,"PLATFORM_OPERATION_ERROR",e.message,
      (e.source||"App")+" · "+(e.operation||"operation")+
      (e.actor_role?" · role: "+e.actor_role:"")+
      (e.error_code?" · code: "+e.error_code:"")+
      " · "+new Date(e.created_at).toLocaleString("en-IN")+
      (e.detail?" · "+e.detail:""));
  }

  const summary={critical:issues.filter(i=>i.severity==="critical").length,error:issues.filter(i=>i.severity==="error").length,warning:issues.filter(i=>i.severity==="warning").length,info:issues.filter(i=>i.severity==="info").length};
  return Response.json({scanned_at:new Date().toISOString(),summary,issues:issues.slice(0,150)},{headers:{...CORS,"Content-Type":"application/json"}});
});
