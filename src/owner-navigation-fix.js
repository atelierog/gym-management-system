/* Gym Manager — Owner navigation compatibility layer.
 * The owner dashboard is loaded by index.html. This file only bridges
 * dashboard quick actions to the existing React drawer/navigation.
 */

function ownerNav(label){
  const wanted=String(label||"").trim().toLowerCase();
  const find=()=>[...document.querySelectorAll(".mobile-drawer .nav-item,.admin-nav .nav-item")].find(el=>String(el.textContent||"").trim().toLowerCase()===wanted);
  const direct=find();
  if(direct){direct.click();return true}
  const menu=document.querySelector(".owner-menu-button");
  if(!menu)return false;
  menu.click();
  setTimeout(()=>find()?.click(),80);
  return true;
}

function ownerRegister(){
  if(!ownerNav("members"))return;
  setTimeout(()=>document.querySelector(".admin-page-header .page-action")?.click(),150);
}

document.addEventListener("click",event=>{
  const action=event.target?.closest?.(".gm-owner-v2 .action");
  if(action){
    const label=String(action.querySelector("b")?.textContent||"").trim().toLowerCase();
    if(label==="register member")ownerRegister();
    else if(label==="attendance")ownerNav("attendance");
    else if(label==="members")ownerNav("members");
    else if(label==="trainers")ownerNav("trainers");
    return;
  }
  const register=event.target?.closest?.(".gm-owner-v2 .register");
  if(register){ownerRegister();return}
  const attention=event.target?.closest?.(".gm-owner-v2 .attention-item");
  if(attention){
    const label=String(attention.textContent||"").toLowerCase();
    ownerNav(label.includes("payment dues")?"dues":"memberships");
  }
});
