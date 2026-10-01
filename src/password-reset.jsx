import React,{useEffect,useState}from"react";
import{updatePassword}from"./lib/auth";
import"./password-reset.css";

export default function PasswordReset(){
 const[password,setPassword]=useState("");
 const[confirm,setConfirm]=useState("");
 const[show,setShow]=useState(false);
 const[busy,setBusy]=useState(false);
 const[ready,setReady]=useState(false);
 const[done,setDone]=useState(false);
 const[error,setError]=useState("");

 useEffect(()=>{
  const hash=new URLSearchParams(window.location.hash.replace(/^#/ ,""));
  const query=new URLSearchParams(window.location.search);
  const hasRecovery=hash.get("type")==="recovery"||query.get("type")==="recovery";
  setReady(hasRecovery||Boolean(window.location.hash));
 },[]);

 async function submit(e){
  e.preventDefault();
  setError("");
  if(password.length<8){setError("Password must be at least 8 characters.");return}
  if(password!==confirm){setError("Passwords do not match.");return}
  setBusy(true);
  try{
   await updatePassword(password);
   setDone(true);
   window.history.replaceState({},document.title,"/reset-password");
   window.setTimeout(()=>{window.location.href="/"},1200);
  }catch(err){setError(String(err?.message||"Password could not be updated. Please request a new reset link."))}
  finally{setBusy(false)}
 }

 if(done)return <main className="gm-reset-shell"><section className="gm-reset-card"><div className="gm-reset-icon">✓</div><h1>Password updated</h1><p>Your password has been changed successfully. Redirecting you to sign in…</p></section></main>;

 return <main className="gm-reset-shell"><section className="gm-reset-card"><div className="gm-reset-brand"><div className="gm-reset-mark">GM</div><div><strong>Gym Manager</strong><span>Powered by Atelier OG</span></div></div><h1>Create a new password</h1><p className="gm-reset-subtitle">Choose a new password for your Gym Manager account.</p>{!ready&&<div className="gm-reset-notice">This reset link is missing or has expired. Request a new password-reset email from the login page.</div>}<form onSubmit={submit} aria-disabled={!ready}><label>New password<div className="gm-reset-input"><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} autoComplete="new-password" placeholder="Minimum 8 characters" disabled={!ready} required/><button type="button" onClick={()=>setShow(v=>!v)} disabled={!ready} aria-label={show?"Hide password":"Show password"}>{show?"Hide":"Show"}</button></div></label><label>Confirm password<input className="gm-reset-plain-input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} autoComplete="new-password" placeholder="Re-enter your password" disabled={!ready} required/></label>{error&&<div className="gm-reset-error" role="alert">{error}</div>}<button className="gm-reset-submit" disabled={!ready||busy}>{busy?"Updating…":"Update password"}</button></form><button className="gm-reset-back" type="button" onClick={()=>window.location.href="/"}>Back to sign in</button></section></main>;
}
