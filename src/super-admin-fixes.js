import { supabase } from './lib/supabase.js';

const STYLE = `
.gymos-fix-overlay{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483647!important;background:rgba(9,14,24,.72)!important;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex!important;align-items:center!important;justify-content:center!important;padding:18px!important;box-sizing:border-box!important;isolation:isolate!important;pointer-events:auto!important}
.gymos-fix-dialog{position:relative!important;z-index:2147483647!important;width:min(520px,100%)!important;max-height:min(90dvh,760px)!important;overflow:auto!important;background:#f7f8fa!important;border:1px solid #d6dbe2!important;border-radius:24px!important;box-shadow:0 28px 80px rgba(7,12,22,.48)!important;color:#172033!important;font-family:inherit!important}
.gymos-fix-head{background:linear-gradient(145deg,#0a1020,#1b2537)!important;color:#f7f8fa!important;padding:22px 24px!important;border-bottom:3px solid #d7dce2!important}
.gymos-fix-kicker{font-size:10px!important;font-weight:800!important;letter-spacing:2px!important;color:#aeb8c5!important;text-transform:uppercase!important;margin-bottom:7px!important}.gymos-fix-title{font-size:25px!important;font-weight:800!important;line-height:1.1!important;margin:0!important;color:#f7f8fa!important}.gymos-fix-body{padding:24px!important}.gymos-fix-gym{background:#fff!important;border:1px solid #dfe3e8!important;border-radius:15px!important;padding:15px 16px!important;font-size:16px!important;font-weight:800!important;margin-bottom:15px!important;color:#172033!important}.gymos-fix-copy{font-size:14px!important;line-height:1.6!important;color:#667085!important;margin:0 0 20px!important}.gymos-fix-error{display:none!important;background:#fff1f3!important;border:1px solid #e7a6b1!important;color:#8f1639!important;border-radius:12px!important;padding:12px 14px!important;font-size:13px!important;line-height:1.5!important;font-weight:700!important;margin:-4px 0 16px!important;white-space:pre-line!important}.gymos-fix-error.is-visible{display:block!important}.gymos-fix-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}.gymos-fix-actions button{min-height:48px!important;border-radius:12px!important;border:1px solid #d3d8df!important;font:inherit!important;font-weight:800!important;cursor:pointer!important;opacity:1!important;text-shadow:none!important;box-shadow:none!important;appearance:none!important;-webkit-appearance:none!important;display:flex!important;align-items:center!important;justify-content:center!important;visibility:visible!important}.gymos-fix-actions button:disabled{opacity:.65!important;cursor:wait!important}.gymos-fix-cancel{background:#fff!important;color:#172033!important;border-color:#d3d8df!important}.gymos-fix-danger{background:#a5164b!important;color:#fff!important;border-color:#a5164b!important}.gymos-fix-primary{background:#172033!important;color:#fff!important;border-color:#172033!important}
@media(max-width:650px){.gymos-fix-overlay{padding:12px!important}.gymos-fix-dialog{border-radius:20px!important;max-height:92dvh!important}.gymos-fix-head{padding:20px!important}.gymos-fix-body{padding:20px!important}.gymos-fix-title{font-size:22px!important}}
`;

function injectStyle(){if(document.getElementById('gymos-super-admin-fix-style'))return;const s=document.createElement('style');s.id='gymos-super-admin-fix-style';s.textContent=STYLE;document.head.appendChild(s)}
let currentGymName='';let currentGym=null;let busy=false;

function makeErrorCode(){const stamp=Date.now().toString(36).toUpperCase().slice(-6);const rand=Math.random().toString(36).slice(2,6).toUpperCase();return `GM-SA-${stamp}-${rand}`}
async function reportFixError(code,operation,message,detail=''){try{await supabase?.rpc('record_platform_error',{p_source:'super_admin',p_operation:operation,p_message:String(message||'Unexpected error'),p_error_code:code,p_detail:String(detail||'').slice(0,1800),p_path:window.location.pathname})}catch{}}

