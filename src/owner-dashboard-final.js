import { supabase } from "./lib/supabase.js";

/* Gym Manager — Owner Dashboard.
 * Single Owner dashboard presentation layer. Metrics are read directly from
 * Supabase. Actions are bound to the existing React handlers before the old
 * dashboard DOM is replaced, so no action is silently disconnected.
 */

const STYLE = `
.gm-owner-dashboard{display:block;padding:18px 14px 32px;max-width:760px;margin:0 auto}
.gm-owner-hero{padding:4px 2px 18px}
.gm-owner-greeting{margin:0 0 14px;font-size:27px;line-height:1.15;font-weight:800;letter-spacing:-.6px;color:#182230}
.gm-owner-register{width:100%;min-height:50px;border:0;border-radius:14px;background:#182230;color:#fff;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 8px 22px rgba(16,24,40,.12)}
.gm-owner-register:disabled{opacity:.5;cursor:not-allowed}
.gm-owner-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:4px 0 22px}
.gm-owner-stat{min-height:108px;border:1px solid #e4e7ec;border-radius:16px;background:#fff;padding:16px;display:flex;flex-direction:column;justify-content:center}
.gm-owner-stat small{font-size:11px;color:#667085;font-weight:750;text-transform:uppercase;letter-spacing:.5px}
.gm-owner-stat strong{margin-top:6px;font-size:27px;line-height:1;color:#101828}
.gm-owner-stat span{margin-top:6px;font-size:11px;color:#98a2b3}
.gm-owner-section-title{margin:20px 2px 10px;font-size:12px;font-weight:850;letter-spacing:.8px;color:#667085;text-transform:uppercase}
.gm-owner-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.gm-owner-action{min-height:54px;border:1px solid #e4e7ec;border-radius:13px;background:#fff;color:#182230;font-weight:750;text-align:left;padding:0 14px;cursor:pointer}
.gm-owner-action:disabled{opacity:.5;cursor:not-allowed}
.gm-owner-attention{border:1px solid #e4e7ec;border-radius:16px;background:#fff;padding:16px;font-size:13px;color:#475467;line-height:1.5}
.gm-owner-attention.has-items{border-color:#f0c36b;background:#fffaf0}
.gm-owner-support{margin-top:22px;padding:15px 2px 0;border-top:1px solid #eaecf0;text-align:center;color:#667085;font-size:12px}
.gm-owner-support a{display:inline-block;margin-top:6px;color:#182230;font-weight:800;text-decoration:none}
.gm-owner-dashboard-error{margin:0 0 14px;padding:11px 13px;border:1px solid #f0c6cf;border-radius:12px;background:#fff4f5;color:#8f1639;font-size:12px;font-weight:650}
@media(max-width:420px){.gm-owner-dashboard{padding-left:12px;padding-right:12px}.gm-owner-greeting{font-size:24px}}
`;

let mounted=false;
let timer=null;

function installStyle(){
  if(document.getElementById("gm-owner-dashboard-style"))return;
  const style=document.createElement("style");style.id="gm-owner-dashboard-style";style.textContent=STYLE;document.head.appendChild(style);
}

const text=el=>String(el?.textContent||"").replace(/\s+/g," ").trim();

function greeting(){
  const hour=Number(new Intl.DateTimeFormat("en-IN",{hour:"2-digit",hour12:false,timeZone:"Asia/Kolkata"}).format(new Date()));
  if(hour<12)return "Good morning";
  if(hour<17)return "Good afternoon";
  return "Good evening";
}

async function ownerContext(){
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user)throw new Error("Owner session is not available");
  const {data:profile,error:profileError}=await supabase.from("profiles").select("id,gym_id,full_name,display_name,name,role,status").eq("id",user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile?.gym_id)throw new Error("Owner gym is not configured");
  if(profile.role!=="admin")throw new Error("Owner access could not be verified");
  return {user,profile,gymId:profile.gym_id};
}

async function loadMetrics(gymId){
  const start=new Date();start.setHours(0,0,0,0);
  const [people,memberships,attendance]=await Promise.all([
    supabase.from("profiles").select("role,status").eq("gym_id",gymId).in("role",["member","trainer"]),
    supabase.from("memberships").select("amount_due,payment_status,status,expiry_date").eq("gym_id",gymId),
    supabase.from("attendance").select("id").eq("gym_id",gymId).gte("check_in",start.toISOString())
  ]);
  const errors=[people,memberships,attendance].map(x=>x.error).filter(Boolean);
  if(errors.length)throw errors[0];
  const rows=people.data||[];
  const members=rows.filter(x=>x.role==="member"&&String(x.status||"active").toLowerCase()!=="suspended").length;
  const trainers=rows.filter(x=>x.role==="trainer"&&String(x.status||"active").toLowerCase()!=="suspended").length;
  const attendanceToday=(attendance.data||[]).length;
  const outstanding=(memberships.data||[]).reduce((sum,row)=>sum+Number(row.amount_due||0),0);
  const expiring=(memberships.data||[]).filter(row=>{
    if(String(row.status||"").toLowerCase()==="expired"||!row.expiry_date)return false;
    const days=(new Date(`${row.expiry_date}T00:00:00`)-new Date())/86400000;
    return days>=0&&days<=7;
  }).length;
  return {members,trainers,attendanceToday,outstanding,expiring};
}

function findExistingAction(labels){
  const app=document.querySelector(".admin-app");if(!app)return null;
  const wanted=labels.map(x=>x.toLowerCase());
  return [...app.querySelectorAll("button,a,[role=button]")].find(el=>wanted.includes(text(el).toLowerCase()))||null;
}

