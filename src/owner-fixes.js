import { supabase } from "./lib/supabase.js";

const STYLE = `
/* Gym Owner portal hardening layer */
.admin-app .modal{width:min(620px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:hidden;display:flex;flex-direction:column}
.admin-app .modal-head{position:sticky;top:0;z-index:2;flex:none;background:#fff}
.admin-app .modal-body{overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.admin-app .form button,.admin-app .form .primary,.admin-app .form .secondary{min-height:46px}
.admin-app .table{overflow-x:auto;-webkit-overflow-scrolling:touch}
.admin-app .table .tr{min-width:680px}
.admin-app .notice.notice-error{position:relative;overflow-wrap:anywhere;padding-right:44px}
.admin-app .notice.notice-error::after{content:attr(data-error-code);display:block;margin-top:6px;color:#8f1639;font-size:9px;font-weight:800;letter-spacing:.7px;opacity:.8}
.gm-owner-runtime-error{position:fixed;left:12px;right:12px;bottom:14px;z-index:2147483000;padding:13px 15px;border:1px solid #e7a6b1;border-radius:14px;background:#fff1f3;color:#8f1639;box-shadow:0 16px 40px rgba(16,24,40,.22);font:700 12px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}
.gm-owner-runtime-error b{display:block;margin-bottom:3px;font-size:13px}
.gm-owner-runtime-error small{display:block;margin-top:5px;font-weight:600;opacity:.85}
@media(max-width:700px){
 .admin-app .modal{width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:18px}
 .admin-app .modal-body{padding-bottom:max(18px,env(safe-area-inset-bottom))}
 .admin-app .notice{overflow-wrap:anywhere}
 .admin-app .section-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;width:100%}
 .admin-app .section-actions>*{min-width:0}
}
`;

let runtimeErrorVisible=false;
let observer=null;

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

function isOwnerPortal(){
  return !!document.querySelector(".admin-app");
}

function decorateErrorNotices(){
  if(!isOwnerPortal()) return;
  document.querySelectorAll(".admin-app .notice.notice-error").forEach(notice=>{
    if(notice.dataset.errorCode) return;
    const code=makeErrorCode();
    notice.dataset.errorCode=code;
    const message=String(notice.textContent||"").replace(/×/g," ").trim();
    reportError(code,"owner_ui_notice",message);
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
  box.innerHTML=`<b>Something went wrong</b><span>${String(message||"Unexpected error").replace(/[<>]/g,"")}</span><small>Support code: ${code}</small>`;
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

function installObserver(){
  if(observer) return;
  observer=new MutationObserver(()=>{
    decorateErrorNotices();
    repairOwnerButtons();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  decorateErrorNotices();
  repairOwnerButtons();
}

function start(){
  installStyle();
  installRuntimeHandlers();
  installObserver();
}

start();
