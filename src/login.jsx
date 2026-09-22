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
 return <div className="login"><form onSubmit={submit} className="login-card"><div className="brand">GYM<span>OS</span></div><h1>Welcome back</h1><p>Sign in to your gym account</p><label>Member / Staff ID<input value={id} onChange={e=>setId(e.target.value)} placeholder="Enter your ID" autoComplete="username"/></label><label>Password<div className="password-wrap"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?"Hide":"Show"}</button></div></label><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember me</label>{error&&<div className="error">{error}</div>}<button className="primary wide" disabled={busy}>{busy?"Signing in…":"Sign in"}</button><small>Forgot your password? Contact your gym administrator.</small></form></div>
}
