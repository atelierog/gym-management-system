import { supabase } from './lib/supabase.js';

const STYLE = `
.gymos-fix-overlay{position:fixed;inset:0;z-index:100000;background:rgba(9,14,24,.66);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px}
.gymos-fix-dialog{width:min(520px,100%);background:#f7f8fa;border:1px solid #d6dbe2;border-radius:24px;box-shadow:0 28px 80px rgba(7,12,22,.38);overflow:hidden;color:#172033}
.gymos-fix-head{background:linear-gradient(145deg,#0a1020,#1b2537);color:#f7f8fa;padding:22px 24px;border-bottom:3px solid #d7dce2}
.gymos-fix-kicker{font-size:10px;font-weight:800;letter-spacing:2px;color:#aeb8c5;text-transform:uppercase;margin-bottom:7px}
.gymos-fix-title{font-size:25px;font-weight:800;line-height:1.1;margin:0}
.gymos-fix-body{padding:24px}
.gymos-fix-gym{background:#fff;border:1px solid #dfe3e8;border-radius:15px;padding:15px 16px;font-size:16px;font-weight:800;margin-bottom:15px}
.gymos-fix-copy{font-size:14px;line-height:1.6;color:#667085;margin:0 0 20px}
.gymos-fix-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gymos-fix-actions button{min-height:48px;border-radius:12px;border:1px solid #d3d8df;font:inherit;font-weight:800;cursor:pointer}
.gymos-fix-cancel{background:#fff;color:#172033}
.gymos-fix-danger{background:#a5164b;color:#fff;border-color:#a5164b!important}
.gymos-fix-primary{background:#172033;color:#fff;border-color:#172033!important}
.gymos-delete-action{width:100%;margin-top:10px!important;min-height:46px!important}
@media(max-width:650px){.gymos-fix-overlay{padding:12px}.gymos-fix-dialog{border-radius:20px}.gymos-fix-head{padding:20px}.gymos-fix-body{padding:20px}.gymos-fix-title{font-size:22px}}
`;

function injectStyle(){if(document.getElementById('gymos-super-admin-fix-style'))return;const s=document.createElement('style');s.id='gymos-super-admin-fix-style';s.textContent=STYLE;document.head.appendChild(s)}
let currentGymName='';let currentGym=null;let busy=false;

async function resolveGym(){
  if(!supabase||!currentGymName)return null;
  if(currentGym?.name===currentGymName)return currentGym;
  const {data,error}=await supabase.from('gyms').select('id,name,platform_status').eq('name',currentGymName).limit(1).maybeSingle();
  if(error||!data)return null;currentGym=data;return data;
}

function showFixDialog({title,gym,copy,danger=false,onConfirm,confirmText}){
  document.querySelector('.gymos-fix-overlay')?.remove();
  const overlay=document.createElement('div');overlay.className='gymos-fix-overlay';
  overlay.innerHTML=`<div class="gymos-fix-dialog" role="dialog" aria-modal="true"><div class="gymos-fix-head"><div class="gymos-fix-kicker">PLATFORM CONTROL</div><h2 class="gymos-fix-title">${title}</h2></div><div class="gymos-fix-body"><div class="gymos-fix-gym"></div><p class="gymos-fix-copy"></p><div class="gymos-fix-actions"><button class="gymos-fix-cancel">Cancel</button><button class="${danger?'gymos-fix-danger':'gymos-fix-primary'} gymos-fix-confirm"></button></div></div></div>`;
  overlay.querySelector('.gymos-fix-gym').textContent=gym?.name||currentGymName||'Gym';
  overlay.querySelector('.gymos-fix-copy').textContent=copy;
  overlay.querySelector('.gymos-fix-confirm').textContent=confirmText||'Confirm';
  overlay.querySelector('.gymos-fix-cancel').onclick=()=>overlay.remove();
  overlay.addEventListener('mousedown',e=>{if(e.target===overlay)overlay.remove()});
  overlay.querySelector('.gymos-fix-confirm').onclick=async()=>{if(busy)return;busy=true;const b=overlay.querySelector('.gymos-fix-confirm');b.disabled=true;b.textContent='Working…';try{await onConfirm();overlay.remove()}catch(err){alert(err?.message||'The action could not be completed.');b.disabled=false;b.textContent=confirmText||'Confirm'}finally{busy=false}};
  document.body.appendChild(overlay);
}

