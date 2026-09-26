import { supabase } from "./lib/supabase.js";

/* Gym Manager — Owner Portal repair / mobile hardening layer.
 * This file is loaded by index.html after the owner UI is mounted.
 * It intentionally stays UI-side: database writes remain in main.jsx / Edge Functions.
 */

const STYLE = `
/* --- Owner portal repair --- */
.admin-app .owner-topbar{position:sticky;top:0;z-index:1000}
.admin-app .owner-menu-button{position:relative;z-index:1005;pointer-events:auto;touch-action:manipulation}
/* React only renders the drawer while mobileMenu=true, so its presence is the open state. */
.admin-app .mobile-drawer{transform:translateX(0)!important;pointer-events:auto!important}
.admin-app .mobile-scrim{opacity:1!important;pointer-events:auto!important}
.admin-app .mobile-drawer .nav-item,.admin-app .mobile-drawer .drawer-close,.admin-app .mobile-drawer .sidebar-link{touch-action:manipulation}
.admin-app .modal{width:min(620px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:hidden;display:flex;flex-direction:column}
.admin-app .modal-head{position:sticky;top:0;z-index:2;flex:none;background:#fff}
.admin-app .modal-body{overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.admin-app .form button,.admin-app .form .primary,.admin-app .form .secondary{min-height:46px}
.admin-app .table{overflow-x:auto;-webkit-overflow-scrolling:touch}
.admin-app .table .tr{min-width:680px}
.admin-app .notice.notice-error{position:relative;overflow-wrap:anywhere;padding-right:44px}
.admin-app .notice.notice-error::after{content:attr(data-error-code);display:block;margin-top:6px;color:#8f1639;font-size:9px;font-weight:800;letter-spacing:.7px;opacity:.8}
.admin-app .auto-id-field{background:#f8fafc!important;color:#344054!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;letter-spacing:.6px!important;font-weight:800!important}
.admin-app .auto-id-hint{display:block;margin-top:4px;color:#98a2b3;font-size:10px;line-height:1.35}
.admin-app .owner-form-shortcut{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 2px;padding:12px 13px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc}
.admin-app .owner-form-shortcut div{min-width:0}
.admin-app .owner-form-shortcut b{display:block;font-size:11px;color:#182230}
.admin-app .owner-form-shortcut span{display:block;margin-top:2px;font-size:10px;color:#667085}
.admin-app .owner-form-shortcut button{min-height:38px!important;padding:0 12px;border:1px solid #d9dde4;border-radius:9px;background:#fff;color:#182230;font-weight:750;white-space:nowrap}
.admin-app .temporary-password-note{font-size:10px;color:#667085;line-height:1.4;margin:-3px 0 2px}
.admin-app .notice.notice-error .notice-error-message{display:block}
.gm-owner-runtime-error{position:fixed;left:12px;right:12px;bottom:14px;z-index:2147483000;padding:13px 15px;border:1px solid #e7a6b1;border-radius:14px;background:#fff1f3;color:#8f1639;box-shadow:0 16px 40px rgba(16,24,40,.22);font:700 12px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}
.gm-owner-runtime-error b{display:block;margin-bottom:3px;font-size:13px}
.gm-owner-runtime-error small{display:block;margin-top:5px;font-weight:600;opacity:.85}
.admin-app.owner-data-unavailable .owner-kpi strong{font-size:24px}
.admin-app.owner-data-unavailable .owner-kpi span{color:#c2413b}
@media(max-width:700px){
 .admin-app .modal{width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:18px}
 .admin-app .modal-body{padding-bottom:max(18px,env(safe-area-inset-bottom))}
 .admin-app .notice{overflow-wrap:anywhere}
 .admin-app .section-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%}
 .admin-app .section-actions>*{min-width:0}
 .admin-app .owner-form-shortcut{align-items:flex-start}
}
`;

let runtimeErrorVisible=false;
let observer=null;
const enhancedForms=new WeakSet();
const generatedPasswords=new WeakMap();

function installStyle(){
  if(document.getElementById("gm-owner-fixes-style")) return;
  const style=document.createElement("style");
  style.id="gm-owner-fixes-style";
  style.textContent=STYLE;
  document.head.appendChild(style);
}

function makeErrorCode(){
  const stamp=Date.now().toString(36).toUpperCase().slice(-6);
  const rand=Math.random().toString(36).slice(2,5).toUpperCase();
  return `GM-OWNER-${stamp}-${rand}`;
}

function safeText(value){return String(value??"").replace(/[<>]/g,"")}

