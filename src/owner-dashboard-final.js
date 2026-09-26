import { supabase } from "./lib/supabase.js";

/* Gym Manager — Owner Dashboard (single presentation layer).
 * The React app remains the source of truth for navigation/actions.
 * This layer renders the Owner dashboard outside React's <main> so React
 * cannot re-mount the legacy dashboard over it.
 */

const STYLE = `
.gm-owner-dashboard-portal{display:block;padding:20px 14px 34px;max-width:760px;margin:0 auto;background:#f5f7fa;min-height:calc(100dvh - 72px)}
.gm-owner-dashboard-portal[hidden]{display:none!important}
.gm-owner-greeting{margin:0 0 14px;font-size:27px;line-height:1.15;font-weight:800;letter-spacing:-.6px;color:#182230}
.gm-owner-register{width:100%;min-height:52px;border:0;border-radius:14px;background:#182230;color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 8px 22px rgba(16,24,40,.12)}
.gm-owner-register:disabled{opacity:.5;cursor:not-allowed}
.gm-owner-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:4px 0 24px}
.gm-owner-stat{min-height:108px;border:1px solid #e4e7ec;border-radius:16px;background:#fff;padding:15px;display:flex;flex-direction:column;justify-content:center}
.gm-owner-stat small{font-size:10px;color:#667085;font-weight:800;text-transform:uppercase;letter-spacing:.45px}
.gm-owner-stat strong{margin-top:7px;font-size:26px;line-height:1;color:#101828}
.gm-owner-stat span{margin-top:6px;font-size:11px;color:#98a2b3}
.gm-owner-section-title{margin:20px 2px 10px;font-size:12px;font-weight:850;letter-spacing:.8px;color:#667085;text-transform:uppercase}
.gm-owner-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.gm-owner-action{min-height:104px;border:1px solid #e4e7ec;border-radius:14px;background:#fff;color:#182230;font-weight:750;text-align:left;padding:14px;cursor:pointer}
.gm-owner-action b{display:block;margin-top:9px;font-size:15px}
.gm-owner-action small{display:block;margin-top:5px;color:#667085;font-size:11px;line-height:1.35;font-weight:500}
.gm-owner-action:disabled{opacity:.5;cursor:not-allowed}
.gm-owner-attention{border:1px solid #e4e7ec;border-radius:16px;background:#fff;overflow:hidden}
.gm-owner-attention-item{width:100%;border:0;border-bottom:1px solid #eaecf0;background:#fff;padding:15px;display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;color:#182230}
.gm-owner-attention-item:last-child{border-bottom:0}
.gm-owner-attention-item b{display:block;font-size:13px}.gm-owner-attention-item small{display:block;margin-top:3px;color:#667085;font-size:11px}
.gm-owner-attention-item i{margin-left:auto;font-size:24px;color:#98a2b3;font-style:normal}
.gm-owner-attention-clear{padding:18px;color:#475467;font-size:13px}
.gm-owner-summary{display:grid;gap:10px;margin-top:10px}
.gm-owner-summary-card{border:1px solid #e4e7ec;border-radius:16px;background:#fff;padding:16px;text-align:left;cursor:pointer}
.gm-owner-summary-card small{display:block;color:#667085;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px}
.gm-owner-summary-card strong{display:block;margin-top:6px;font-size:25px;color:#101828}.gm-owner-summary-card span{display:block;margin-top:5px;color:#98a2b3;font-size:11px}
.gm-owner-support{margin-top:24px;padding:16px 2px 0;border-top:1px solid #dfe3e8;text-align:center;color:#667085;font-size:12px}
.gm-owner-support a{display:inline-block;margin-top:6px;color:#182230;font-weight:800;text-decoration:none}
.gm-owner-error{padding:13px 14px;margin-bottom:14px;border:1px solid #f0c6cf;border-radius:13px;background:#fff4f5;color:#8f1639;font-size:12px;font-weight:700}
@media(max-width:520px){.gm-owner-dashboard-portal{padding-left:12px;padding-right:12px}.gm-owner-greeting{font-size:25px}}
@media(max-width:360px){.gm-owner-stats{grid-template-columns:1fr}.gm-owner-actions{grid-template-columns:1fr}}
`;

