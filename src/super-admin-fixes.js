import { supabase } from "./lib/supabase.js";

const STYLE = `
.gm-sa-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(9,14,24,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-sizing:border-box}
.gm-sa-dialog{width:min(520px,100%);max-height:92dvh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 28px 80px rgba(7,12,22,.5);color:#172033;font-family:inherit}
.gm-sa-head{padding:21px 22px;background:linear-gradient(145deg,#0a1020,#1b2537);color:#fff;border-bottom:3px solid #d7dce2}
.gm-sa-kicker{margin:0 0 7px;font-size:10px;font-weight:800;letter-spacing:2px;color:#aeb8c5}
.gm-sa-title{margin:0;font-size:23px;line-height:1.15;font-weight:800;color:#fff}
.gm-sa-body{padding:22px}
.gm-sa-gym{padding:14px 16px;margin:0 0 15px;background:#f7f8fa;border:1px solid #dfe3e8;border-radius:14px;font-size:17px;font-weight:800}
.gm-sa-copy{margin:0 0 18px;color:#667085;font-size:14px;line-height:1.6}
.gm-sa-error{display:none;margin:0 0 16px;padding:12px 14px;border:1px solid #e7a6b1;border-radius:12px;background:#fff1f3;color:#8f1639;font-size:13px;line-height:1.5;font-weight:700;white-space:pre-line}
.gm-sa-error.show{display:block}
.gm-sa-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gm-sa-actions button{min-height:50px;padding:0 14px;border-radius:12px;border:1px solid #d3d8df;font:inherit;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;visibility:visible!important;opacity:1!important}
.gm-sa-cancel{background:#f1f3f6;color:#172033}
.gm-sa-confirm.danger{background:#a5164b;color:#fff;border-color:#a5164b}
.gm-sa-confirm.primary{background:#172033;color:#fff;border-color:#172033}
.gm-sa-confirm:disabled{opacity:.65!important;cursor:wait}
@media(max-width:650px){.gm-sa-dialog{border-radius:20px}.gm-sa-head,.gm-sa-body{padding:20px}.gm-sa-title{font-size:21px}}
`;

let currentGymName = "";
let currentGym = null;
let actionBusy = false;

function installStyle(){
  if(document.getElementById("gm-sa-style")) return;
  const style=document.createElement("style");
  style.id="gm-sa-style";
  style.textContent=STYLE;
  document.head.appendChild(style);
}

function makeErrorCode(prefix="SA"){
  const stamp=Date.now().toString(36).toUpperCase().slice(-6);
  const rand=Math.random().toString(36).slice(2,6).toUpperCase();
  return `GM-${prefix}-${stamp}-${rand}`;
}

async function reportError(code,operation,message,detail=""){
  try{
    await supabase?.rpc("record_platform_error",{
      p_source:"super_admin",
      p_operation:operation,
      p_message:String(message||"Unexpected error"),
      p_error_code:code,
      p_detail:String(detail||"").slice(0,1800),
      p_path:window.location.pathname
    });
  }catch{}
}

function hideOwnerSuspensionOption(){
  const buttons=[...document.querySelectorAll("button")];
  buttons.forEach(button=>{
    const label=String(button.textContent||"").trim().toLowerCase().replace(/\s+/g," ");
    if(label==="suspend owner account" || label==="suspend gym owner account" || label==="suspend owner access"){
      button.style.display="none";
      button.setAttribute("aria-hidden","true");
      button.setAttribute("tabindex","-1");
      button.disabled=true;
    }
  });
}

function findGymName(){
  const detail=[...document.querySelectorAll(".overlay .modal")].find(m=>m.querySelector(".detail-grid"));
  const title=detail?.querySelector(".modal-head h3")?.textContent?.trim();
  if(title) return title;
  return currentGymName;
}

async function resolveGym(){
  const name=findGymName();
  if(!name) throw new Error("Could not identify the selected gym.");
  if(currentGym?.name===name) return currentGym;
  const {data,error}=await supabase.from("gyms").select("id,name,platform_status").eq("name",name).limit(1).maybeSingle();
  if(error) throw new Error(error.message||"Could not load the selected gym.");
  if(!data) throw new Error("Gym not found.");
  currentGym=data;
  currentGymName=name;
  return data;
}

async function invoke(functionName,body,fallback){
  if(!supabase) throw new Error("Supabase is not configured.");
  const {data,error}=await supabase.functions.invoke(functionName,{body});
  if(error||data?.error) throw new Error(data?.error||error?.message||fallback);
  return data;
}

