import { supabase } from "./lib/supabase.js";

/* Gym Manager — Owner Dashboard
 * Single presentation layer for the owner home screen.
 * React remains responsible for navigation and business actions; this layer
 * replaces only the legacy dashboard view when the Dashboard route is active.
 */

const STYLE = `
.gm-owner-dashboard-portal{display:block!important;padding:18px 12px 34px;max-width:760px;margin:0 auto;background:#f5f7fa;min-height:calc(100dvh - 72px);font-family:inherit}
.gm-owner-dashboard-portal[hidden]{display:none!important}
.gm-owner-greeting{margin:2px 2px 14px;font-size:27px;line-height:1.15;font-weight:800;letter-spacing:-.6px;color:#182230}
.gm-owner-register{width:100%;min-height:52px;border:0;border-radius:14px;background:#182230;color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 8px 22px rgba(16,24,40,.12);margin-bottom:22px}
.gm-owner-register:disabled{opacity:.5;cursor:not-allowed}
.gm-owner-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 24px}
.gm-owner-stat{min-height:108px;border:1px solid #e4e7ec;border-radius:16px;background:#fff;padding:15px;display:flex;flex-direction:column;justify-content:center;text-align:left}
.gm-owner-stat.clickable{cursor:pointer;width:100%;font:inherit}
.gm-owner-stat small{font-size:10px;color:#667085;font-weight:800;text-transform:uppercase;letter-spacing:.45px}
.gm-owner-stat strong{margin-top:7px;font-size:26px;line-height:1;color:#101828}
.gm-owner-stat span{margin-top:6px;font-size:11px;color:#98a2b3}
.gm-owner-section-title{margin:20px 2px 10px;font-size:12px;font-weight:850;letter-spacing:.8px;color:#667085;text-transform:uppercase}
.gm-owner-section-title-row{display:flex;justify-content:space-between;align-items:center;margin:20px 2px 10px}
.gm-owner-section-title-row .gm-owner-section-title{margin:0}
.gm-owner-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.gm-owner-action{min-height:104px;border:1px solid #e4e7ec;border-radius:14px;background:#fff;color:#182230;font-weight:750;text-align:left;padding:14px;cursor:pointer;width:100%;font-family:inherit}
.gm-owner-action .icon{display:flex;width:40px;height:40px;border-radius:12px;background:#eef1f4;align-items:center;justify-content:center;font-size:20px;color:#344054}
.gm-owner-action b{display:block;margin-top:9px;font-size:15px}
.gm-owner-action small{display:block;margin-top:5px;color:#667085;font-size:11px;line-height:1.35;font-weight:500}
.gm-owner-action:disabled{opacity:.5;cursor:not-allowed}
.gm-owner-attention{border:1px solid #e4e7ec;border-radius:16px;background:#fff;overflow:hidden}
.gm-owner-attention-item{width:100%;border:0;border-bottom:1px solid #eaecf0;background:#fff;padding:15px;display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;color:#182230;font-family:inherit}
.gm-owner-attention-item:last-child{border-bottom:0}
.gm-owner-attention-item .attention-icon{width:40px;height:40px;border-radius:12px;background:#f1f3f5;display:flex;align-items:center;justify-content:center;flex:none;font-weight:800}
.gm-owner-attention-item b{display:block;font-size:13px}.gm-owner-attention-item small{display:block;margin-top:3px;color:#667085;font-size:11px}
.gm-owner-attention-item i{margin-left:auto;font-size:24px;color:#98a2b3;font-style:normal}
.gm-owner-attention-clear{padding:18px;color:#475467;font-size:13px}
.gm-owner-summary{display:grid;gap:10px;margin-top:10px}
.gm-owner-summary-card{border:1px solid #e4e7ec;border-radius:16px;background:#fff;padding:16px;text-align:left;cursor:pointer;width:100%;font-family:inherit}
.gm-owner-summary-card small{display:block;color:#667085;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px}
.gm-owner-summary-card strong{display:block;margin-top:6px;font-size:25px;color:#101828}.gm-owner-summary-card span{display:block;margin-top:5px;color:#98a2b3;font-size:11px}
.gm-owner-support{margin-top:24px;padding:16px 2px 0;border-top:1px solid #dfe3e8;text-align:center;color:#667085;font-size:12px}
.gm-owner-support a{display:inline-block;margin-top:6px;color:#182230;font-weight:800;text-decoration:none}
.gm-owner-error{padding:13px 14px;margin-bottom:14px;border:1px solid #f0c6cf;border-radius:13px;background:#fff4f5;color:#8f1639;font-size:12px;font-weight:700}
.gm-owner-error-detail{margin-top:7px;font-size:11px;font-weight:500;color:#a43b58}
.gm-owner-legacy-hidden{display:none!important}
@media(max-width:520px){.gm-owner-dashboard-portal{padding-left:12px;padding-right:12px}.gm-owner-greeting{font-size:25px}}
@media(max-width:360px){.gm-owner-stats{grid-template-columns:1fr}.gm-owner-actions{grid-template-columns:1fr}}
`;

