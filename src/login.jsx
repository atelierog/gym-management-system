import React,{useState} from "react";
import { supabase, setRememberMe } from "./lib/supabase";
import { bootstrapSuperAdmin, SUPER_ADMIN_EMAIL } from "./lib/auth";

export default function Login({onLogin}){
 const [id,setId]=useState(""),[password,setPassword]=useState(""),[showPassword,setShowPassword]=useState(false),[remember,setRemember]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(e){
  e.preventDefault();setError("");
  if(!supabase){setError("Supabase is not configured yet.");return}
  if(!id.trim()||!password){setError("Enter your ID or email and password.");return}
  setBusy(true);setRememberMe(remember);
  const email=id.trim().toLowerCase().includes("@")?id.trim().toLowerCase():id.trim().toLowerCase()+"@gymos.local";
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error){setBusy(false);setError("Invalid ID/email or password.");return}
  if(email===SUPER_ADMIN_EMAIL){const {error:be}=await bootstrapSuperAdmin();if(be){await supabase.auth.signOut();setBusy(false);setError(be.message||"Super Admin setup failed.");return}}
  setBusy(false);onLogin(data.user);
 }
 return <div className="login"><form onSubmit={submit} className="login-card"><div className="brand">GYM<span>OS</span></div><h1>Welcome back</h1><p>Sign in to your gym account</p><label>Login ID or Super Admin email<input value={id} onChange={e=>setId(e.target.value)} placeholder="Enter your ID or email" autoComplete="username"/></label><label>Password<div className="password-wrap"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.7 3.3 10 7a11.8 11.8 0 01-2.7 4.5M6.1 6.1C4.5 7.3 3.4 9 2 12c1.3 3.7 5 7 10 7 1.3 0 2.5-.2 3.6-.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/></svg>}</button></div></label><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember me</label>{error&&<div className="error">{error}</div>}<button className="primary wide" disabled={busy}>{busy?"Signing in…":"Sign in"}</button><small>Gym owners and staff use their GymOS ID. Super Admin uses the official Atelier OG email.</small></form></div>
}
