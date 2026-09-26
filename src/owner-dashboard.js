import { supabase } from "./lib/supabase.js";

/* Gym Manager — Owner Dashboard v2
 * The legacy dashboard is removed from the active view. This file is the
 * single owner home-screen presentation layer. Existing React navigation and
 * forms remain the source of truth for actions and writes.
 */

const STYLE = `
.gm-owner-v2{min-height:calc(100dvh - 72px);background:#f5f7fa;color:#182230;padding:20px 12px 34px;max-width:760px;margin:0 auto;font-family:inherit}
.gm-owner-v2[hidden]{display:none!important}
.gm-owner-v2 *{box-sizing:border-box}
.gm-owner-v2 .greeting{margin:0 2px 16px;font-size:27px;line-height:1.15;font-weight:800;letter-spacing:-.6px}
.gm-owner-v2 .register{width:100%;min-height:52px;border:0;border-radius:14px;background:#182230;color:#fff;font:800 15px inherit;cursor:pointer;margin-bottom:22px}
.gm-owner-v2 .register:active,.gm-owner-v2 .action:active{transform:translateY(1px)}
.gm-owner-v2 .stats{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#dfe3e8;border:1px solid #dfe3e8;border-radius:16px;overflow:hidden;margin-bottom:24px}
.gm-owner-v2 .stat{min-height:106px;border:0;background:#fff;padding:16px;text-align:left}
.gm-owner-v2 .stat small{display:block;color:#667085;font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase}
.gm-owner-v2 .stat strong{display:block;margin-top:9px;color:#101828;font-size:27px;line-height:1;font-weight:800}
.gm-owner-v2 .stat span{display:block;margin-top:6px;color:#98a2b3;font-size:11px}
.gm-owner-v2 .section-title{margin:0 2px 10px;font-size:12px;font-weight:850;letter-spacing:.8px;color:#667085;text-transform:uppercase}
.gm-owner-v2 .actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:24px}
.gm-owner-v2 .action{min-height:104px;border:1px solid #e0e4e9;border-radius:14px;background:#fff;color:#182230;padding:14px;text-align:left;font:inherit;cursor:pointer}
.gm-owner-v2 .action-icon{display:flex;width:38px;height:38px;border-radius:11px;background:#eef1f4;align-items:center;justify-content:center;font-size:19px;color:#344054}
.gm-owner-v2 .action b{display:block;margin-top:9px;font-size:14px}
.gm-owner-v2 .action small{display:block;margin-top:4px;color:#667085;font-size:10px;line-height:1.35}
.gm-owner-v2 .attention{border:1px solid #e0e4e9;border-radius:16px;background:#fff;overflow:hidden;margin-bottom:24px}
.gm-owner-v2 .attention-empty{padding:18px 16px;color:#475467;font-size:13px}
.gm-owner-v2 .attention-item{width:100%;display:flex;align-items:center;gap:11px;border:0;border-bottom:1px solid #eaecf0;background:#fff;padding:15px;text-align:left;color:#182230;font:inherit;cursor:pointer}
.gm-owner-v2 .attention-item:last-child{border-bottom:0}
.gm-owner-v2 .attention-icon{width:38px;height:38px;flex:0 0 38px;border-radius:11px;background:#fff4d6;color:#8a5b00;display:flex;align-items:center;justify-content:center;font-weight:900}
.gm-owner-v2 .attention-copy{min-width:0}
.gm-owner-v2 .attention-copy b{display:block;font-size:13px}
.gm-owner-v2 .attention-copy small{display:block;margin-top:3px;color:#667085;font-size:10px}
.gm-owner-v2 .attention-arrow{margin-left:auto;color:#98a2b3;font-size:22px}
.gm-owner-v2 .support{padding:18px 4px 0;border-top:1px solid #dfe3e8;text-align:center;color:#667085;font-size:12px;line-height:1.55}
.gm-owner-v2 .support b{display:block;color:#182230;font-size:13px;margin-bottom:3px}
.gm-owner-v2 .support a{color:#182230;font-weight:800;text-decoration:none}
.gm-owner-v2 .error{padding:13px 14px;margin-bottom:14px;border:1px solid #efb7c2;border-radius:13px;background:#fff4f5;color:#8f1639;font-size:12px;font-weight:700;overflow-wrap:anywhere}
.gm-owner-v2 .loading{padding:22px 4px;color:#667085;font-size:13px}
.gm-owner-bell{width:42px;height:42px;border:1px solid #344054;border-radius:12px;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;margin-right:7px}
.gm-owner-bell svg{width:20px;height:20px}
.gm-owner-bell .count{position:absolute;right:-3px;top:-4px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#c2413b;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center}
@media(max-width:380px){.gm-owner-v2{padding-left:10px;padding-right:10px}.gm-owner-v2 .greeting{font-size:24px}}
`;

let started=false;
let observer=null;
let timer=null;
let context=null;
let metrics=null;

const clean=v=>String(v??"").replace(/\s+/g," ").trim();
const text=v=>clean(v).toLowerCase();