let started=false;
let observer=null;
let refreshTimer=null;

const clean=v=>String(v??"").replace(/\s+/g," ").trim();
const lower=v=>clean(v).toLowerCase();

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

function app(){return document.querySelector(".admin-app");}
function main(){return app()?.querySelector(".admin-main")||null;}

function dashboardActive(){
  const root=app();
  if(!root)return false;
  const items=[...root.querySelectorAll(".nav-item")];
  const dashboard=items.find(el=>lower(el.textContent)==="dashboard"||lower(el.textContent).startsWith("dashboard "));
  if(!dashboard)return false;
  return dashboard.classList.contains("active")||dashboard.getAttribute("aria-current")==="page"||lower(location.hash).includes("dashboard");
}

function findNav(label){
  const root=app();
  if(!root)return null;
  const wanted=lower(label);
  return [...root.querySelectorAll(".nav-item,button,a,[role=button]")].find(el=>lower(el.textContent)===wanted)||null;
}

function clickExisting(label){
  const el=findNav(label);
  if(el){el.click();return true;}
  return false;
}

function findExistingAction(labels){
  const root=app();
  if(!root)return null;
  const wanted=labels.map(lower);
  return [...root.querySelectorAll("button,a,[role=button]")].find(el=>wanted.includes(lower(el.textContent)))||null;
}

function ownerName(){
  const root=app();
  const candidates=[
    root?.querySelector(".drawer-head .mobile-brand small"),
    root?.querySelector(".drawer-head small"),
    root?.querySelector(".mobile-brand small")
  ];
  const name=candidates.map(el=>clean(el?.textContent)).find(v=>v&&lower(v)!=="owner portal");
  return name||"there";
}

function legacyDashboardNodes(root){
  const selectors=[
    ".admin-main > .admin-page-header",
    ".admin-main > .owner-dashboard-hero",
    ".admin-main > .owner-kpis",
    ".admin-main > .owner-section",
    ".admin-main > .owner-summary-links",
    ".admin-main > .dashboard-page",
    ".admin-main > .dashboard-content"
  ];
  return [...root.querySelectorAll(selectors.join(","))];
}

function hideLegacy(root){
  const m=main();
  if(!m)return;
  [...m.children].forEach(el=>{
    if(el.classList.contains("gm-owner-dashboard-portal"))return;
    el.classList.add("gm-owner-legacy-hidden");
    el.setAttribute("aria-hidden","true");
  });
  legacyDashboardNodes(root).forEach(el=>el.classList.add("gm-owner-legacy-hidden"));
}

function restoreLegacy(){
  const m=main();
  if(!m)return;
  [...m.children].forEach(el=>{
    if(el.classList.contains("gm-owner-dashboard-portal"))return;
    el.classList.remove("gm-owner-legacy-hidden");
    el.removeAttribute("aria-hidden");
  });
}

function supportHtml(){
  return `<div class="gm-owner-support">Need help?<br><a href="mailto:atelierog.co@gmail.com?subject=Gym%20Manager%20Support">Contact Atelier OG Support</a><br><span>atelierog.co@gmail.com</span></div>`;
}