async function resolveGym(){if(!supabase||!currentGymName)return null;if(currentGym?.name===currentGymName)return currentGym;const {data,error}=await supabase.from('gyms').select('id,name,platform_status').eq('name',currentGymName).limit(1).maybeSingle();if(error||!data)return null;currentGym=data;return data}

function showFixDialog({title,gym,copy,danger=false,onConfirm,confirmText,operation}){
 document.querySelector('.gymos-fix-overlay')?.remove();
 const overlay=document.createElement('div');overlay.className='gymos-fix-overlay';overlay.setAttribute('role','presentation');
 overlay.innerHTML=`<div class="gymos-fix-dialog" role="dialog" aria-modal="true"><div class="gymos-fix-head"><div class="gymos-fix-kicker">PLATFORM CONTROL</div><h2 class="gymos-fix-title"></h2></div><div class="gymos-fix-body"><div class="gymos-fix-gym"></div><p class="gymos-fix-copy"></p><div class="gymos-fix-error" role="alert"></div><div class="gymos-fix-actions"><button type="button" class="gymos-fix-cancel">Cancel</button><button type="button" class="gymos-fix-confirm"></button></div></div></div>`;
 const titleEl=overlay.querySelector('.gymos-fix-title'),gymEl=overlay.querySelector('.gymos-fix-gym'),copyEl=overlay.querySelector('.gymos-fix-copy'),confirm=overlay.querySelector('.gymos-fix-confirm'),cancel=overlay.querySelector('.gymos-fix-cancel'),errorEl=overlay.querySelector('.gymos-fix-error');
 titleEl.textContent=title;gymEl.textContent=gym?.name||currentGymName||'Gym';copyEl.textContent=copy;confirm.textContent=confirmText||'Confirm';
 Object.assign(confirm.style,{backgroundColor:danger?'#a5164b':'#172033',color:'#ffffff',borderColor:danger?'#a5164b':'#172033',fontWeight:'800',opacity:'1',visibility:'visible',display:'flex'});
 Object.assign(cancel.style,{backgroundColor:'#ffffff',color:'#172033',borderColor:'#d3d8df',fontWeight:'800',opacity:'1',visibility:'visible',display:'flex'});
 cancel.onclick=()=>overlay.remove();
 overlay.addEventListener('mousedown',e=>{if(e.target===overlay)overlay.remove()});
 overlay.querySelector('.gymos-fix-confirm').onclick=async()=>{
  if(busy)return;busy=true;errorEl.classList.remove('is-visible');errorEl.textContent='';confirm.disabled=true;confirm.textContent='Working…';
  try{await onConfirm();overlay.remove()}
  catch(err){const code=makeErrorCode();const message=err?.message||'The action could not be completed.';errorEl.textContent=`Error code: ${code}\n${message}\n\nContact Atelier OG and provide this code.`;errorEl.classList.add('is-visible');confirm.disabled=false;confirm.textContent=confirmText||'Confirm';busy=false;reportFixError(code,operation||'platform_control',message,err?.stack||'')}
 };
 document.body.appendChild(overlay);
}

async function updateGymStatus(status){
 const gym=await resolveGym();if(!gym)throw new Error('Could not identify this gym.');
 const {data,error}=await supabase.functions.invoke('super-admin-suspend-gym',{body:{gym_id:gym.id,action:status==='suspended'?'suspend':'activate'}});
 if(error||data?.error)throw new Error(data?.error||error?.message||'The gym access change could not be saved.');
 currentGym={...gym,...(data?.gym||{}),platform_status:status};window.location.reload();
}

async function updateOwnerStatus(status){
 const gym=await resolveGym();if(!gym)throw new Error('Could not identify this gym.');
 const {data,error}=await supabase.functions.invoke('super-admin-update-owner-status',{body:{gym_id:gym.id,owner_status:status}});
 if(error||data?.error)throw new Error(data?.error||error?.message||'The Gym Owner access change could not be saved.');
 window.location.reload();
}

