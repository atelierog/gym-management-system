import { supabase } from "./lib/supabase.js";

/* Gym Manager — final Owner Dashboard presentation layer.
 * Keeps existing React/backend actions and data, but gives the Owner a single
 * focused mobile-first dashboard. Shared backend capabilities are not deleted:
 * Super Admin and other roles may still depend on them.
 */

const DASHBOARD_STYLE = `
.gm-final-dashboard{display:block;padding:18px 14px 32px;max-width:760px;margin:0 auto}
.gm-final-hero{padding:4px 2px 18px}
.gm-final-greeting{margin:0 0 14px;font-size:27px;line-height:1.15;font-weight:800;letter-spacing:-.6px;color:#182230}
.gm-final-register{width:100%;min-height:50px;border:0;border-radius:14px;background:#182230;color:#fff;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 8px 22px rgba(16,24,40,.12)}
.gm-final-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:4px 0 22px}
.gm-final-stat{min-height:108px;border:1px solid #e4e7ec;border-radius:16px;background:#fff;padding:16px;display:flex;flex-direction:column;justify-content:center}
.gm-final-stat small{font-size:11px;color:#667085;font-weight:750;text-transform:uppercase;letter-spacing:.5px}
.gm-final-stat strong{margin-top:6px;font-size:27px;line-height:1;color:#101828}
.gm-final-stat span{margin-top:6px;font-size:11px;color:#98a2b3}
.gm-final-section-title{margin:20px 2px 10px;font-size:12px;font-weight:850;letter-spacing:.8px;color:#667085;text-transform:uppercase}
.gm-final-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.gm-final-action{min-height:54px;border:1px solid #e4e7ec;border-radius:13px;background:#fff;color:#182230;font-weight:750;text-align:left;padding:0 14px;cursor:pointer}
.gm-final-attention{border:1px solid #e4e7ec;border-radius:16px;background:#fff;padding:16px;font-size:13px;color:#475467;line-height:1.5}
.gm-final-attention.has-items{border-color:#f0c36b;background:#fffaf0}
.gm-final-support{margin-top:22px;padding:15px 2px 0;border-top:1px solid #eaecf0;text-align:center;color:#667085;font-size:12px}
.gm-final-support a{display:inline-block;margin-top:6px;color:#182230;font-weight:800;text-decoration:none}
@media(max-width:420px){.gm-final-dashboard{padding-left:12px;padding-right:12px}.gm-final-greeting{font-size:24px}}
`;

let mounted = false;
let timer = null;

function installStyle(){
  if(document.getElementById("gm-final-dashboard-style")) return;
  const style=document.createElement("style");
  style.id="gm-final-dashboard-style";
  style.textContent=DASHBOARD_STYLE;
  document.head.appendChild(style);
}

function text(el){return String(el?.textContent||"").replace(/\s+/g," ").trim()}

function timeGreeting(){
  const hour=Number(new Intl.DateTimeFormat("en-IN",{hour:"2-digit",hour12:false,timeZone:"Asia/Kolkata"}).format(new Date()));
  if(hour<12) return "Good morning";
  if(hour<17) return "Good afternoon";
  return "Good evening";
}

async function ownerName(){
  try{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return "there";
    const {data}=await supabase.from("profiles").select("full_name,display_name,name").eq("id",user.id).maybeSingle();
    return String(data?.full_name||data?.display_name||data?.name||user.user_metadata?.full_name||user.user_metadata?.name||"there").trim()||"there";
  }catch{return "there"}
}

function activeDashboard(){
  const app=document.querySelector(".admin-app");
  if(!app) return null;
  const nav=[...app.querySelectorAll(".mobile-drawer .nav-item,.sidebar .nav-item,.sidebar-link,.nav-item")];
  const active=nav.find(x=>/dashboard/i.test(text(x)) && (x.classList.contains("active")||x.getAttribute("aria-current")==="page"));
  if(active) return app.querySelector("main")||app.querySelector("[role=main]")||app;
  const main=app.querySelector("main")||app.querySelector("[role=main]");
  if(main && /Good to see you|Register member|Quick Actions|Needs Attention/i.test(text(main))) return main;
  return null;
}

function captureExisting(main){
  const result={members:"0",attendance:"0",trainers:"0",outstanding:"₹0",attention:""};
  const cards=[...main.querySelectorAll(".stat,.owner-kpi,[class*=kpi]")];
  for(const card of cards){
    const label=text(card.querySelector("small,.label,[class*=label]"))||text(card).split(/\s+/)[0];
    const value=text(card.querySelector("strong,[class*=value]"));
    const body=text(card);
    if(/members/i.test(label)||/active members/i.test(body)) result.members=value||result.members;
    else if(/attendance/i.test(label)||/today/i.test(body)&&/attendance/i.test(body)) result.attendance=value||result.attendance;
    else if(/trainer/i.test(label)||/active trainers/i.test(body)) result.trainers=value||result.trainers;
    else if(/outstanding|dues/i.test(label)||/outstanding/i.test(body)) result.outstanding=value||result.outstanding;
  }
  const attention=[...main.querySelectorAll("section,article,.card")].find(x=>/needs attention/i.test(text(x)));
  if(attention) result.attention=text(attention).replace(/needs attention/i,"").trim();
  return result;
}