function installStyle(){
  if(document.getElementById("gm-owner-v2-style"))return;
  const style=document.createElement("style");
  style.id="gm-owner-v2-style";
  style.textContent=STYLE;
  document.head.appendChild(style);
}

function app(){return document.querySelector(".admin-app");}
function main(){return app()?.querySelector(".admin-main")||null;}
function activeDashboard(){return text(document.querySelector(".admin-page-header .page-title-row h2")?.textContent)==="dashboard";}

function findNav(label){
  const wanted=text(label);
  return [...document.querySelectorAll(".mobile-drawer .nav-item,.admin-nav .nav-item")].find(el=>text(el.textContent)===wanted)||null;
}

function navigate(label){
  const el=findNav(label);
  if(el){el.click();return true;}
  return false;
}

function openRegister(){
  if(!navigate("Members"))return false;
  setTimeout(()=>document.querySelector('.admin-page-header .page-action')?.click(),80);
  return true;
}

function ownerDisplayName(){return clean(context?.profile?.full_name||context?.profile?.display_name||context?.profile?.name)||"there";}

function greeting(){
  const hour=Number(new Intl.DateTimeFormat("en-IN",{hour:"2-digit",hour12:false,timeZone:"Asia/Kolkata"}).format(new Date()));
  return hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
}

function removeLegacyDashboard(){
  const m=main();
  if(!m)return;
  [...m.querySelectorAll(".owner-dashboard-hero,.owner-kpis,.owner-section,.owner-summary-links,.dashboard-page,.dashboard-content")].forEach(el=>el.remove());
  const header=m.querySelector(":scope > .admin-page-header");
  if(header)header.style.display="none";
  [...m.children].forEach(el=>{
    if(el.classList.contains("gm-owner-v2"))return;
    if(el.classList.contains("notice"))return;
    if(el.matches(".owner-dashboard-hero,.owner-kpis,.owner-section,.owner-summary-links"))el.remove();
  });
}

function restoreLegacy(){
  const m=main();
  if(!m)return;
  const header=m.querySelector(":scope > .admin-page-header");
  if(header)header.style.display="";
}

function addBell(){
  const bar=document.querySelector(".owner-topbar");
  if(!bar||bar.querySelector(".gm-owner-bell"))return;
  const menu=bar.querySelector(".owner-menu-button");
  if(!menu)return;
  const bell=document.createElement("button");
  bell.type="button";
  bell.className="gm-owner-bell";
  bell.setAttribute("aria-label","View notifications and attention items");
  bell.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  bell.addEventListener("click",()=>document.querySelector(".gm-owner-v2 .attention")?.scrollIntoView({behavior:"smooth",block:"start"}));
  menu.parentElement.insertBefore(bell,menu);
}

function supportHtml(){return `<footer class="support"><b>Need help?</b>Contact Atelier OG<br><a href="mailto:atelierog.co@gmail.com?subject=Gym%20Manager%20Support">atelierog.co@gmail.com</a></footer>`;}

async function loadContext(){
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
  const seven=new Date(start);seven.setDate(seven.getDate()+7);
  const [people,memberships,attendance,gym]=await Promise.all([
    supabase.from("profiles").select("role,status").eq("gym_id",gymId).in("role",["member","trainer"]),
    supabase.from("memberships").select("amount_due,status,expiry_date").eq("gym_id",gymId),
    supabase.from("attendance").select("id").eq("gym_id",gymId).gte("check_in",start.toISOString()).lt("check_in",end.toISOString()),
    supabase.from("gyms").select("id,name,latitude,longitude").eq("id",gymId).maybeSingle()
  ]);
  const failure=[people,memberships,attendance,gym].map(x=>x.error).find(Boolean);
  if(failure)throw failure;
  const rows=people.data||[];
  const activeMembers=rows.filter(x=>x.role==="member"&&text(x.status||"active")==="active").length;
  const activeTrainers=rows.filter(x=>x.role==="trainer"&&text(x.status||"active")==="active").length;
  const attendanceToday=(attendance.data||[]).length;
  const outstanding=(memberships.data||[]).reduce((sum,row)=>sum+Number(row.amount_due||0),0);
  const expiringSoon=(memberships.data||[]).filter(row=>{
    if(text(row.status)==="expired"||!row.expiry_date)return false;
    const expiry=new Date(`${row.expiry_date}T00:00:00`);
    return expiry>=start&&expiry<=seven;
  }).length;
  return {activeMembers,activeTrainers,attendanceToday,outstanding,expiringSoon,gym:gym.data||null};
}

