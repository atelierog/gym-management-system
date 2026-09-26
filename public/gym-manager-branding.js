/* Gym Manager brand normalization + Super Admin action hotfixes. */
(function(){
  const replacements=[
    [/GYMOS Platform/g,'Gym Manager'],[/GymOS Platform/g,'Gym Manager'],[/GYMOS PLATFORM/g,'GYM MANAGER'],
    [/GymOS/g,'Gym Manager'],[/GYMOS/g,'Gym Manager'],[/OWNER ACCESS/g,'OWNER ACCOUNT'],
    [/Owner Access/g,'Owner Account'],[/Owner access/g,'Owner account']
  ];
  // Correct production Supabase project ref. The previous value had a typo and caused
  // direct browser requests from this hotfix to fail with the generic "Failed to fetch".
  const PROJECT_URL='https://kwzdxqhzhnmrjfyhgzxa.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_57Izo4d8N0fAYzt6jYA_EQ_TkoDHPty';

  function normalize(value){if(typeof value!=='string')return value;let out=value;for(const[p,r]of replacements)out=out.replace(p,r);return out}
  function normalizeText(node){
    if(!node)return;
    if(node.nodeType===Node.TEXT_NODE){const next=normalize(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;return}
    if(node.nodeType!==Node.ELEMENT_NODE||node.matches('script,style,noscript'))return;
    for(const child of Array.from(node.childNodes))normalizeText(child);
    for(const attr of ['aria-label','title','alt'])if(node.hasAttribute(attr))node.setAttribute(attr,normalize(node.getAttribute(attr)));
  }
  function sessionToken(){
    try{for(const key of Object.keys(sessionStorage)){if(!key.startsWith('sb-'))continue;const raw=sessionStorage.getItem(key);if(!raw)continue;const value=JSON.parse(raw);if(value?.access_token)return value.access_token}}catch{}
    return '';
  }
  async function edge(name,body){
    const token=sessionToken();
    if(!token)throw new Error('Your Super Admin session has expired. Please sign in again.');
    const response=await fetch(PROJECT_URL+'/functions/v1/'+name,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!response.ok)throw new Error(data?.error||data?.message||text||'Request failed');
    return data;
  }
  function gymIdentifiers(modal){
    const text=(modal?.textContent||'').replace(/\s+/g,' ').trim();
    const loginId=text.match(/LOGIN\s*ID\s*[:\-]?\s*([A-Z0-9_-]{3,})/i)?.[1]||'';
    const ownerEmail=text.match(/OWNER\s*EMAIL\s*[:\-]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1]||'';
    const gymName=(modal?.querySelector('.modal-head h3')?.textContent||'').trim();
    return {loginId,ownerEmail,gymName};
  }
  function closeModal(modal){modal?.querySelector('.modal-head button')?.click()}
  function showToast(message){
    document.querySelectorAll('.gm-toast').forEach(x=>x.remove());
    const t=document.createElement('div');t.className='gm-toast';t.textContent=message;document.body.appendChild(t);setTimeout(()=>t.remove(),3200);
  }
  function styles(){
    if(document.getElementById('gm-platinum-hotfix'))return;
    const s=document.createElement('style');s.id='gm-platinum-hotfix';s.textContent=`
      .gm-action-overlay{position:fixed!important;inset:0!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:18px!important;background:rgba(6,10,18,.62)!important;backdrop-filter:blur(7px)!important}
      .gm-action-card{width:min(520px,100%);border:1px solid #d9dee7;border-radius:24px;background:#fff;box-shadow:0 28px 90px rgba(8,14,26,.35);overflow:hidden;color:#172033;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .gm-action-head{padding:24px;background:linear-gradient(145deg,#0a1020,#182236);color:#fff;border-bottom:3px solid #d6dbe3}
      .gm-action-kicker{font-size:11px;letter-spacing:2px;font-weight:800;color:#cbd2dc;text-transform:uppercase}.gm-action-title{margin:7px 0 0;font-size:24px;line-height:1.15;font-weight:800}
      .gm-action-body{padding:24px}.gm-action-gym{margin:0 0 14px;padding:15px 16px;border:1px solid #e1e5eb;border-radius:14px;background:#f8f9fb;font-weight:800;font-size:17px}.gm-action-body p{margin:0;color:#697386;line-height:1.55;font-size:15px}.gm-action-note{margin-top:14px!important;font-size:12px!important;color:#8a94a5!important}
      .gm-action-actions{display:flex;gap:10px;margin-top:22px}.gm-action-actions button{flex:1;min-height:48px;border-radius:12px;border:1px solid #d7dce4;font-weight:800;font-size:15px;cursor:pointer}.gm-action-cancel{background:#f3f5f8;color:#172033}.gm-action-danger{background:#8f173f;color:#fff;border-color:#8f173f!important}.gm-action-primary{background:#10192b;color:#fff;border-color:#10192b!important}.gm-action-actions button:disabled{opacity:.55;cursor:wait}
      .gm-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;background:#10192b;color:#fff;border:1px solid #d6dbe3;border-radius:14px;padding:13px 18px;box-shadow:0 14px 40px rgba(8,14,26,.28);font-weight:750;font-size:14px;max-width:calc(100vw - 32px);text-align:center}.danger-button.wide{border-radius:12px!important;border:1px solid #d9b5c2!important;background:#fff4f7!important;color:#8f173f!important;font-weight:800!important;min-height:46px!important}
    `;document.head.appendChild(s);
  }
  function hideOwnerSuspension(){
    document.querySelectorAll('button').forEach(button=>{const label=(button.textContent||'').trim().toLowerCase().replace(/\s+/g,' ');if(['suspend owner account','suspend gym owner account','suspend owner access'].includes(label)){button.style.display='none';button.disabled=true;button.setAttribute('aria-hidden','true');button.setAttribute('tabindex','-1')}});
  }
  function dialog({title,gymName,description,confirmLabel,danger=true,run}){
    document.querySelectorAll('.gm-action-overlay').forEach(x=>x.remove());
    const overlay=document.createElement('div');overlay.className='gm-action-overlay';
    const card=document.createElement('section');card.className='gm-action-card';
    card.innerHTML='<div class="gm-action-head"><div class="gm-action-kicker">PLATFORM CONTROL</div><div class="gm-action-title"></div></div><div class="gm-action-body"><div class="gm-action-gym"></div><p class="gm-action-copy"></p><p class="gm-action-note">This action is applied at the platform level and takes effect for the Gym Owner account.</p><div class="gm-action-actions"><button class="gm-action-cancel" type="button">Cancel</button><button class="gm-action-confirm" type="button"></button></div></div>';
    card.querySelector('.gm-action-title').textContent=title;card.querySelector('.gm-action-gym').textContent=gymName||'Selected gym';card.querySelector('.gm-action-copy').textContent=description;
    const cancel=card.querySelector('.gm-action-cancel'),confirm=card.querySelector('.gm-action-confirm');confirm.textContent=confirmLabel;confirm.className='gm-action-confirm '+(danger?'gm-action-danger':'gm-action-primary');
    overlay.appendChild(card);document.body.appendChild(overlay);
    const close=()=>overlay.remove();cancel.onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};
    confirm.onclick=async()=>{confirm.disabled=true;cancel.disabled=true;confirm.textContent='Working…';try{await run();close()}catch(error){confirm.disabled=false;cancel.disabled=false;confirm.textContent=confirmLabel;showToast(error?.message||'Action could not be completed.')}};
  }
  function interceptActions(){
    if(document.documentElement.dataset.gmActionCapture==='1')return;document.documentElement.dataset.gmActionCapture='1';
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('button');if(!button)return;
      const label=(button.textContent||'').replace(/\s+/g,' ').trim();
      if(['Suspend Owner Account','Suspend Gym Owner Account','Suspend Owner Access'].includes(label)){event.preventDefault();event.stopImmediatePropagation();hideOwnerSuspension();return}
      if(!['Suspend Gym','Activate Gym','Delete Gym & All Data'].includes(label))return;
      const modal=button.closest('.modal');if(!modal)return;
      event.preventDefault();event.stopImmediatePropagation();
      const ids=gymIdentifiers(modal);if(!ids.loginId&&!ids.ownerEmail&&!ids.gymName){showToast('Could not identify this gym. Close and reopen the gym profile, then try again.');return}
      if(label==='Delete Gym & All Data'){
        dialog({title:'Delete gym permanently?',gymName:ids.gymName,description:'This permanently removes the gym, owner account, members, trainers, memberships, payments, attendance and related gym data. This cannot be undone.',confirmLabel:'Delete Gym & All Data',danger:true,run:async()=>{const result=await edge('super-admin-delete-gym',ids);if(!result?.ok)throw new Error(result?.error||'Gym could not be deleted.');showToast('Gym deleted successfully.');setTimeout(()=>location.reload(),700)}});
      }else{
        const suspended=label==='Suspend Gym';
        dialog({title:suspended?'Suspend gym?':'Restore gym access?',gymName:ids.gymName,description:suspended?'This will immediately block the Gym Owner, trainers, and members from accessing this gym. Existing gym data will be preserved and can be restored by the Super Admin.':'This will restore access to this gym for its Gym Owner, trainers, and members. Existing gym data will remain unchanged.',confirmLabel:suspended?'Suspend Gym':'Restore Gym',danger:suspended,run:async()=>{const result=await edge('super-admin-suspend-gym',{...ids,action:suspended?'suspend':'activate'});if(!result?.ok)throw new Error(result?.error||'The gym access change could not be saved.');showToast(suspended?'Gym suspended successfully.':'Gym access restored successfully.');setTimeout(()=>location.reload(),700)}});
      }
    },true);
  }
  function hideCredentialModal(){document.querySelectorAll('.modal').forEach(modal=>{const title=(modal.querySelector('.modal-head h3')?.textContent||'').trim().toLowerCase();if(!title.includes('credentials')||modal.dataset.gmCredentialHidden==='1')return;const body=modal.querySelector('.modal-body');if(!body)return;modal.dataset.gmCredentialHidden='1';body.innerHTML='<div style="padding:15px 16px;border-radius:14px;background:#f7f8fa;border:1px solid #dfe3e8;color:#273247;font-size:14px;line-height:1.55"><b>Gym created successfully.</b><br>The Gym Owner welcome email has been sent automatically.</div><button type="button" class="secondary wide" data-gm-close>Done</button>';body.querySelector('[data-gm-close]')?.addEventListener('click',()=>closeModal(modal))})}
  function addDeleteAction(){document.querySelectorAll('.modal').forEach(modal=>{if(modal.dataset.gmDeleteAdded==='1')return;const text=modal.textContent||'',title=(modal.querySelector('.modal-head h3')?.textContent||'').trim();if(!title||!/Gym status/i.test(text)||!/(Owner Access|Owner Account)/i.test(text))return;const body=modal.querySelector('.modal-body');if(!body)return;const button=document.createElement('button');button.type='button';button.className='danger-button wide';button.textContent='Delete Gym & All Data';button.style.marginTop='12px';body.appendChild(button);modal.dataset.gmDeleteAdded='1'})}
  function run(){styles();normalizeText(document.body);if(document.title)document.title=normalize(document.title);hideOwnerSuspension();hideCredentialModal();addDeleteAction();interceptActions()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(m=>{for(const x of m){if(x.type==='characterData')normalizeText(x.target);x.addedNodes.forEach(normalizeText)}hideOwnerSuspension();hideCredentialModal();addDeleteAction()}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
