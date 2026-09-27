import React,{useEffect,useState} from "react";
import { supabase } from "./lib/supabase";
import { signIn } from "./lib/auth";
import "./login.css";

const REMEMBER_KEY="gym_manager_remembered_login_v1";
const SUPPORT_EMAIL="atelierog.co@gmail.com";

export default function Login({onLogin}){
 const [id,setId]=useState("");
 const [password,setPassword]=useState("");
 const [remember,setRemember]=useState(false);
 const [showPassword,setShowPassword]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [referenceBg,setReferenceBg]=useState("");

 useEffect(()=>{
  try{
   const saved=JSON.parse(localStorage.getItem(REMEMBER_KEY)||"null");
   if(saved?.id){setId(saved.id);setRemember(true)}
  }catch{}
  fetch("/login-reference.webp.b64",{cache:"force-cache"})
   .then(r=>r.ok?r.text():Promise.reject(new Error("reference unavailable")))
   .then(raw=>setReferenceBg(`url("data:image/webp;base64,${raw.trim()}")`))
   .catch(()=>{});
 },[]);

 async function reportLoginError(message,code="LOGIN_ERROR"){
  try{await supabase?.rpc("record_platform_error",{p_source:"login",p_operation:"sign_in",p_message:String(message||"Login error"),p_error_code:code,p_path:window.location.pathname})}catch{}
 }

 async function submit(e){
  e.preventDefault();
  setError("");setNotice("");
  if(!supabase){setError("Secure sign-in is not configured yet.");return}
  if(!id.trim()||!password){
   const msg="Enter your Login ID and password.";
   setError(msg);reportLoginError(msg,"VALIDATION_ERROR");return;
  }
  setBusy(true);
  const cleanId=id.trim();
  try{
   const data=await signIn(cleanId,password);
   if(remember)localStorage.setItem(REMEMBER_KEY,JSON.stringify({id:cleanId}));
   else localStorage.removeItem(REMEMBER_KEY);
   setBusy(false);
   onLogin(data.user);
  }catch(err){
   setBusy(false);
   const raw=String(err?.message||"");
   const msg=["This gym has been suspended.","This account is inactive. Contact your Gym Admin.","Your Gym Manager profile could not be found."].includes(raw)?raw:"Invalid Login ID or password.";
   setError(msg);
   reportLoginError(msg,"AUTHENTICATION");
  }
 }

 function forgotPassword(){
  setError("");
  setNotice(`Password recovery will open on the secure recovery screen. For immediate help, contact ${SUPPORT_EMAIL}.`);
 }

 return <main className="gm-login-shell" style={referenceBg?{backgroundImage:referenceBg}:undefined}>
  <div className="gm-login-background" aria-hidden="true">
   {!referenceBg&&<><div className="gm-bg-glow gm-bg-glow-one"/><div className="gm-bg-glow gm-bg-glow-two"/>
   <div className="gm-bg-rack gm-bg-rack-left"><i/><i/><i/></div>
   <div className="gm-bg-rack gm-bg-rack-right"><i/><i/><i/></div>
   <div className="gm-bg-bench"/><div className="gm-bg-floor"/>
   <div className="gm-bg-arc gm-bg-arc-fallback"/><div className="gm-bg-line"/></>}
  </div>

  <header className="gm-login-brand">
   <div className="gm-aog-mark">AOG</div>
   <div><strong>ATELIER OG</strong><span>Business systems &amp; automation</span></div>
  </header>

  <section className="gm-login-content" aria-label="Gym Manager sign in">
   <div className="gm-login-logo-wrap"><img className="gm-login-logo-image" src="/icon.svg" alt="Gym Manager"/></div>
   <h1 className="gm-login-title">Gym Manager</h1>

   <form onSubmit={submit} className="gm-login-card">
    <div className="gm-login-heading"><h2>Welcome to Gym Manager</h2><p>Sign in to access your account</p></div>

    <label className="gm-field-label">Login ID
     <div className="gm-input-wrap">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="m3 7 9 7 9-7"/></svg>
      <input value={id} onChange={e=>setId(e.target.value)} placeholder="Email / Login ID" autoComplete="username" inputMode="email"/>
     </div>
    </label>

    <label className="gm-field-label">Password
     <div className="gm-input-wrap">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
      <input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/>
      <button type="button" className="gm-password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>
       {showPassword?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.7 3.3 10 7a11.8 11.8 0 0 1-2.7 4.5M6.1 6.1C4.5 7.3 3.4 9 2 12c1.3 3.7 5 7 10 7 1.3 0 2.5-.2 3.6-.6"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}
      </button>
     </div>
    </label>

    <div className="gm-login-options">
     <label className="gm-remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span>Remember me</span></label>
     <button type="button" className="gm-forgot" onClick={forgotPassword}>Forgot password?</button>
    </div>

    {error&&<div className="gm-error" role="alert">{error}</div>}
    {notice&&<div className="gm-notice" role="status">{notice}</div>}

    <button className="gm-signin" disabled={busy} aria-busy={busy}>{busy?<><span className="gm-signin-spinner"/>Signing in…</>:"Sign in"}</button>

    <div className="gm-secure-row"><span/><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V7a6 6 0 0 1 12 0v3"/><rect x="4" y="10" width="16" height="11" rx="2"/></svg>Secure access</div><span/></div>
    <div className="gm-login-footer"><span>Powered by Atelier OG</span></div>
   </form>
  </section>
 </main>;
}
