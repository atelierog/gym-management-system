import React,{useState} from "react";
import { supabase } from "./lib/supabase";

export default function Login({onLogin}){
 const [id,setId]=useState(""),[password,setPassword]=useState(""),[showPassword,setShowPassword]=useState(false),[remember,setRemember]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(e){
  e.preventDefault();setError("");
  if(!supabase){setError("Supabase is not configured yet.");return}
  if(!id.trim()||!password){setError("Enter your ID and password.");return}
  setBusy(true);
  const email=id.trim().toLowerCase()+"@gymos.local";
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  setBusy(false);
  if(error){setError("Invalid ID or password.");return}
  if(!remember) await supabase.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
  onLogin(data.user);
 }
 return <div className="login"><form onSubmit={submit} className="login-card"><div className="brand">GYM<span>OS</span></div><h1>Welcome back</h1><p>Sign in to your gym account</p><label>Member / Staff ID<input value={id} onChange={e=>setId(e.target.value)} placeholder="Enter your ID" autoComplete="username"/></label><label>Password<div className="password-wrap"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.7 3.3 10 7a11.8 11.8 0 01-2.7 4.5M6.1 6.1C4.5 7.3 3.4 9 2 12c1.3 3.7 5 7 10 7 1.3 0 2.5-.2 3.6-.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/></svg>}</button></div></label><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember me</label>{error&&<div className="error">{error}</div>}<button className="primary wide" disabled={busy}>{busy?"Signing in…":"Sign in"}</button><small>Forgot your password? Contact your gym administrator.</small></form></div>
}