function money(value){return "₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:0});}

function attentionItems(){
  const items=[];
  if(!metrics)return items;
  if(metrics.expiringSoon>0)items.push({type:"memberships",title:`${metrics.expiringSoon} membership${metrics.expiringSoon===1?"":"s"} expire soon`,sub:"View memberships →"});
  if(metrics.outstanding>0)items.push({type:"dues",title:`${money(metrics.outstanding)} payment dues`,sub:"View dues →"});
  return items;
}

function render(){
  const m=main();
  if(!m)return;
  const old=m.querySelector(".gm-owner-v2");
  if(!activeDashboard()){
    old?.remove();
    restoreLegacy();
    return;
  }
  removeLegacyDashboard();
  if(old)return;

  const portal=document.createElement("section");
  portal.className="gm-owner-v2";
  portal.setAttribute("aria-label","Gym Manager owner dashboard");
  m.appendChild(portal);

  const greetingEl=document.createElement("h1");
  greetingEl.className="greeting";
  greetingEl.textContent=`${greeting()}, ${ownerDisplayName()}`;
  portal.appendChild(greetingEl);

  const register=document.createElement("button");
  register.type="button";register.className="register";register.textContent="+ Register member";register.addEventListener("click",openRegister);
  portal.appendChild(register);

  const error=document.createElement("div");
  error.className="error";error.hidden=true;
  portal.appendChild(error);

  const stats=document.createElement("section");stats.className="stats";
  const stat=(label,value,sub)=>{const el=document.createElement("article");el.className="stat";el.innerHTML=`<small>${label}</small><strong>${value}</strong><span>${sub}</span>`;stats.appendChild(el)};
  stat("Members","—","Active");stat("Attendance","—","Today");stat("Trainers","—","Active");stat("Outstanding","—","Payment dues");
  portal.appendChild(stats);

  const title=document.createElement("div");title.className="section-title";title.textContent="Quick actions";portal.appendChild(title);
  const actions=document.createElement("section");actions.className="actions";
  const action=(label,icon,sub,handler)=>{const b=document.createElement("button");b.type="button";b.className="action";b.innerHTML=`<span class="action-icon">${icon}</span><b>${label}</b><small>${sub}</small>`;b.addEventListener("click",handler);actions.appendChild(b)};
  action("Register Member","＋","Create account, membership and payment",openRegister);
  action("Attendance","✓","Check today's visits",()=>navigate("Attendance"));
  action("Members","◉","Search and manage members",()=>navigate("Members"));
  action("Trainers","◎","Manage trainer accounts",()=>navigate("Trainers"));
  portal.appendChild(actions);

  const attentionTitle=document.createElement("div");attentionTitle.className="section-title";attentionTitle.textContent="Needs attention";portal.appendChild(attentionTitle);
  const attention=document.createElement("section");attention.className="attention";
  const items=attentionItems();
  if(!items.length){attention.innerHTML='<div class="attention-empty">Nothing needs your attention.</div>'}
  else items.forEach(item=>{
    const b=document.createElement("button");b.type="button";b.className="attention-item";b.innerHTML=`<span class="attention-icon">⚠</span><span class="attention-copy"><b>${item.title}</b><small>${item.sub}</small></span><span class="attention-arrow">›</span>`;b.addEventListener("click",()=>navigate(item.type==="dues"?"Dues":"Memberships"));attention.appendChild(b);
  });
  portal.appendChild(attention);

  portal.insertAdjacentHTML("beforeend",supportHtml());

  if(!context){
    loadContext().then(ctx=>{context=ctx;renderData(portal)}).catch(err=>showDashboardError(portal,err));
  }else loadData(portal);
}

function showDashboardError(portal,error){
  const box=portal.querySelector(".error");
  if(!box)return;
  box.hidden=false;box.textContent="We couldn't load the dashboard data. Please try again or contact Atelier OG Support.";
  try{supabase.rpc("record_platform_error",{p_source:"gym_owner",p_operation:"dashboard_load",p_message:String(error?.message||error),p_error_code:"GM-OWNER-DASHBOARD",p_detail:String(error?.stack||"").slice(0,1800),p_path:window.location.pathname})}catch{}
}

async function loadData(portal){
  try{
    metrics=await loadMetrics(context.gymId);
    renderData(portal);
  }catch(error){showDashboardError(portal,error)}
}

function renderData(portal){
  if(!portal?.isConnected)return;
  portal.querySelector(".greeting").textContent=`${greeting()}, ${ownerDisplayName()}`;
  const values=[
    ["Members",metrics.activeMembers,"Active"],
    ["Attendance",metrics.attendanceToday,"Today"],
    ["Trainers",metrics.activeTrainers,"Active"],
    ["Outstanding",money(metrics.outstanding),"Payment dues"]
  ];
  portal.querySelectorAll(".stat").forEach((el,i)=>{const [label,value,sub]=values[i];el.innerHTML=`<small>${label}</small><strong>${value}</strong><span>${sub}</span>`});
  const attention=portal.querySelector(".attention");
  const items=attentionItems();
  if(!items.length)attention.innerHTML='<div class="attention-empty">Nothing needs your attention.</div>';
  else{attention.innerHTML="";items.forEach(item=>{const b=document.createElement("button");b.type="button";b.className="attention-item";b.innerHTML=`<span class="attention-icon">⚠</span><span class="attention-copy"><b>${item.title}</b><small>${item.sub}</small></span><span class="attention-arrow">›</span>`;b.addEventListener("click",()=>navigate(item.type==="dues"?"Dues":"Memberships"));attention.appendChild(b)})}
}

function start(){
  if(started)return;
  started=true;installStyle();
  const run=()=>{addBell();render()};
  observer=new MutationObserver(run);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  run();
  timer=setInterval(run,1200);
  setTimeout(()=>clearInterval(timer),15000);
}

start();
