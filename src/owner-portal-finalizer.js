import { supabase } from "./lib/supabase.js";

/*
 * Owner Portal finalization layer.
 * Keeps the portal intentionally small and provides one support path.
 */
const SUPPORT_EMAIL = "atelierog.co@gmail.com";
const SUPPORT_STYLE = `
.gm-owner-support{margin:14px 16px 18px;padding:14px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;box-shadow:0 6px 20px rgba(16,24,40,.06)}
.gm-owner-support strong{display:block;font-size:13px;color:#111827;margin-bottom:5px}
.gm-owner-support span{display:block;font-size:12px;color:#667085;line-height:1.45;margin-bottom:10px}
.gm-owner-support button{width:100%;border:0;border-radius:10px;padding:10px 12px;background:#111827;color:#fff;font-weight:700;cursor:pointer}
.gm-owner-support button:active{transform:translateY(1px)}
`;
function owner(){return !!document.querySelector(".admin-app")&&!document.querySelector(".super-admin-platform")}
function text(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ")}
function injectStyle(){if(document.getElementById("gm-owner-support-style"))return;const s=document.createElement("style");s.id="gm-owner-support-style";s.textContent=SUPPORT_STYLE;document.head.appendChild(s)}
function supportMail(){
  const page=window.location.href.replace(/^https?:\/\/[^/]+/i,()=>window.location.origin).toLowerCase();
  const code=`GM-SUPPORT-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const subject=encodeURIComponent(`Gym Manager Support — ${code}`);
  const body=encodeURIComponent(`Hello Atelier OG,\n\nI need help with Gym Manager.\n\nRole: Gym Owner\nPage: ${page}\nSupport reference: ${code}\n\nIssue:\n\nAdditional details:\n`);
  window.location.href=`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
function addSupport(){
  if(!owner())return;
  const nav=document.querySelector(".admin-app .mobile-drawer .nav-scroll,.admin-app .sidebar-nav,.admin-app .nav-scroll");
  if(!nav||nav.querySelector(".gm-owner-support"))return;
  const box=document.createElement("div");box.className="gm-owner-support";
  box.innerHTML=`<strong>Need help?</strong><span>Contact Atelier OG Support for Gym Manager assistance.</span><button type="button">Contact Atelier OG</button>`;
  box.querySelector("button").addEventListener("click",supportMail);
  nav.appendChild(box);
}
function simplify(){
  if(!owner())return;
  document.querySelectorAll(".admin-app .nav-item").forEach(item=>{
    const t=text(item.textContent);
    if(t==="reports"||t==="activity"||t.includes("activity log")||t.includes("reports")){
      item.hidden=true;item.setAttribute("aria-hidden","true");
    }
  });
}
function normalizeUrls(){
  if(!owner())return;
  document.querySelectorAll("a[href]").forEach(a=>{
    const href=a.getAttribute("href");
    if(!href||!/^https?:\/\/atelierog\.co\.in\//i.test(href))return;
    a.setAttribute("href",href.toLowerCase());
  });
}
function start(){
  injectStyle();
  const run=()=>{simplify();addSupport();normalizeUrls()};
  const observer=new MutationObserver(run);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(run,700);setTimeout(run,1800);
}
start();