function userFacingError(message){
  const raw=String(message||"");
  if(/permission denied.*schema|schema private|permission denied/i.test(raw)){
    return "We couldn't load your gym data right now. Please try again. If it continues, contact support.";
  }
  if(/failed to fetch|networkerror|network request failed/i.test(raw)){
    return "Connection problem. Check your internet connection and try again.";
  }
  if(/invalid.*api key|api key/i.test(raw)){
    return "Gym Manager could not connect to its service. Please try again or contact support.";
  }
  return raw;
}

async function reportError(code,operation,message,detail=""){
  try{
    await supabase?.rpc("record_platform_error",{
      p_source:"gym_owner",
      p_operation:operation,
      p_message:String(message||"Unexpected error"),
      p_error_code:code,
      p_detail:String(detail||"").slice(0,1800),
      p_path:window.location.pathname
    });
  }catch{}
}

function isOwnerPortal(){return !!document.querySelector(".admin-app")}

function decorateErrorNotices(){
  if(!isOwnerPortal()) return;
  document.querySelectorAll(".admin-app .notice.notice-error").forEach(notice=>{
    const original=String(notice.textContent||"").replace(/×/g," ").trim();
    const friendly=userFacingError(original);
    if(friendly && friendly!==original && !notice.dataset.ownerFriendly){
      const textNode=[...notice.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
      if(textNode) textNode.textContent=friendly+" ";
      notice.dataset.ownerFriendly="true";
    }
    if(!notice.dataset.errorCode){
      const code=makeErrorCode();
      notice.dataset.errorCode=code;
      reportError(code,"owner_ui_notice",original);
    }
    if(/couldn't load your gym data|permission denied|schema private/i.test(original)){
      document.querySelectorAll(".admin-app .owner-kpi strong").forEach(x=>{x.textContent="—"});
      document.querySelectorAll(".admin-app .owner-kpi span").forEach(x=>{x.textContent="Data unavailable"});
      document.querySelector(".admin-app")?.classList.add("owner-data-unavailable");
    }
  });
}

function repairOwnerButtons(){
  if(!isOwnerPortal()) return;
  document.querySelectorAll(".admin-app button").forEach(button=>{
    const label=String(button.textContent||"").trim();
    if(!label && !button.getAttribute("aria-label")){
      const modal=button.closest(".modal");
      const head=modal?.querySelector(".modal-head h3")?.textContent?.trim();
      if(head && button.classList.contains("danger-button")){
        button.textContent="Delete";
        button.setAttribute("aria-label","Delete");
      }
    }
  });
}

function showRuntimeError(message){
  if(runtimeErrorVisible || !isOwnerPortal()) return;
  runtimeErrorVisible=true;
  const code=makeErrorCode();
  const box=document.createElement("div");
  box.className="gm-owner-runtime-error";
  box.setAttribute("role","alert");
  box.innerHTML=`<b>Something went wrong</b><span>${safeText(userFacingError(message))}</span><small>Support code: ${code}</small>`;
  document.body.appendChild(box);
  reportError(code,"owner_runtime_error",message);
  setTimeout(()=>{box.remove();runtimeErrorVisible=false},9000);
}

function installRuntimeHandlers(){
  window.addEventListener("error",event=>{
    if(!isOwnerPortal()) return;
    const message=event?.error?.message||event?.message||"Unexpected browser error";
    showRuntimeError(message);
  });
  window.addEventListener("unhandledrejection",event=>{
    if(!isOwnerPortal()) return;
    const reason=event?.reason?.message||String(event?.reason||"Unhandled promise rejection");
    showRuntimeError(reason);
  });
}

function nativeSetValue(input,value){
  if(!input) return;
  const proto=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;
  if(setter) setter.call(input,String(value));
  else input.value=String(value);
  input.dispatchEvent(new Event("input",{bubbles:true}));
  input.dispatchEvent(new Event("change",{bubbles:true}));
}

function randomTempPassword(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes=new Uint32Array(8);
  try{crypto.getRandomValues(bytes)}catch{for(let i=0;i<8;i++)bytes[i]=Math.floor(Math.random()*chars.length)}
  return Array.from(bytes,n=>chars[n%chars.length]).join("");
}

function currentYearCode(){return String(new Date().getFullYear()).slice(-2)}

function fallbackNextId(role){
  const prefix=role==="trainer"?"TRN":"MEM";
  const re=new RegExp(`^${prefix}-(\\d{2})-(\\d+)$`);
  let max=0;
  document.querySelectorAll(".people-table .tr:not(.th) span:nth-child(2)").forEach(el=>{
    const m=String(el.textContent||"").trim().match(re);
    if(m) max=Math.max(max,Number(m[2]));
  });
  return `${prefix}-${currentYearCode()}-${String(max+1).padStart(3,"0")}`;
}

async function getNextId(role){
  const prefix=role==="trainer"?"TRN":"MEM";
  const year=currentYearCode();
  try{
    const {data:{user}}=await supabase.auth.getUser();
    if(user){
      const {data:me}=await supabase.from("profiles").select("gym_id").eq("id",user.id).maybeSingle();
      if(me?.gym_id){
        const {data}=await supabase.from("profiles").select("login_id").eq("gym_id",me.gym_id).like("login_id",`${prefix}-${year}-%`);
        let max=0;
        (data||[]).forEach(row=>{
          const match=String(row.login_id||"").match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
          if(match) max=Math.max(max,Number(match[1]));
        });
        return `${prefix}-${year}-${String(max+1).padStart(3,"0")}`;
      }
    }
  }catch{}
  return fallbackNextId(role);
}

function modalTitle(){return String(document.querySelector(".admin-app .modal .modal-head h3")?.textContent||"").trim().toLowerCase()}

function findModalForm(){return document.querySelector(".admin-app .modal form.form")}

function markRequired(input,labelText){
  if(!input) return;
  input.required=true;
  input.setAttribute("aria-required","true");
  if(labelText){
    const label=input.closest("label");
    if(label){
      const small=label.querySelector("small");
      if(small) small.remove();
      const first=label.firstChild;
      if(first&&first.nodeType===Node.TEXT_NODE){
        first.textContent=labelText;
      }
    }
  }
}

function addTrainerShortcut(form){
  if(!form||form.dataset.trainerShortcut) return;
  const shortcut=document.createElement("div");
  shortcut.className="owner-form-shortcut";
  shortcut.innerHTML=`<div><b>Need to add a trainer?</b><span>You can create the trainer account without leaving Gym Manager.</span></div><button type="button">Add trainer</button>`;
  shortcut.querySelector("button").addEventListener("click",()=>{
    const close=form.closest(".modal")?.querySelector(".modal-head button");
    close?.click();
    setTimeout(()=>{
      const menu=document.querySelector(".owner-menu-button");
      if(menu) menu.click();
      setTimeout(()=>{
        const trainerNav=[...document.querySelectorAll(".mobile-drawer .nav-item")].find(b=>String(b.textContent||"").trim()==="Trainers");
        if(trainerNav){
          trainerNav.click();
          setTimeout(()=>document.querySelector(".admin-page-header .page-action")?.click(),80);
        }
      },80);
    },40);
  });
  const email=form.querySelector('input[name="email"]');
  (email?.closest("label")||form.querySelector('input[name="phone"]')?.closest("label")||form.firstElementChild)?.after(shortcut);
  form.dataset.trainerShortcut="true";
}

async function enhanceMemberForm(form){
  markRequired(form.querySelector('input[name="phone"]'),"Phone");
  const email=form.querySelector('input[name="email"]');
  markRequired(email,"Email");
  if(email){email.setAttribute("autocomplete","email");email.placeholder="member@example.com"}
  const phone=form.querySelector('input[name="phone"]');
  if(phone){phone.setAttribute("autocomplete","tel");phone.setAttribute("pattern","\\+?[0-9][0-9\\s-]{9,14}");phone.minLength=10;phone.maxLength=15}
  const id=form.querySelector('input[name="login_id"]');
  if(id){
    id.readOnly=true;
    id.classList.add("auto-id-field");
    id.setAttribute("aria-label","Automatically generated member ID");
    if(!form.dataset.ownerIdReady){
      form.dataset.ownerIdReady="pending";
      const next=await getNextId("member");
      nativeSetValue(id,next);
      id.dataset.ownerGenerated=next;
      form.dataset.ownerIdReady="ready";
      if(!id.parentElement?.querySelector(".auto-id-hint")){
        const hint=document.createElement("small");hint.className="auto-id-hint";hint.textContent="Automatically generated — the owner does not need to enter it.";id.parentElement?.appendChild(hint);
      }
    }
  }
  const password=form.querySelector('input[name="password"]');
  if(password){
    if(!generatedPasswords.has(form)) generatedPasswords.set(form,randomTempPassword());
    const temp=generatedPasswords.get(form);
    nativeSetValue(password,temp);
    password.minLength=8;
    const label=password.closest("label");
    if(label){
      const text=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
      if(text) text.textContent="Temporary password";
    }
    if(!form.querySelector(".temporary-password-note")){
      const note=document.createElement("div");note.className="temporary-password-note";note.textContent="An easy-to-handle 8-character temporary password is generated automatically. The member changes it after first login.";label?.after(note);
    }
  }
  addTrainerShortcut(form);
}

async function enhanceTrainerForm(form){
  markRequired(form.querySelector('input[name="phone"]'),"Phone");
  const email=form.querySelector('input[name="email"]');
  markRequired(email,"Email");
  if(email){email.setAttribute("autocomplete","email");email.placeholder="trainer@example.com"}
  const phone=form.querySelector('input[name="phone"]');
  if(phone){phone.setAttribute("autocomplete","tel");phone.setAttribute("pattern","\\+?[0-9][0-9\\s-]{9,14}");phone.minLength=10;phone.maxLength=15}
  const id=form.querySelector('input[name="login_id"]');
  if(id){
    id.readOnly=true;
    id.classList.add("auto-id-field");
    id.setAttribute("aria-label","Automatically generated trainer ID");
    if(!form.dataset.ownerIdReady){
      form.dataset.ownerIdReady="pending";
      const next=await getNextId("trainer");
      nativeSetValue(id,next);
      id.dataset.ownerGenerated=next;
      form.dataset.ownerIdReady="ready";
      if(!id.parentElement?.querySelector(".auto-id-hint")){
        const hint=document.createElement("small");hint.className="auto-id-hint";hint.textContent="Automatically generated — the owner does not need to enter it.";id.parentElement?.appendChild(hint);
      }
    }
  }
  const password=form.querySelector('input[name="password"]');
  if(password){
    if(!generatedPasswords.has(form)) generatedPasswords.set(form,randomTempPassword());
    password.value=generatedPasswords.get(form);
    password.setAttribute("value",password.value);
    password.minLength=8;
  }
  const note=form.querySelector(".generated-credential-note span");
  if(note) note.textContent="An 8-character temporary password is generated automatically. The trainer changes it after first login.";
}

function enhanceResetForm(form){
  if(!form||form.dataset.resetEnhanced) return;
  form.dataset.resetEnhanced="true";
  const first=form.querySelector('input[name="password"]');
  const confirm=form.querySelector('input[name="confirm"]');
  const temp=randomTempPassword();
  nativeSetValue(first,temp);
  nativeSetValue(confirm,temp);
  first?.setAttribute("autocomplete","new-password");
  confirm?.setAttribute("autocomplete","new-password");
  const note=document.createElement("div");
  note.className="temporary-password-note";
  note.textContent="Generated temporary password: 8 characters. The account holder should change it after signing in.";
  confirm?.closest("label")?.after(note);
}

function enhanceOwnerForms(){
  if(!isOwnerPortal()) return;
  const form=findModalForm();
  if(!form) return;
  const title=modalTitle();
  if(title==="register new member") enhanceMemberForm(form);
  else if(title==="add trainer") enhanceTrainerForm(form);
  else if(title.startsWith("password controls")) enhanceResetForm(form);
}

function ensureSubmitValues(event){
  const form=event.target?.closest?.("form.form");
  if(!form||!isOwnerPortal()) return;
  const title=String(form.closest(".modal")?.querySelector(".modal-head h3")?.textContent||"").trim().toLowerCase();
  if(title==="register new member"||title==="add trainer"){
    const role=title==="add trainer"?"trainer":"member";
    const id=form.querySelector('input[name="login_id"]');
    if(id){
      const generated=id.dataset.ownerGenerated||fallbackNextId(role);
      nativeSetValue(id,generated);
    }
    const password=form.querySelector('input[name="password"]');
    if(password){
      const generated=generatedPasswords.get(form)||randomTempPassword();
      generatedPasswords.set(form,generated);
      nativeSetValue(password,generated);
      password.value=generated;
      password.setAttribute("value",generated);
    }
  }
  if(title.startsWith("password controls")){
    const password=form.querySelector('input[name="password"]');
    const confirm=form.querySelector('input[name="confirm"]');
    if(password&&confirm&&(!password.value||password.value.length<8)){
      const generated=randomTempPassword();
      nativeSetValue(password,generated);nativeSetValue(confirm,generated);
    }else if(password&&confirm&&!confirm.value){
      nativeSetValue(confirm,password.value);
    }
  }
}

function installSubmitGuard(){
  document.addEventListener("submit",ensureSubmitValues,true);
}

function installObserver(){
  if(observer) return;
  observer=new MutationObserver(()=>{
    decorateErrorNotices();
    repairOwnerButtons();
    enhanceOwnerForms();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  decorateErrorNotices();
  repairOwnerButtons();
  enhanceOwnerForms();
}

function start(){
  installStyle();
  installRuntimeHandlers();
  installSubmitGuard();
  installObserver();
}

start();
