/* Gym Manager brand normalization. Keeps the product name consistent across React-rendered screens. */
(function(){
  const replacements = [
    [/GYMOS Platform/g, 'Gym Manager'],
    [/GymOS Platform/g, 'Gym Manager'],
    [/GYMOS PLATFORM/g, 'GYM MANAGER'],
    [/GymOS/g, 'Gym Manager'],
    [/GYMOS/g, 'Gym Manager']
  ];
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
  function run(){normalizeText(document.body);if(document.title)document.title=normalize(document.title);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      if(mutation.type==='characterData') normalizeText(mutation.target);
      mutation.addedNodes.forEach(normalizeText);
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