function findAction(label){
  const app=document.querySelector(".admin-app");
  if(!app) return null;
  return [...app.querySelectorAll("button,a,[role=button]")].find(el=>new RegExp(`^\\s*${label}\\s*$`,"i").test(text(el)))||
    [...app.querySelectorAll("button,a,[role=button]")].find(el=>new RegExp(label,"i").test(text(el)));
}

function actionButton(label,existing){
  const b=document.createElement("button");
  b.type="button";
  b.className="gm-final-action";
  b.textContent=label;
  b.addEventListener("click",()=>{if(existing?.isConnected) existing.click(); else {const fallback=findAction(label);fallback?.click()}});
  return b;
}

async function mount(main){
  if(mounted||!main) return;
  const snapshot=captureExisting(main);
  const register=findAction("Register member");
  const attendance=findAction("Attendance");
  const members=findAction("Members");
  const trainers=findAction("Trainers");
  const membership=findAction("Memberships");
  const dues=findAction("Dues");
  const name=await ownerName();
  if(!main.isConnected) return;
  mounted=true;
  main.dataset.gmFinalDashboard="true";
  main.innerHTML="";
  const wrap=document.createElement("div");wrap.className="gm-final-dashboard";
  const hero=document.createElement("section");hero.className="gm-final-hero";
  const greeting=document.createElement("h1");greeting.className="gm-final-greeting";greeting.textContent=`${timeGreeting()}, ${name}`;
  const reg=document.createElement("button");reg.type="button";reg.className="gm-final-register";reg.textContent="+ Register member";reg.addEventListener("click",()=>register?.click());
  hero.append(greeting,reg);wrap.appendChild(hero);

  const stats=document.createElement("section");stats.className="gm-final-stats";
  [["Members",snapshot.members,"Active"],["Attendance",snapshot.attendance,"Today"],["Trainers",snapshot.trainers,"Active"],["Outstanding",snapshot.outstanding,"Payment dues"]].forEach(([l,v,s])=>{const c=document.createElement("article");c.className="gm-final-stat";c.innerHTML=`<small>${l}</small><strong>${v||"0"}</strong><span>${s}</span>`;stats.appendChild(c)});
  wrap.appendChild(stats);

  const title=document.createElement("div");title.className="gm-final-section-title";title.textContent="Quick actions";wrap.appendChild(title);
  const actions=document.createElement("section");actions.className="gm-final-actions";
  actions.append(actionButton("+ Register member",register),actionButton("✓ Attendance",attendance),actionButton("Members",members),actionButton("Trainers",trainers));
  wrap.appendChild(actions);

  const attentionTitle=document.createElement("div");attentionTitle.className="gm-final-section-title";attentionTitle.textContent="Needs attention";wrap.appendChild(attentionTitle);
  const attention=document.createElement("section");attention.className="gm-final-attention";
  const raw=snapshot.attention.replace(/^needs attention\s*/i,"").trim();
  if(!raw||/nothing|complete gym setup/i.test(raw)===false){attention.textContent=raw||"Nothing needs your attention."}else if(/complete gym setup/i.test(raw)){attention.textContent=raw}else{attention.textContent="Nothing needs your attention."}
  if(!raw||/nothing/i.test(raw)) attention.textContent="Nothing needs your attention.";
  wrap.appendChild(attention);

  const support=document.createElement("div");support.className="gm-final-support";support.innerHTML='Need help?<br><a href="mailto:atelierog.co@gmail.com?subject=Gym%20Manager%20Support">Contact Atelier OG</a><br><span>atelierog.co@gmail.com</span>';wrap.appendChild(support);
  main.appendChild(wrap);

  // Greeting is time-aware without requiring a page refresh.
  const updateGreeting=()=>{greeting.textContent=`${timeGreeting()}, ${name}`};
  timer=setInterval(updateGreeting,60000);
}

function removeOwnerReportsAndActivity(){
  const app=document.querySelector(".admin-app");
  if(!app) return;
  [...app.querySelectorAll(".mobile-drawer .nav-item,.sidebar .nav-item,.sidebar-link,.nav-item")].forEach(item=>{
    const label=text(item);
    if(/^reports$/i.test(label)||/^activity(?: log)?$/i.test(label)) item.remove();
  });
}

function run(){
  installStyle();
  removeOwnerReportsAndActivity();
  const main=activeDashboard();
  if(main && main.dataset.gmFinalDashboard!=="true") mount(main);
}

const observer=new MutationObserver(()=>{clearTimeout(run._t);run._t=setTimeout(run,60)});
observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(run,200);
window.addEventListener("beforeunload",()=>{if(timer)clearInterval(timer);observer.disconnect()});
