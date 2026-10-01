import React,{useEffect,useState}from"react";import{createRoot}from"react-dom/client";import"./app.css";import"./owner.css";import{supabase}from"./lib/supabase";import{currentProfile,signOut}from"./lib/auth";import Login from"./login";import{resolveRouteGuard,redirectFromGuard}from"./lib/route-guards";

// Route guard integration: protected paths are validated before the existing application renders.
function RouteGuardBridge({children}){const[status,setStatus]=useState("checking");useEffect(()=>{let active=true;resolveRouteGuard(window.location.pathname).then(result=>{if(!active)return;if(result.allowed){setStatus("allowed");return}redirectFromGuard(result);setStatus("redirected")}).catch(()=>{if(active)setStatus("redirected")});return()=>{active=false}},[]);if(status==="checking")return <div className="app-loading" role="status" aria-live="polite">Loading…</div>;if(status==="redirected")return null;return children}

const GYMOS_APP_URL="https://gym-management-system.atelierog-co.workers.dev/";const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
function AppEntry(){const path=window.location.pathname;const isAuthPath=path==="/"||path==="/login"||path==="/forgot-password"||path==="/reset-password";if(isAuthPath)return <Login/>;return <RouteGuardBridge><ExistingApplication/></RouteGuardBridge>}
function ExistingApplication(){return <App/>}

function App(){return <div id="gym-manager-app"/>}

createRoot(document.getElementById("root")).render(<AppEntry/>);
