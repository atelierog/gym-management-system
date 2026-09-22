import React,{useEffect,useMemo,useState}from"react";import{createRoot}from"react-dom/client";import"./app.css";import{supabase}from"./lib/supabase";import{currentProfile,signOut}from"./lib/auth";import Login from"./login";

const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const fmt=d=>d?new Date(d).toLocaleDateString("en-IN"):"—";
function Card({t,n,s}){return <article className="stat"><small>{t}</small><strong>{n}</strong><span>{s}</span></article>}
function Modal({title,children,onClose}){return <div className="overlay"><div className="modal"><div className="modal-head"><h3>{title}</h3><button onClick={onClose}>×</button></div>{children}</div></div>}
function AdminApp({profile}){
 const[tab,setTab]=useState("Dashboard"),[members,setMembers]=useState([]),[plans,setPlans]=useState([]),[payments,setPayments]=useState([]),[attendance,setAttendance]=useState([]),[gym,setGym]=useState(null),[loading,setLoading]=useState(true),[modal,setModal]=useState(null),[notice,setNotice]=useState("");
 const today=new Date().toISOString().slice(0,10);
 async function load(){
  setLoading(true);
  const [p,g,pl,pay,a]=await Promise.all([
   supabase.from("profiles").select("*").eq("gym_id",profile.gym_id).order("created_at",{ascending:false}),
   supabase.from("gyms").select("*").eq("id",profile.gym_id).single(),
   supabase.from("membership_plans").select("*").eq("gym_id",profile.gym_id).order("price"),
   supabase.from("payments").select("*").eq("gym_id",profile.gym_id).order("paid_at",{ascending:false}).limit(100),
   supabase.from("attendance").select("*").eq("gym_id",profile.gym_id).gte("check_in",today+"T00:00:00").order("check_in",{ascending:false})
  ]);
  setMembers(p.data||[]);setGym(g.data);setPlans(pl.data||[]);setPayments(pay.data||[]);setAttendance(a.data||[]);setLoading(false);
 }
 useEffect(()=>{load()},[]);
 const membersOnly=members.filter(x=>x.role==="member"), trainers=members.filter(x=>x.role==="trainer");
 const activeCount=membersOnly.length;
 const todayCollection=payments.filter(x=>x.paid_at?.slice(0,10)===today).reduce((s,x)=>s+Number(x.amount),0);
 const present=new Set(attendance.map(x=>x.user_id)).size;
 const expiring=membersOnly.length?0:0;
 async function createUser(e){
  e.preventDefault();const f=new FormData(e.currentTarget);setNotice("");
  const {data,error}=await supabase.functions.invoke("admin-create-user",{body:{login_id:f.get("login_id"),full_name:f.get("full_name"),role:f.get("role"),phone:f.get("phone"),password:f.get("password")}});
  if(error||data?.error){setNotice(error?.message||data?.error||"Could not create account.");return}
  setNotice("Account created successfully.");setModal(null);load();
 }
 async function saveGym(e){
  e.preventDefault();const f=new FormData(e.currentTarget);
  const {error}=await supabase.from("gyms").update({name:f.get("name"),latitude:f.get("latitude")||null,longitude:f.get("longitude")||null,allowed_radius_m:Number(f.get("radius")||100)}).eq("id",profile.gym_id);
  setNotice(error?.message||"Gym settings saved.");if(!error){setModal(null);load()}
 }
 async function addPlan(e){
  e.preventDefault();const f=new FormData(e.currentTarget);
  const {error}=await supabase.from("membership_plans").insert({gym_id:profile.gym_id,name:f.get("name"),duration_months:Number(f.get("months")),price:Number(f.get("price"))});
  setNotice(error?.message||"Plan created.");if(!error){setModal(null);load()}
 }
 async function addPayment(e){
  e.preventDefault();const f=new FormData(e.currentTarget);const member=members.find(x=>x.id===f.get("member_id"));
  const receipt="R"+Date.now().toString().slice(-9);
  const {error}=await supabase.from("payments").insert({gym_id:profile.gym_id,member_id:member.id,receipt_no:receipt,amount:Number(f.get("amount")),method:f.get("method"),membership_id:null});
  setNotice(error?.message||"Payment recorded.");if(!error){setModal(null);load()}
 }
 const title=tab==="Dashboard"?"Dashboard":tab;
 return <div className="app"><aside><h1>GYM<span>OS</span></h1><p>{profile.full_name}<br/><em>Administrator</em></p><nav>{["Dashboard","Members","Trainers","Attendance","Memberships","Payments","Reports","Settings"].map(x=><button className={tab===x?"active":""} onClick={()=>setTab(x)} key={x}>{x}</button>)}</nav><button className="logout" onClick={signOut}>Sign out</button></aside>
 <main><header><div><small>GYM MANAGEMENT SYSTEM</small><h2>{title}</h2></div>{tab==="Members"&&<button className="primary" onClick={()=>setModal("member")}>+ Add Member</button>}{tab==="Trainers"&&<button className="primary" onClick={()=>setModal("trainer")}>+ Add Trainer</button>}{tab==="Payments"&&<button className="primary" onClick={()=>setModal("payment")}>+ Record Payment</button>}{tab==="Memberships"&&<button className="primary" onClick={()=>setModal("plan")}>+ Add Plan</button>}</header>
 {notice&&<div className="notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
 {tab==="Dashboard"&&<><section className="cards"><Card t="Total members" n={membersOnly.length} s="Registered members"/><Card t="Trainers" n={trainers.length} s="Active staff"/><Card t="Today's attendance" n={present} s="Checked in today"/><Card t="Today's collection" n={money(todayCollection)} s="Recorded payments"/></section><div className="columns"><section className="panel"><h3>Today's attendance</h3>{attendance.length?<Table rows={attendance} members={members}/>:<Empty text="No attendance recorded today."/>}</section><section className="panel"><h3>Recent payments</h3>{payments.slice(0,6).length?<PaymentTable rows={payments.slice(0,6)} members={members}/>:<Empty text="No payments recorded yet."/>}</section></div><section className="panel"><h3>Gym status</h3><p><b>{gym?.name}</b></p><p>Check-in radius: <b>{gym?.allowed_radius_m||100} m</b></p><p>{gym?.latitude&&gym?.longitude?"Location configured":"Location not configured yet — configure it in Settings."}</p></section></>}
 {tab==="Members"&&<PeopleTable people={membersOnly} onAdd={()=>setModal("member")} />}
 {tab==="Trainers"&&<PeopleTable people={trainers} onAdd={()=>setModal("trainer")} />}
 {tab==="Attendance"&&<section className="panel"><Table rows={attendance} members={members}/></section>}
 {tab==="Memberships"&&<section className="panel"><div className="section-top"><h3>Membership plans</h3><button className="secondary" onClick={()=>setModal("plan")}>Add plan</button></div>{plans.length?<div className="table"><div className="tr th"><span>Plan</span><span>Duration</span><span>Price</span><span>Status</span></div>{plans.map(p=><div className="tr" key={p.id}><span>{p.name}</span><span>{p.duration_months} month(s)</span><span>{money(p.price)}</span><span>{p.active?"Active":"Inactive"}</span></div>)}</div>:<Empty text="No membership plans yet."/>}</section>}
 {tab==="Payments"&&<section className="panel"><div className="section-top"><h3>Payment history</h3><button className="secondary" onClick={()=>setModal("payment")}>Record payment</button></div><PaymentTable rows={payments} members={members}/></section>}
 {tab==="Reports"&&<section className="cards"><Card t="Total collected" n={money(payments.reduce((s,x)=>s+Number(x.amount),0))} s="All recorded payments"/><Card t="Cash" n={money(payments.filter(x=>x.method==="cash").reduce((s,x)=>s+Number(x.amount),0))} s="Payment method"/><Card t="UPI" n={money(payments.filter(x=>x.method==="upi").reduce((s,x)=>s+Number(x.amount),0))} s="Payment method"/><Card t="Attendance today" n={present} s="Unique users"/></section>}
 {tab==="Settings"&&<section className="panel"><h3>Gym settings</h3><p>Configure the location used for GPS attendance validation.</p><button className="primary" onClick={()=>setModal("settings")}>Edit gym settings</button></section>}
 </main>
 {modal==="member"&&<Modal title="Add member" onClose={()=>setModal(null)}><UserForm onSubmit={createUser} role="member"/></Modal>}
 {modal==="trainer"&&<Modal title="Add trainer" onClose={()=>setModal(null)}><UserForm onSubmit={createUser} role="trainer"/></Modal>}
 {modal==="plan"&&<Modal title="Add membership plan" onClose={()=>setModal(null)}><form onSubmit={addPlan} className="form"><label>Plan name<input name="name" required placeholder="3 Months"/></label><label>Duration (months)<input name="months" type="number" min="1" required/></label><label>Price<input name="price" type="number" min="0" required/></label><button className="primary wide">Create plan</button></form></Modal>}
 {modal==="payment"&&<Modal title="Record payment" onClose={()=>setModal(null)}><form onSubmit={addPayment} className="form"><label>Member<select name="member_id" required><option value="">Select member</option>{membersOnly.map(m=><option value={m.id} key={m.id}>{m.full_name} · {m.login_id}</option>)}</select></label><label>Amount<input name="amount" type="number" min="1" required/></label><label>Method<select name="method"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></label><button className="primary wide">Save payment</button></form></Modal>}
 {modal==="settings"&&<Modal title="Gym settings" onClose={()=>setModal(null)}><form onSubmit={saveGym} className="form"><label>Gym name<input name="name" defaultValue={gym?.name}/></label><label>Latitude<input name="latitude" type="number" step="any" defaultValue={gym?.latitude||""} placeholder="e.g. 22.8046"/></label><label>Longitude<input name="longitude" type="number" step="any" defaultValue={gym?.longitude||""} placeholder="e.g. 86.2029"/></label><label>Allowed radius (meters)<input name="radius" type="number" min="10" max="5000" defaultValue={gym?.allowed_radius_m||100}/></label><button className="primary wide">Save settings</button></form></Modal>}
 </div>
}
function UserForm({onSubmit,role}){return <form onSubmit={onSubmit} className="form"><label>Full name<input name="full_name" required/></label><label>{role==="member"?"Member":"Trainer"} ID<input name="login_id" required placeholder={role==="member"?"MEM001":"TRN001"}/></label><label>Phone<input name="phone" inputMode="tel"/></label><label>Initial password<input name="password" type="password" minLength="8" required/></label><input type="hidden" name="role" value={role}/><button className="primary wide">Create {role}</button></form>}
function PeopleTable({people}){return <section className="panel"><div className="table"><div className="tr th"><span>Name</span><span>ID</span><span>Phone</span><span>Status</span></div>{people.map(p=><div className="tr" key={p.id}><span><b>{p.full_name}</b></span><span>{p.login_id}</span><span>{p.phone||"—"}</span><span>{p.status}</span></div>)}</div>{!people.length&&<Empty text="No records yet."/>}</section>}
function Table({rows,members}){return <div className="table"><div className="tr th"><span>Person</span><span>Check in</span><span>Check out</span><span>Type</span></div>{rows.map(r=>{const p=members.find(x=>x.id===r.user_id);return <div className="tr" key={r.id}><span>{p?.full_name||r.user_id}</span><span>{new Date(r.check_in).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span><span>{r.check_out?new Date(r.check_out).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"Present"}</span><span>{r.checkout_type||"—"}</span></div>})}</div>}
function PaymentTable({rows,members}){return <div className="table"><div className="tr th"><span>Receipt</span><span>Member</span><span>Amount</span><span>Method</span><span>Date</span></div>{rows.map(r=>{const p=members.find(x=>x.id===r.member_id);return <div className="tr" key={r.id}><span>{r.receipt_no}</span><span>{p?.full_name||"—"}</span><span>{money(r.amount)}</span><span>{r.method}</span><span>{fmt(r.paid_at)}</span></div>})}</div>}
function Empty({text}){return <div className="empty">{text}</div>}
function App(){const[profile,setProfile]=useState(undefined);useEffect(()=>{(async()=>{if(!supabase){setProfile(null);return}try{setProfile(await currentProfile())}catch{setProfile(null)}})()},[]);useEffect(()=>{if(!supabase)return;const{data}=supabase.auth.onAuthStateChange(()=>currentProfile().then(setProfile).catch(()=>setProfile(null)));return()=>data.subscription.unsubscribe()},[]);if(profile===undefined)return <div className="login"><div className="login-card"><h1>GYM<span>OS</span></h1><p>Loading…</p></div></div>;return profile?<AdminApp profile={profile}/>:<Login onLogin={async()=>setProfile(await currentProfile())}/>}

createRoot(document.getElementById("root")).render(<App/>);
