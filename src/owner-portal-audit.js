import { supabase } from "./lib/supabase.js";

/* Owner Portal architecture + non-destructive health telemetry. */
const STYLE = `
.admin-app .nav-item[data-owner-audit-hidden="true"]{display:none!important}
.gm-owner-health-badge{display:inline-flex;align-items:center;gap:6px;margin:8px 0;padding:6px 9px;border-radius:999px;font:700 10px/1.2 Inter,system-ui,sans-serif;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
`;
const HIDDEN_OWNER_ITEMS = new Set(["reports","activity","activity log"]);
let lastProbe = 0;
let probing = false;
function installStyle(){if(document.getElementById("gm-owner-audit-style"))return;const s=document.createElement("style");s.id="gm-owner-audit-style";s.textContent=STYLE;document.head.appendChild(s)}
function isOwnerPortal(){return !!document.querySelector(".admin-app")&&!document.querySelector(".super-admin-platform")}
function label(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ")}
function simplifyNavigation(){if(!isOwnerPortal())return;document.querySelectorAll(".admin-app .nav-item").forEach(item=>{const t=label(item.textContent);if(HIDDEN_OWNER_ITEMS.has(t)||t.includes("activity log")){item.setAttribute("data-owner-audit-hidden","true");item.setAttribute("aria-hidden","true")}})}
function code(){return `GM-HEALTH-${Date.now().toString(36).slice(-6).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`}
async function report(c,operation,message,detail=""){try{await supabase.rpc("record_platform_error",{p_source:"gym_owner_health",p_operation:operation,p_message:String(message||"Owner portal health check failed"),p_error_code:c,p_detail:String(detail||"").slice(0,1800),p_path:window.location.pathname,p_remediation:"Inspect the Owner Portal operation, backend RPC/Edge Function and relevant RLS policy."})}catch{}}
async function probeOwnerDataBoundary(){
  if(!isOwnerPortal()||!supabase||probing)return;
  const now=Date.now();if(now-lastProbe<60000)return;lastProbe=now;probing=true;
  try{
    const {data:{user},error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!user)return;
    const {data:profile,error:profileError}=await supabase.from("profiles").select("id,role,gym_id").eq("id",user.id).maybeSingle();if(profileError)throw profileError;if(!profile?.gym_id)throw new Error("Owner profile has no gym_id");
    const gym=profile.gym_id;
    const probes=[
      ["owner_gym_read",()=>supabase.from("gyms").select("id,name,platform_status").eq("id",gym).maybeSingle()],
      ["owner_members_read",()=>supabase.from("profiles").select("id").eq("gym_id",gym).eq("role","member").limit(1)],
      ["owner_trainers_read",()=>supabase.from("profiles").select("id").eq("gym_id",gym).eq("role","trainer").limit(1)],
      ["owner_membership_plans_read",()=>supabase.from("membership_plans").select("id").eq("gym_id",gym).limit(1)],
      ["owner_memberships_read",()=>supabase.from("memberships").select("id").eq("gym_id",gym).limit(1)],
      ["owner_payments_read",()=>supabase.from("payments").select("id").eq("gym_id",gym).limit(1)],
      ["owner_attendance_read",()=>supabase.from("attendance").select("id").eq("gym_id",gym).limit(1)]
    ];
    for(const [operation,run] of probes){const result=await run();if(result?.error){const c=code();await report(c,operation,result.error.message,result.error.details||result.error.hint||"");return}}
  }catch(error){const c=code();await report(c,"owner_data_boundary",error?.message||"Owner portal health probe failed",error?.stack||"")}finally{probing=false}
}
function dashboardSmoke(){
  if(!isOwnerPortal())return;
  const root=document.querySelector(".admin-app");
  if(!root)return;
  const dashboardCards=root.querySelectorAll(".dashboard-card-button,.stat");
  if(document.body.textContent.includes("Dashboard")&&dashboardCards.length===0){report(code(),"owner_dashboard_render","Dashboard loaded without KPI cards").catch(()=>{})}
}
function start(){installStyle();const observer=new MutationObserver(()=>{simplifyNavigation();dashboardSmoke();probeOwnerDataBoundary()});observer.observe(document.body,{childList:true,subtree:true});simplifyNavigation();setTimeout(()=>{dashboardSmoke();probeOwnerDataBoundary()},1200)}
start();
