/* Gym Manager brand normalization + small production hotfixes. */
(function(){
  const replacements = [
    [/GYMOS Platform/g, 'Gym Manager'],
    [/GymOS Platform/g, 'Gym Manager'],
    [/GYMOS PLATFORM/g, 'GYM MANAGER'],
    [/GymOS/g, 'Gym Manager'],
    [/GYMOS/g, 'Gym Manager']
  ];
  const PROJECT_URL='https://kwzdxqhzhnmrjfyhgzxa.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_57Izo4d8N0fAYzt6jYA_EQ_TkoDHPty';

  function normalize(value){
    if(typeof value !== 'string') return value;
    let out=value;
    for(const [pattern,replacement] of replacements) out=out.replace(pattern,replacement);
    return out;
  }
  function normalizeText(node){
    if(node.nodeType===Node.TEXT_NODE){
      const next=normalize(node.nodeValue);
      if(next!==node.nodeValue) node.nodeValue=next;
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE) return;
    if(node.matches('script,style,noscript')) return;
    for(const child of Array.from(node.childNodes)) normalizeText(child);
    for(const attr of ['aria-label','title','alt']){
      if(node.hasAttribute(attr)) node.setAttribute(attr,normalize(node.getAttribute(attr)));
    }
  }

  function sessionToken(){
    try{
      for(const key of Object.keys(sessionStorage)){
        if(!key.startsWith('sb-')) continue;
        const raw=sessionStorage.getItem(key);if(!raw)continue;
        const value=JSON.parse(raw);
        if(value?.access_token) return value.access_token;
      }
    }catch{}
    return '';
  }

  async function rest(path,options={}){
    const token=sessionToken();
    if(!token) throw new Error('Your Super Admin session has expired. Please sign in again.');
    const headers={apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})};
    const response=await fetch(PROJECT_URL+'/rest/v1/'+path,{...options,headers});
    const text=await response.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!response.ok) throw new Error(data?.message||data?.hint||data?.error||text||'Request failed');
    return data;
  }

  async function edge(name,body){
    const token=sessionToken();
    if(!token) throw new Error('Your Super Admin session has expired. Please sign in again.');
    const response=await fetch(PROJECT_URL+'/functions/v1/'+name,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const text=await response.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{}
    if(!response.ok) throw new Error(data?.error||data?.message||text||'Request failed');
    return data;
  }

  function hideCredentialModal(){
    document.querySelectorAll('.modal').forEach(modal=>{
      if(modal.dataset.gmCredentialHidden==='1') return;
      const title=(modal.querySelector('.modal-head h3')?.textContent||'').trim().toLowerCase();
      if(!title.includes('credentials')) return;
      const body=modal.querySelector('.modal-body');if(!body)return;
      modal.dataset.gmCredentialHidden='1';
      body.innerHTML='';
      const wrap=document.createElement('div');wrap.className='credential-box';
      wrap.innerHTML='<h3 style="margin:0 0 10px">Credentials sent securely</h3><p style="margin:0 0 14px;color:#667085">The temporary password is no longer displayed here. It is intended to be delivered to the Gym Owner by email.</p><p style="margin:0 0 18px;color:#667085">If the owner does not receive the email, use <b>Resend Welcome Email</b> from the gym profile.</p><button type="button" class="secondary wide" data-gm-close>Done</button>';
      body.appendChild(wrap);
      wrap.querySelector('[data-gm-close]')?.addEventListener('click',()=>modal.querySelector('.modal-head button')?.click());
    });
  }

  function extractOwnerLogin(modal){
    const text=modal.textContent||'';
    const match=text.match(/LOGIN ID\s*([A-Z0-9_-]{3,})/i);
    return match?.[1]||null;
  }

  async function resolveGymId(modal){
    const loginId=extractOwnerLogin(modal);
    if(!loginId) throw new Error('Could not identify the Gym Owner account. Close and reopen the gym profile, then try again.');
    const rows=await rest('profiles?select=gym_id,login_id&login_id=eq.'+encodeURIComponent(loginId)+'&role=eq.admin&limit=1');
    if(!rows?.[0]?.gym_id) throw new Error('Could not identify this gym.');
    return rows[0].gym_id;
  }

  function addDeleteAction(){
    document.querySelectorAll('.modal').forEach(modal=>{
      if(modal.dataset.gmDeleteAdded==='1') return;
      const text=modal.textContent||'';
      const title=(modal.querySelector('.modal-head h3')?.textContent||'').trim();
      if(!title || !/Gym status/i.test(text) || !/Owner Access/i.test(text)) return;
      const body=modal.querySelector('.modal-body');if(!body)return;
      const button=document.createElement('button');
      button.type='button';button.className='danger-button wide';button.textContent='Delete Gym & All Data';
      button.style.marginTop='12px';
      button.addEventListener('click',async()=>{
        if(!confirm('Delete '+title+' permanently? This removes the gym, owner, members, trainers, memberships, payments, attendance and related gym data. This cannot be undone.')) return;
        button.disabled=true;button.textContent='Deleting…';
        try{
          const gymId=await resolveGymId(modal);
          const result=await edge('super-admin-delete-gym',{gym_id:gymId});
          if(!result?.ok) throw new Error(result?.error||'Gym could not be deleted.');
          alert('Gym deleted successfully.');
          location.reload();
        }catch(error){
          alert(error?.message||'Gym could not be deleted.');
          button.disabled=false;button.textContent='Delete Gym & All Data';
        }
      });
      body.appendChild(button);
      modal.dataset.gmDeleteAdded='1';
    });
  }

  function run(){
    normalizeText(document.body);
    if(document.title)document.title=normalize(document.title);
    hideCredentialModal();
    addDeleteAction();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      if(mutation.type==='characterData') normalizeText(mutation.target);
      mutation.addedNodes.forEach(normalizeText);
    }
    hideCredentialModal();
    addDeleteAction();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