function activeDashboard(){
  const app=document.querySelector(".admin-app");if(!app)return null;
  const main=app.querySelector("main")||app.querySelector("[role=main]");if(!main)return null;
  const active=[...app.querySelectorAll(".mobile-drawer .nav-item,.sidebar .nav-item,.sidebar-link,.nav-item")].some(el=>/dashboard/i.test(text(el))&&(el.classList.contains("active")||el.getAttribute("aria-current")==="page"));
  return active?main:null;
}

function showError(wrap,error){
  const box=document.createElement("div");box.className="gm-owner-dashboard-error";box.textContent="We couldn't load the dashboard data. Please try again or contact Atelier OG Support.";wrap.prepend(box);
  supabase.rpc("record_platform_error",{p_source:"gym_owner",p_operation:"dashboard_load",p_message:String(error?.message||error),p_error_code:"GM-OWNER-DASHBOARD",p_detail:String(error?.stack||"").slice(0,1800),p_path:window.location.pathname}).catch(()=>{});
}

function actionButton(label,existing){
  const button=document.createElement("button");button.type="button";button.className="gm-owner-action";button.textContent=label;
  if(!existing){button.disabled=true;button.title="This Owner Portal action is not connected to an application handler.";return button;}
  button.addEventListener("click",()=>existing.click());
  return button;
}

async function mount(main){
  if(mounted||!main)return;
  mounted=true;installStyle();

  // Capture the real React action handlers BEFORE replacing the legacy dashboard DOM.
  const handlers={
    register:findExistingAction(["Register member","+ Register member"]),
    attendance:findExistingAction(["Attendance"]),
    members:findExistingAction(["Members"]),
    trainers:findExistingAction(["Trainers"])
  };

  const wrap=document.createElement("div");wrap.className="gm-owner-dashboard";
  main.innerHTML="";main.appendChild(wrap);

  let ctx;
  try{ctx=await ownerContext()}catch(error){showError(wrap,error);return}

  const hero=document.createElement("section");hero.className="gm-owner-hero";
  const h1=document.createElement("h1");h1.className="gm-owner-greeting";
  const name=ctx.profile.full_name||ctx.profile.display_name||ctx.profile.name||"there";
  const updateGreeting=()=>{h1.textContent=`${greeting()}, ${name}`};updateGreeting();
  const register=document.createElement("button");register.type="button";register.className="gm-owner-register";register.textContent="+ Register member";
  if(handlers.register)register.addEventListener("click",()=>handlers.register.click());else register.disabled=true;
  hero.append(h1,register);wrap.appendChild(hero);

  try{
    const metrics=await loadMetrics(ctx.gymId);
    const stats=document.createElement("section");stats.className="gm-owner-stats";
    [["Members",metrics.members,"Active"],["Attendance",metrics.attendanceToday,"Today"],["Trainers",metrics.trainers,"Active"],["Outstanding","₹"+metrics.outstanding.toLocaleString("en-IN",{maximumFractionDigits:0}),"Payment dues"]].forEach(([label,value,sub])=>{const card=document.createElement("article");card.className="gm-owner-stat";card.innerHTML=`<small>${label}</small><strong>${value}</strong><span>${sub}</span>`;stats.appendChild(card)});wrap.appendChild(stats);

    const title=document.createElement("div");title.className="gm-owner-section-title";title.textContent="Quick actions";wrap.appendChild(title);
    const actions=document.createElement("section");actions.className="gm-owner-actions";
    actions.append(actionButton("+ Register member",handlers.register),actionButton("✓ Attendance",handlers.attendance),actionButton("Members",handlers.members),actionButton("Trainers",handlers.trainers));wrap.appendChild(actions);

    const attentionTitle=document.createElement("div");attentionTitle.className="gm-owner-section-title";attentionTitle.textContent="Needs attention";wrap.appendChild(attentionTitle);
    const attention=document.createElement("section");attention.className="gm-owner-attention";
    if(metrics.expiring>0){attention.classList.add("has-items");attention.textContent=`${metrics.expiring} membership${metrics.expiring===1?"":"s"} expire within 7 days.`}else if(metrics.outstanding>0){attention.classList.add("has-items");attention.textContent=`₹${metrics.outstanding.toLocaleString("en-IN",{maximumFractionDigits:0})} in payment dues.`}else attention.textContent="Nothing needs your attention.";
    wrap.appendChild(attention);
  }catch(error){showError(wrap,error)}

  const support=document.createElement("div");support.className="gm-owner-support";support.innerHTML='Need help?<br><a href="mailto:atelierog.co@gmail.com?subject=Gym%20Manager%20Support">Contact Atelier OG</a><br><span>atelierog.co@gmail.com</span>';wrap.appendChild(support);
  timer=setInterval(updateGreeting,60000);
}

function removeOwnerOnlyNavigation(){
  const app=document.querySelector(".admin-app");if(!app)return;
  [...app.querySelectorAll(".mobile-drawer .nav-item,.sidebar .nav-item,.sidebar-link,.nav-item")].forEach(item=>{const label=text(item);if(/^reports$/i.test(label)||/^activity(?: log)?$/i.test(label))item.remove()});
}

function run(){removeOwnerOnlyNavigation();const main=activeDashboard();if(main&&!main.dataset.gmOwnerDashboardMounted){main.dataset.gmOwnerDashboardMounted="true";mount(main)}}

const observer=new MutationObserver(()=>{clearTimeout(run._t);run._t=setTimeout(run,80)});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(run,250);window.addEventListener("beforeunload",()=>{if(timer)clearInterval(timer);observer.disconnect()});
