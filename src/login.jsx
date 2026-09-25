import React,{useEffect,useMemo,useState} from "react";
import { supabase } from "./lib/supabase";
import { signIn, signOut } from "./lib/auth";
import "./login.css";

const REMEMBER_KEY="gym_manager_remembered_login_v1";
async function reportLoginError(message,code="LOGIN_ERROR"){try{await supabase.rpc("record_platform_error",{p_source:"login",p_operation:"sign_in",p_message:String(message||"Login error"),p_error_code:code,p_path:window.location.pathname})}catch{}}

function roleFromPath(){
 const parts=window.location.pathname.toLowerCase().split("/").filter(Boolean);
 const role=parts[parts.length-1];
 return ["owner","trainer","member"].includes(role)?role:null;
}

const ROLE_COPY={
 owner:{label:"Gym Owner",title:"Welcome to Your Gym Manager",subtitle:"Sign in to manage your gym"},
 trainer:{label:"Trainer",title:"Welcome back",subtitle:"Sign in to manage your training"},
 member:{label:"Member",title:"Welcome back",subtitle:"Sign in to your gym"}
};

export default function Login({onLogin}){
 const [id,setId]=useState(""),[password,setPassword]=useState(""),[remember,setRemember]=useState(false),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const routeRole=useMemo(()=>roleFromPath(),[]),copy=routeRole?ROLE_COPY[routeRole]:null;
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(REMEMBER_KEY)||"null");if(saved?.id){setId(saved.id);setRemember(true)}}catch{}},[]);
 async function submit(e){
  e.preventDefault();setError("");
  if(!supabase){const msg="Supabase is not configured yet.";setError(msg);reportLoginError(msg,"CONFIGURATION_ERROR");return}
  if(!id.trim()||!password){const msg="Enter your Login ID and password.";setError(msg);reportLoginError(msg,"VALIDATION_ERROR");return}
  setBusy(true);const cleanId=id.trim();
  try{
   const data=await signIn(cleanId,password);
   const expected=routeRole==="owner"?"admin":routeRole;
   if(expected){
    const {data:platform}=await supabase.from("platform_admins").select("status").eq("id",data.user.id).maybeSingle();
    if(!platform?.status){
      const {data:profile}=await supabase.from("profiles").select("role").eq("id",data.user.id).single();
      if(profile?.role!==expected){await signOut();throw new Error(`This link is for the ${copy.label} login.`)}
    }
   }
   if(remember){try{localStorage.setItem(REMEMBER_KEY,JSON.stringify({id:cleanId}))}catch{}}else{try{localStorage.removeItem(REMEMBER_KEY)}catch{}}
   setBusy(false);onLogin(data.user);
  }catch(error){setBusy(false);const msg=String(error?.message||"").startsWith("This link is for the ")?error.message:error?.message==="This account is inactive. Contact your Gym Admin."?error.message:"Invalid Login ID or password.";setError(msg);reportLoginError(msg,error?.message==="This account is inactive. Contact your Gym Admin."?"ACCOUNT_INACTIVE":"AUTHENTICATION");return}
 }
 return <div className="gm-login-shell">
   <div className="gm-login-glow gm-login-glow-one"/><div className="gm-login-glow gm-login-glow-two"/>
   <div className="gm-login-arc gm-login-arc-one"/><div className="gm-login-arc gm-login-arc-two"/>
   <div className="gm-login-brand"><div className="gm-aog-mark">AOG</div><div><b>ATELIER OG</b><span>Business systems & automation</span></div></div>
   <div className="gm-login-content">
     <div className="gm-login-logo-wrap"><img src="/icon.svg" alt="Gym Manager" className="gm-login-logo"/></div>
     <div className="gm-login-title"><span>Gym</span> <strong>Manager</strong></div>
     <div className="gm-login-tag">MANAGE · GROW · TOGETHER</div>
     <form onSubmit={submit} className="gm-login-card">
       <div className="gm-login-heading"><div className="gm-eyebrow">{copy?.label.toUpperCase()||"YOUR GYM · YOUR CONTROL"}</div><h1>{copy?.title||"Welcome to Your Gym Manager"}</h1><p>{copy?.subtitle||"Sign in to manage your gym"}</p></div>
       <label>Login ID<input value={id} onChange={e=>setId(e.target.value)} placeholder="Enter your Login ID" autoComplete="username"/></label>
       <label>Password><div className="gm-password-wrap"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/><button type="button" className="gm-password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.7 3.3 10 7a11.8 11.8 0 01-2.7 4.5M6.1 6.1C4.5 7.3 3.4 9 2 12c1.3 3.7 5 7 10 7 1.3 0 2.5-.2 3.6-.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/></svg>}</button></div></label>
       <label className="gm-remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span>Remember me</span></label>
       {error&&<div className="gm-error">{error}</div>}
       <button className="gm-signin" disabled={busy}>{busy?"Signing in…":"Sign in"}</button>
       <div className="gm-login-footer"><span>Gym Manager</span><span>Powered by Atelier OG</span></div>
     </form>
   </div>
 </div>
}
