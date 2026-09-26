import { supabase } from "./lib/supabase.js";

/* Owner Portal architecture + health telemetry. */
const STYLE = `
.admin-app .nav-item[data-owner-audit-hidden="true"]{display:none!important}
.gm-owner-health-badge{display:inline-flex;align-items:center;gap:6px;margin:8px 0;padding:6px 9px;border-radius:999px;font:700 10px/1.2 Inter,system-ui,sans-serif;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
`;
const HIDDEN_OWNER_ITEMS = new Set(["reports","activity"]);
let lastProbe = 0;
function installStyle(){if(document.getElementById("gm-owner-audit-style"))return;const s=document.createElement("style");s.id="gm-owner-audit-style";s.textContent=STYLE;document.head.appendChild(s)}
function isOwnerPortal(){return !!document.querySelector(".admin-app")&&!document.querySelector(".super-admin-platform")}
function label(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ")}
function simplifyNavigation(){if(!isOwnerPortal())return;document.querySelectorAll(".admin-app .nav-item").forEach(item=>{if(HIDDEN_OWNER_ITEMS.has(label(item.textContent))){item.setAttribute("data-owner-audit-hidden","true");item.setAttribute("aria-hidden","true")}})}
function code(){return `GM-HEALTH-${Date.now().toString(36).slice(-6).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`}
async function report(c,operation,message,detail=""){try{await supabase.rpc("record_platform_error",{p_source:"gym_owner_health",p_operation:operation,p_message:String(message||"Owner portal health check failed"),p_error_code:c,p_detail:String(detail||"").slice(0,1800),p_path:window.location.pathname,p_remediation:"Run the owner authenticated data-boundary smoke test and inspect the failing query/RLS policy."})}catch{}}
async function probeOwnerDataBoundary(){if(!isOwnerPortal()||!supabase)return;const now=Date.now();if(now-lastProbe<30000)return;lastProbe=now;try{const {data:{user},error:userError}=await supabase.auth.getUser();if(userError)throw userError;if(!user)return;const {data:profile,error:profileError}=await supabase.from("profiles").select("id,role,gym_id").eq("id",user.id).maybeSingle();if(profileError)throw profileError;if(!profile?.gym_id)return;const probes=[["owner_gym_read",()=>supabase.from("gyms").select("id,name,platform_status").eq("id",profile.gym_id).maybeSingle()],["owner_members_read",()=>supabase.from("profiles").select("id").eq("gym_id",profile.gym_id).eq("role","member").limit(1)],["owner_trainer_read",()=>supabase.from("profiles").select("id").eq("gym_id",profile.gym_id).eq("role","trainer").limit(1)]];for(const [operation,run] of probes){const result=await run();if(result?.error){const c=code();await report(c,operation,result.error.message,result.error.details||result.error.hint||"");return}}}catch(error){const c=code();await report(c,"owner_data_boundary",error?.message||"Owner portal health probe failed",error?.stack||"")}}
function start(){installStyle();const observer=new MutationObserver(()=>{simplifyNavigation();probeOwnerDataBoundary()});observer.observe(document.body,{childList:true,subtree:true});simplifyNavigation();setTimeout(probeOwnerDataBoundary,1200)}
start();