let mounted=false;
let timer=null;
let observer=null;

const text=el=>String(el?.textContent||"").replace(/\s+/g," ").trim();

function installStyle(){
  if(document.getElementById("gm-owner-dashboard-style"))return;
  const style=document.createElement("style");
  style.id="gm-owner-dashboard-style";
  style.textContent=STYLE;
  document.head.appendChild(style);
}

function greeting(){
  const hour=Number(new Intl.DateTimeFormat("en-IN",{hour:"2-digit",hour12:false,timeZone:"Asia/Kolkata"}).format(new Date()));
  if(hour<12)return "Good morning";
  if(hour<17)return "Good afternoon";
  return "Good evening";
}

async function ownerContext(){
  if(!supabase)throw new Error("Gym Manager service is not configured");
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user)throw new Error("Owner session is not available");
  const {data:profile,error:profileError}=await supabase.from("profiles").select("id,gym_id,full_name,display_name,name,role,status").eq("id",user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile?.gym_id)throw new Error("Owner gym is not configured");
  if(profile.role!=="admin")throw new Error("Owner access could not be verified");
  return {profile,gymId:profile.gym_id};
}

async function loadMetrics(gymId){
  const now=new Date();
  const start=new Date(now);start.setHours(0,0,0,0);
  const end=new Date(start);end.setDate(end.getDate()+1);
  const [people,memberships,attendance,payments,gym]=await Promise.all([
    supabase.from("profiles").select("role,status").eq("gym_id",gymId).in("role",["member","trainer"]),
    supabase.from("memberships").select("amount_due,status,expiry_date").eq("gym_id",gymId),
    supabase.from("attendance").select("id").eq("gym_id",gymId).gte("check_in",start.toISOString()).lt("check_in",end.toISOString()),
    supabase.from("payments").select("amount,paid_at").eq("gym_id",gymId).gte("paid_at",start.toISOString()).lt("paid_at",end.toISOString()),
    supabase.from("gyms").select("latitude,longitude,name").eq("id",gymId).maybeSingle()
  ]);
  const errors=[people,memberships,attendance,payments,gym].map(x=>x.error).filter(Boolean);
  if(errors.length)throw errors[0];
  const rows=people.data||[];
  const members=rows.filter(x=>x.role==="member"&&String(x.status||"active").toLowerCase()!=="suspended").length;
  const trainers=rows.filter(x=>x.role==="trainer"&&String(x.status||"active").toLowerCase()!=="suspended").length;
  const attendanceToday=(attendance.data||[]).length;
  const feesToday=(payments.data||[]).reduce((sum,row)=>sum+Number(row.amount||0),0);
  const outstanding=(memberships.data||[]).reduce((sum,row)=>sum+Number(row.amount_due||0),0);
  const expiring=(memberships.data||[]).filter(row=>{
    if(String(row.status||"").toLowerCase()==="expired"||!row.expiry_date)return false;
    const expiry=new Date(`${row.expiry_date}T00:00:00`);const today=new Date(start);const seven=new Date(start);seven.setDate(seven.getDate()+7);
    return expiry>=today&&expiry<=seven;
  }).length;
  return {members,trainers,attendanceToday,feesToday,outstanding,expiring,gym:gym.data||null};
}

function activeOwnerPortal(){return document.querySelector(".admin-app")}
function isDashboard(){
  const app=activeOwnerPortal();
  if(!app)return false;
  const item=[...app.querySelectorAll(".mobile-drawer .nav-item,.sidebar .nav-item,.nav-item")].find(el=>/dashboard/i.test(text(el)));
  return !!item&&(item.classList.contains("active")||item.getAttribute("aria-current")==="page");
}