async function updateGymStatus(status){
  const gym=await resolveGym();if(!gym)throw new Error('Could not identify this gym.');
  const {data,error}=await supabase.functions.invoke('super-admin-update-gym-details',{body:{gym_id:gym.id,gym_status:status,owner_status:'active'}});
  if(error||data?.error)throw new Error(data?.error||error?.message||'The platform access change could not be saved.');
  currentGym={...gym,...(data?.gym||{}),platform_status:status};window.location.reload();
}

async function deleteGym(){
  const gym=await resolveGym();if(!gym)throw new Error('Could not identify this gym.');
  const {data,error}=await supabase.functions.invoke('super-admin-delete-gym',{body:{gym_id:gym.id}});
  if(error||data?.error)throw new Error(data?.error||error?.message||'The gym could not be deleted.');
  currentGym=null;currentGymName='';window.location.reload();
}

function handleAction(text){
  const t=text.trim().toLowerCase();
  if(t==='suspend gym'){showFixDialog({title:'Suspend gym?',gym:currentGym,copy:'This will immediately block the Gym Owner from accessing GymOS. Existing gym data will be preserved and can be restored later.',danger:true,confirmText:'Suspend Gym',onConfirm:()=>updateGymStatus('suspended')});return true}
  if(t==='activate gym'){showFixDialog({title:'Activate gym?',gym:currentGym,copy:'This will restore GymOS access for the Gym Owner. Existing gym data will remain unchanged.',confirmText:'Activate Gym',onConfirm:()=>updateGymStatus('active')});return true}
  if(t==='delete gym & all data'){showFixDialog({title:'Delete gym permanently?',gym:currentGym,copy:'This permanently removes the gym, owner account and all related gym data. This action cannot be undone.',danger:true,confirmText:'Delete Gym & All Data',onConfirm:deleteGym});return true}
  return false;
}

function addDeleteButton(){
  const detail=[...document.querySelectorAll('.overlay .modal')].find(m=>m.querySelector('.detail-grid'));if(!detail||detail.querySelector('.gymos-delete-action'))return;
  const actions=detail.querySelector('.detail-actions');if(!actions)return;
  const b=document.createElement('button');b.type='button';b.className='danger-button gymos-delete-action';b.textContent='Delete Gym & All Data';actions.appendChild(b);
}

function watchDom(){
  const root=document.querySelector('.super-admin-platform');if(!root)return;
  const observer=new MutationObserver(()=>{addDeleteButton();const detail=[...document.querySelectorAll('.overlay .modal')].find(m=>m.querySelector('.detail-grid'));if(detail){const title=detail.querySelector('.modal-head h3')?.textContent?.trim();if(title&&title!==currentGymName){currentGymName=title;currentGym=null}}});
  observer.observe(root,{childList:true,subtree:true});
  document.addEventListener('click',e=>{const btn=e.target.closest?.('button');if(!btn)return;const row=btn.closest('.gym-name-row');if(row){currentGymName=row.querySelector('span')?.textContent?.trim()||'';currentGym=null;return}if(btn.classList.contains('gymos-delete-action')){e.preventDefault();e.stopImmediatePropagation();handleAction('delete gym & all data');return}if(root.contains(btn)&&handleAction(btn.textContent||'')){e.preventDefault();e.stopImmediatePropagation()}},true);
}

function autoCloseCredentialAfterSuccessfulCreation(){
  const observer=new MutationObserver(()=>{const modals=[...document.querySelectorAll('.overlay .modal')];const credential=modals.find(m=>m.querySelector('.credential-box'));const notice=document.querySelector('.platform-notice .notice');if(credential&&notice&&!notice.classList.contains('notice-error')&&/Gym created/i.test(notice.textContent||'')){credential.querySelector('.modal-head button')?.click()}});observer.observe(document.body,{childList:true,subtree:true});
}

function start(){injectStyle();const timer=setInterval(()=>{if(document.querySelector('.super-admin-platform')){clearInterval(timer);watchDom();autoCloseCredentialAfterSuccessfulCreation()}},100)}
start();