async function deleteGym(){const gym=await resolveGym();if(!gym)throw new Error('Could not identify this gym.');const {data,error}=await supabase.functions.invoke('super-admin-delete-gym',{body:{gym_id:gym.id}});if(error||data?.error)throw new Error(data?.error||error?.message||'The gym could not be deleted.');currentGym=null;currentGymName='';window.location.reload()}

function handleAction(text){
 const t=text.trim().toLowerCase().replace(/\s+/g,' ');
 if(t==='suspend gym'){showFixDialog({title:'Suspend gym?',gym:currentGym,copy:'This will immediately block the Gym Owner, trainers, and members from accessing this gym. Existing gym data will be preserved and can be restored by the Super Admin.',danger:true,confirmText:'Suspend Gym',operation:'suspend_gym',onConfirm:()=>updateGymStatus('suspended')});return true}
 if(t==='activate gym'){showFixDialog({title:'Restore gym access?',gym:currentGym,copy:'This will restore access to this gym for its Gym Owner, trainers, and members. Existing gym data will remain unchanged.',confirmText:'Restore Gym',operation:'activate_gym',onConfirm:()=>updateGymStatus('active')});return true}
 if(t==='suspend owner access'||t==='suspend gym owner access?'||t==='suspend gym owner access'){showFixDialog({title:'Disable Gym Owner account?',gym:currentGym,copy:'This will block only the Gym Owner from signing in. The gym remains active for members and trainers.',danger:true,confirmText:'Disable Owner',operation:'suspend_owner_access',onConfirm:()=>updateOwnerStatus('suspended')});return true}
 if(t==='activate owner access'||t==='activate gym owner access'||t==='activate gym owner access?'){showFixDialog({title:'Restore Gym Owner account?',gym:currentGym,copy:'This will restore sign-in access for the Gym Owner. The gym status will remain unchanged.',confirmText:'Restore Owner',operation:'activate_owner_access',onConfirm:()=>updateOwnerStatus('active')});return true}
 if(t==='delete gym & all data'){showFixDialog({title:'Delete gym permanently?',gym:currentGym,copy:'This permanently removes the gym, its owner account and all related gym data. This action cannot be undone.',danger:true,confirmText:'Delete Gym & All Data',operation:'delete_gym',onConfirm:deleteGym});return true}
 return false;
}

function syncCurrentGymFromDom(){const detail=[...document.querySelectorAll('.overlay .modal')].find(m=>m.querySelector('.detail-grid'));if(!detail)return;const title=detail.querySelector('.modal-head h3')?.textContent?.trim();if(title&&title!==currentGymName){currentGymName=title;currentGym=null}}
function removeInjectedDuplicateDeletes(){document.querySelectorAll('.gymos-delete-action').forEach(b=>b.remove())}

function watchDom(){
 const root=document.querySelector('.super-admin-platform');if(!root)return;
 const observer=new MutationObserver(()=>{syncCurrentGymFromDom();removeInjectedDuplicateDeletes()});observer.observe(root,{childList:true,subtree:true});
 document.addEventListener('click',e=>{const btn=e.target.closest?.('button');if(!btn)return;const row=btn.closest('.gym-name-row');if(row){currentGymName=row.querySelector('span')?.textContent?.trim()||'';currentGym=null;return}if(!root.contains(btn))return;const text=(btn.textContent||'').trim();if(handleAction(text)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}},true);
 syncCurrentGymFromDom();removeInjectedDuplicateDeletes();
}

function autoCloseCredentialAfterSuccessfulCreation(){const observer=new MutationObserver(()=>{const modals=[...document.querySelectorAll('.overlay .modal')];const credential=modals.find(m=>m.querySelector('.credential-box'));const notice=document.querySelector('.platform-notice .notice');if(credential&&notice&&!notice.classList.contains('notice-error')&&/Gym created/i.test(notice.textContent||''))credential.querySelector('.modal-head button')?.click()});observer.observe(document.body,{childList:true,subtree:true})}

function start(){injectStyle();const timer=setInterval(()=>{if(document.querySelector('.super-admin-platform')){clearInterval(timer);watchDom();autoCloseCredentialAfterSuccessfulCreation()}},100)}
start();