function findButton(labels){
  const app=activeOwnerPortal();if(!app)return null;
  const wanted=labels.map(x=>x.toLowerCase());
  return [...app.querySelectorAll("button,a,[role=button]")].find(el=>wanted.includes(text(el).toLowerCase()))||null;
}

function navigate(label){const button=findButton([label]);if(button)button.click()}

function legacyDashboardElements(app){return app.querySelectorAll(".admin-main > .admin-page-header,.admin-main > .owner-dashboard-hero,.admin-main > .owner-kpis,.admin-main > .owner-section,.admin-main > .owner-summary-links")}
function suppressLegacyDashboard(){const app=activeOwnerPortal();if(!app)return;legacyDashboardElements(app).forEach(el=>{el.dataset.gmLegacyDashboard="true";el.style.display="none"});[...app.querySelectorAll(".mobile-drawer .nav-item")].forEach(el=>{const label=text(el);if(/^reports$/i.test(label)||/^activity log$/i.test(label))el.style.display="none"})}
function restoreLegacyDashboard(){const app=activeOwnerPortal();if(!app)return;app.querySelectorAll('[data-gm-legacy-dashboard="true"]').forEach(el=>{el.style.display="";delete el.dataset.gmLegacyDashboard})}

function errorBox(wrap,error){
  const box=document.createElement("div");box.className="gm-owner-error";box.textContent="We couldn't load the dashboard data. Please try again or contact Atelier OG Support.";wrap.appendChild(box);
  try{if(supabase)void supabase.rpc("record_platform_error",{p_source:"gym_owner",p_operation:"dashboard_load",p_message:String(error?.message||error),p_error_code:"GM-OWNER-DASHBOARD",p_detail:String(error?.stack||"").slice(0,1800),p_path:window.location.pathname})}catch{}
}

function action(label,handler){
  const b=document.createElement("button");b.type="button";b.className="gm-owner-action";b.innerHTML=`<span>${label==="Register member"?"＋":label==="Attendance"?"✓":label==="Members"?"◉":"◎"}</span><b>${label}</b><small>${label==="Register member"?"Create account, membership and payment":label==="Attendance"?"Check today's visits":label==="Members"?"Search and manage members":"Manage trainer accounts"}</small>`;
  if(handler)b.addEventListener("click",handler);else b.disabled=true;return b;
}