async function setGymStatus(status){
  const gym=await resolveGym();
  const data=await invoke("super-admin-suspend-gym",{gym_id:gym.id,action:status==="suspended"?"suspend":"activate"},"The gym access change could not be saved.");
  if(data?.platform_status!==status && data?.gym?.platform_status!==status) throw new Error("The server did not confirm the requested gym status change.");
  window.location.reload();
}

function closeExistingNativeModal(){
  document.querySelector(".gm-sa-overlay")?.remove();
}

function showDialog({title,copy,confirmText,danger,onConfirm,operation}){
  closeExistingNativeModal();
  const overlay=document.createElement("div");
  overlay.className="gm-sa-overlay";
  overlay.setAttribute("role","dialog");
  overlay.setAttribute("aria-modal","true");

  const dialog=document.createElement("div");
  dialog.className="gm-sa-dialog";
  const head=document.createElement("div");
  head.className="gm-sa-head";
  const kicker=document.createElement("div");
  kicker.className="gm-sa-kicker";
  kicker.textContent="PLATFORM CONTROL";
  const heading=document.createElement("h2");
  heading.className="gm-sa-title";
  heading.textContent=title;
  head.append(kicker,heading);

  const body=document.createElement("div");
  body.className="gm-sa-body";
  const gym=document.createElement("div");
  gym.className="gm-sa-gym";
  gym.textContent=currentGymName||"Selected gym";
  const text=document.createElement("p");
  text.className="gm-sa-copy";
  text.textContent=copy;
  const error=document.createElement("div");
  error.className="gm-sa-error";
  const actions=document.createElement("div");
  actions.className="gm-sa-actions";
  const cancel=document.createElement("button");
  cancel.type="button";
  cancel.className="gm-sa-cancel";
  cancel.textContent="Cancel";
  const confirm=document.createElement("button");
  confirm.type="button";
  confirm.className=`gm-sa-confirm ${danger?"danger":"primary"}`;
  confirm.textContent=confirmText;
  actions.append(cancel,confirm);
  body.append(gym,text,error,actions);
  dialog.append(head,body);
  overlay.append(dialog);
  document.body.appendChild(overlay);

  const close=()=>overlay.remove();
  cancel.addEventListener("click",close);
  overlay.addEventListener("click",event=>{if(event.target===overlay)close()});
  confirm.addEventListener("click",async()=>{
    if(actionBusy)return;
    actionBusy=true;
    confirm.disabled=true;
    confirm.textContent="Working…";
    error.classList.remove("show");
    try{
      await onConfirm();
    }catch(err){
      const code=makeErrorCode();
      const message=err?.message||"The action could not be completed.";
      error.textContent=`Error code: ${code}\n${message}\n\nContact Atelier OG and provide this code.`;
      error.classList.add("show");
      confirm.disabled=false;
      confirm.textContent=confirmText;
      actionBusy=false;
      reportError(code,operation||"platform_control",message,err?.stack||"");
    }
  });
}

function actionFor(text){
  const t=String(text||"").trim().toLowerCase().replace(/\s+/g," ");
  if(t==="suspend gym") return {title:"Suspend gym?",copy:"This will immediately block the Gym Owner, trainers, and members from accessing this gym. Existing gym data will be preserved and can be restored by the Super Admin.",confirmText:"Suspend Gym",danger:true,operation:"suspend_gym",run:()=>setGymStatus("suspended")};
  if(t==="activate gym") return {title:"Restore gym access?",copy:"This will restore access to this gym for its Gym Owner, trainers, and members. Existing gym data will remain unchanged.",confirmText:"Restore Gym",danger:false,operation:"activate_gym",run:()=>setGymStatus("active")};
  return null;
}

function installClickHandler(){
  const observer=new MutationObserver(hideOwnerSuspensionOption);
  observer.observe(document.body,{childList:true,subtree:true});
  hideOwnerSuspensionOption();

  document.addEventListener("click",event=>{
    const button=event.target?.closest?.("button");
    if(!button)return;
    const label=String(button.textContent||"").trim().toLowerCase().replace(/\s+/g," ");
    if(label==="suspend owner account" || label==="suspend gym owner account" || label==="suspend owner access"){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      hideOwnerSuspensionOption();
      return;
    }
    const row=button.closest?.(".gym-name-row");
    if(row){
      currentGymName=row.querySelector("span")?.textContent?.trim()||"";
      currentGym=null;
      return;
    }
    const action=actionFor(button.textContent);
    if(!action)return;
    const root=document.querySelector(".super-admin-platform");
    if(!root?.contains(button))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    currentGymName=findGymName()||currentGymName;
    showDialog({...action,onConfirm:action.run});
  },true);
}

function start(){installStyle();installClickHandler();}
start();