function makeAction(label,icon,sub,handler){
  const b=document.createElement("button");
  b.type="button";b.className="gm-owner-action";
  b.innerHTML=`<span class="icon" aria-hidden="true">${icon}</span><b>${label}</b><small>${sub}</small>`;
  if(handler)b.addEventListener("click",handler);else b.disabled=true;
  return b;
}

function errorBox(parent,error){
  const box=document.createElement("div");
  box.className="gm-owner-error";
  box.innerHTML=`We couldn't load the dashboard data. Please try again or contact Atelier OG Support.<div class="gm-owner-error-detail">${clean(error?.message||error)}</div>`;
  parent.appendChild(box);
  try{void supabase.rpc("record_platform_error",{p_source:"gym_owner",p_operation:"dashboard_load",p_message:String(error?.message||error),p_error_code:"GM-OWNER-DASHBOARD",p_detail:String(error?.stack||"").slice(0,1800),p_path:window.location.pathname})}catch{}
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
  const firstError=[people,memberships,attendance,payments,gym].map(x=>x.error).find(Boolean);
  if(firstError)throw firstError;
  const rows=people.data||[];
  const members=rows.filter(x=>x.role==="member"&&lower(x.status||"active")!=="suspended").length;
  const trainers=rows.filter(x=>x.role==="trainer"&&lower(x.status||"active")!=="suspended").length;
  const attendanceToday=(attendance.data||[]).length;
  const feesToday=(payments.data||[]).reduce((sum,row)=>sum+Number(row.amount||0),0);
  const outstanding=(memberships.data||[]).reduce((sum,row)=>sum+Number(row.amount_due||0),0);
  const expiring=(memberships.data||[]).filter(row=>{
    if(lower(row.status)==="expired"||!row.expiry_date)return false;
    const expiry=new Date(`${row.expiry_date}T00:00:00`);const seven=new Date(start);seven.setDate(seven.getDate()+7);
    return expiry>=start&&expiry<=seven;
  }).length;
  return {members,trainers,attendanceToday,feesToday,outstanding,expiring,gym:gym.data||null};
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

async function render(){
  const root=app();
  const m=main();
  if(!root||!m)return;
  const active=dashboardActive();
  const existing=m.querySelector(".gm-owner-dashboard-portal");
  if(!active){
    if(existing)existing.remove();
    restoreLegacy();
    return;
  }
  hideLegacy(root);
  if(existing)return;

  const portal=document.createElement("section");
  portal.className="gm-owner-dashboard-portal";
  portal.setAttribute("aria-label","Owner dashboard");
  m.appendChild(portal);

  const greetingEl=document.createElement("h1");
  greetingEl.className="gm-owner-greeting";
  greetingEl.textContent=`${greeting()}, ${ownerName()}`;
  portal.appendChild(greetingEl);

  const registerSource=findExistingAction(["register member","+ register member"]);
  const register=document.createElement("button");
  register.type="button";register.className="gm-owner-register";register.textContent="+ Register member";
  if(registerSource)register.addEventListener("click",()=>registerSource.click());else register.disabled=true;
  portal.appendChild(register);

  try{
    const ctx=await ownerContext();
    const metrics=await loadMetrics(ctx.gymId);

    const stats=document.createElement("section");stats.className="gm-owner-stats";
    const stat=(label,value,sub,handler)=>{
      const el=handler?document.createElement("button"):document.createElement("article");
      el.className="gm-owner-stat"+(handler?" clickable":"");
      if(handler)el.type="button";
      el.innerHTML=`<small>${label}</small><strong>${value}</strong><span>${sub}</span>`;
      if(handler)el.addEventListener("click",handler);
      stats.appendChild(el);
    };
    stat("Members",metrics.members,"View members",()=>clickExisting("Members"));
    stat("Attendance",metrics.attendanceToday,"Checked in today",()=>clickExisting("Attendance"));
    stat("Fees today","₹"+metrics.feesToday.toLocaleString("en-IN",{maximumFractionDigits:0}),"Collected today",()=>clickExisting("Payments"));
    portal.appendChild(stats);

    const title=document.createElement("div");title.className="gm-owner-section-title";title.textContent="Quick actions";portal.appendChild(title);
    const actions=document.createElement("section");actions.className="gm-owner-actions";
    actions.append(
      makeAction("Register member","＋","Create account, membership and payment",registerSource?()=>registerSource.click():null),
      makeAction("Attendance","✓","Check today's visits",()=>clickExisting("Attendance")),
      makeAction("Members","◉","Search and manage members",()=>clickExisting("Members")),
      makeAction("Trainers","◎","Manage trainer accounts",()=>clickExisting("Trainers"))
    );
    portal.appendChild(actions);

    const attentionTitle=document.createElement("div");attentionTitle.className="gm-owner-section-title";attentionTitle.textContent="Needs attention";portal.appendChild(attentionTitle);
    const attention=document.createElement("section");attention.className="gm-owner-attention";
    if(!metrics.gym?.latitude||!metrics.gym?.longitude){
      const b=document.createElement("button");b.type="button";b.className="gm-owner-attention-item";b.innerHTML='<span class="attention-icon">!</span><div><b>Complete gym location</b><small>Location is required for member check-in.</small></div><i>›</i>';b.onclick=()=>clickExisting("Settings");attention.appendChild(b);
    }
    if(metrics.outstanding>0){
      const b=document.createElement("button");b.type="button";b.className="gm-owner-attention-item";b.innerHTML=`<span class="attention-icon">₹</span><div><b>₹${metrics.outstanding.toLocaleString("en-IN",{maximumFractionDigits:0})} payment dues</b><small>Open dues and settle outstanding payments.</small></div><i>›</i>`;b.onclick=()=>clickExisting("Dues");attention.appendChild(b);
    }
    if(metrics.expiring>0){
      const b=document.createElement("button");b.type="button";b.className="gm-owner-attention-item";b.innerHTML=`<span class="attention-icon">!</span><div><b>${metrics.expiring} membership${metrics.expiring===1?"":"s"} expiring soon</b><small>Review upcoming renewals.</small></div><i>›</i>`;b.onclick=()=>clickExisting("Memberships");attention.appendChild(b);
    }
    if(!attention.children.length)attention.innerHTML='<div class="gm-owner-attention-clear">You\'re all caught up. No immediate action is required.</div>';
    portal.appendChild(attention);

    const summary=document.createElement("section");summary.className="gm-owner-summary";
    const summaryCard=(label,value,sub,target)=>{const b=document.createElement("button");b.type="button";b.className="gm-owner-summary-card";b.innerHTML=`<small>${label}</small><strong>${value}</strong><span>${sub}</span>`;b.onclick=()=>clickExisting(target);summary.appendChild(b)};
    summaryCard("Memberships",metrics.members,"Active memberships","Memberships");
    summaryCard("Outstanding","₹"+metrics.outstanding.toLocaleString("en-IN",{maximumFractionDigits:0}),"Payment dues","Dues");
    summaryCard("Gym setup",metrics.gym?.latitude&&metrics.gym?.longitude?"Ready":"Action","Location & settings","Settings");
    portal.appendChild(summary);
  }catch(error){errorBox(portal,error)}

  portal.insertAdjacentHTML("beforeend",supportHtml());
}

function observe(){
  if(observer)observer.disconnect();
  observer=new MutationObserver(()=>{
    if(refreshTimer)clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{void render()},50);
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","aria-current"]});
}

function start(){
  if(started)return;
  started=true;installStyle();
  observe();
  const boot=()=>void render();
  boot();
  setTimeout(boot,250);setTimeout(boot,800);setTimeout(boot,1800);
  setInterval(()=>{
    const portal=document.querySelector(".gm-owner-dashboard-portal");
    const h=portal?.querySelector(".gm-owner-greeting");
    if(h&&dashboardActive())h.textContent=`${greeting()}, ${ownerName()}`;
  },60000);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