async function mount(){
  if(mounted)return;
  const app=activeOwnerPortal();if(!app)return;
  mounted=true;installStyle();
  const main=app.querySelector(".admin-main");if(!main)return;
  const portal=document.createElement("section");portal.className="gm-owner-dashboard-portal";portal.setAttribute("aria-label","Owner dashboard");main.after(portal);

  const register=findButton(["Register member","+ Register member"]),attendance=findButton(["Attendance"]),members=findButton(["Members"]),trainers=findButton(["Trainers"]);
  suppressLegacyDashboard();
  const hero=document.createElement("section");
  const h1=document.createElement("h1");h1.className="gm-owner-greeting";
  const registerNew=document.createElement("button");registerNew.type="button";registerNew.className="gm-owner-register";registerNew.textContent="+ Register member";
  if(register)registerNew.addEventListener("click",()=>register.click());else registerNew.disabled=true;
  hero.append(h1,registerNew);portal.appendChild(hero);
  const updateGreeting=()=>{if(isDashboard())h1.textContent=`${greeting()}, ${document.querySelector(".drawer-head .mobile-brand small")?.textContent?.trim()||"there"}`};updateGreeting();timer=setInterval(updateGreeting,60000);

  try{
    const ctx=await ownerContext();const metrics=await loadMetrics(ctx.gymId);
    const stats=document.createElement("section");stats.className="gm-owner-stats";
    [["Members",metrics.members,"View members"],["Attendance",metrics.attendanceToday,"Checked in today"],["Fees today","₹"+metrics.feesToday.toLocaleString("en-IN",{maximumFractionDigits:0}),"Collected today"]].forEach(([label,value,sub])=>{const card=document.createElement("article");card.className="gm-owner-stat";card.innerHTML=`<small>${label}</small><strong>${value}</strong><span>${sub}</span>`;stats.appendChild(card)});portal.appendChild(stats);
    const title=document.createElement("div");title.className="gm-owner-section-title";title.textContent="Quick actions";portal.appendChild(title);
    const actions=document.createElement("section");actions.className="gm-owner-actions";actions.append(action("Register member",register?()=>register.click():null),action("Attendance",attendance?()=>attendance.click():null),action("Members",members?()=>members.click():null),action("Trainers",trainers?()=>trainers.click():null));portal.appendChild(actions);
    const attentionTitle=document.createElement("div");attentionTitle.className="gm-owner-section-title";attentionTitle.textContent="Needs attention";portal.appendChild(attentionTitle);
    const attention=document.createElement("section");attention.className="gm-owner-attention";
    if(!metrics.gym?.latitude||!metrics.gym?.longitude){const b=document.createElement("button");b.className="gm-owner-attention-item";b.innerHTML='<span>!</span><div><b>Complete gym location</b><small>Location is required for member check-in.</small></div><i>›</i>';b.onclick=()=>navigate("Settings");attention.appendChild(b)}
    if(metrics.outstanding>0){const b=document.createElement("button");b.className="gm-owner-attention-item";b.innerHTML=`<span>₹</span><div><b>₹${metrics.outstanding.toLocaleString("en-IN",{maximumFractionDigits:0})} payment dues</b><small>Open dues and settle outstanding payments.</small></div><i>›</i>`;b.onclick=()=>navigate("Dues");attention.appendChild(b)}
    if(metrics.expiring>0){const b=document.createElement("button");b.className="gm-owner-attention-item";b.innerHTML=`<span>!</span><div><b>${metrics.expiring} membership${metrics.expiring===1?"":"s"} expiring soon</b><small>Review upcoming renewals.</small></div><i>›</i>`;b.onclick=()=>navigate("Memberships");attention.appendChild(b)}
    if(!attention.children.length)attention.innerHTML='<div class="gm-owner-attention-clear">You\'re all caught up. No immediate action is required.</div>';portal.appendChild(attention);
    const summary=document.createElement("section");summary.className="gm-owner-summary";
    [["Active memberships","Memberships",metrics.members],["Outstanding","Dues","₹"+metrics.outstanding.toLocaleString("en-IN",{maximumFractionDigits:0})],["Trainers","Trainers",metrics.trainers]].forEach(([label,target,value])=>{const b=document.createElement("button");b.className="gm-owner-summary-card";b.innerHTML=`<small>${label}</small><strong>${value}</strong><span>Open ${target.toLowerCase()}</span>`;b.onclick=()=>navigate(target);summary.appendChild(b)});portal.appendChild(summary);
  }catch(error){errorBox(portal,error)}
  const support=document.createElement("div");support.className="gm-owner-support";support.innerHTML='Need help?<br><a href="mailto:atelierog.co@gmail.com?subject=Gym%20Manager%20Support">Contact Atelier OG Support</a><br><span>atelierog.co@gmail.com</span>';portal.appendChild(support);
}

function run(){
  const app=activeOwnerPortal();if(!app)return;
  const dashboard=isDashboard();const portal=document.querySelector(".gm-owner-dashboard-portal");
  if(dashboard){suppressLegacyDashboard();if(!portal)mount();else portal.hidden=false}
  else{restoreLegacyDashboard();if(portal)portal.hidden=true}
}

observer=new MutationObserver(()=>{clearTimeout(run._t);run._t=setTimeout(run,80)});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(run,250);
window.addEventListener("beforeunload",()=>{if(timer)clearInterval(timer);observer?.disconnect()});
