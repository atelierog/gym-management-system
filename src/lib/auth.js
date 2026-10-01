import { supabase } from "./supabase";

const SUPER_ADMIN_EMAIL="atelierog.co@gmail.com";

/** Canonical application roles used by the Phase 1 routing model. */
const ROLE_ALIASES={
 super_admin:"super_admin",
 owner:"owner",
 admin:"owner",
 trainer:"trainer",
 member:"member",
};

const ROLE_LANDING_PATHS={
 super_admin:"/super-admin/dashboard",
 owner:"/owner/dashboard",
 trainer:"/trainer/home",
 member:"/member/home",
};

export function resolveRole(profile,{isPlatformAdmin=false}={}){
 if(isPlatformAdmin)return "super_admin";
 const raw=String(profile?.role||"").trim().toLowerCase();
 const role=ROLE_ALIASES[raw];
 if(!role)throw new Error("This account has no valid application role. Contact your Gym Admin.");
 return role;
}

export function resolveLandingPath(role){
 const path=ROLE_LANDING_PATHS[role];
 if(!path)throw new Error("This account has no valid application destination.");
 return path;
}

async function loadGymAccess(profile){
 if(!profile?.gym_id) return null;
 const {data:gym}=await supabase.from("gyms").select("id,slug,platform_status").eq("id",profile.gym_id).maybeSingle();
 return gym||null;
}

function ensureGymAccess(gym){
 if(gym?.platform_status==="suspended") throw new Error("This gym has been suspended.");
}

function withResolvedRole(profile,options={}){
 const role=resolveRole(profile,options);
 return {...profile,app_role:role,landing_path:resolveLandingPath(role)};
}

export async function signIn(loginId,password){
 if(!supabase) throw new Error("Supabase is not configured.");
 const raw=loginId.trim().toLowerCase();
 const email=raw.includes("@")?raw:raw+"@gymos.local";
 const {data,error}=await supabase.auth.signInWithPassword({email,password});
 if(error)throw error;

 const [{data:platform},{data:profile,error:profileError}]=await Promise.all([
   supabase.from("platform_admins").select("id,email,full_name,status").eq("id",data.user.id).maybeSingle(),
   supabase.from("profiles").select("*").eq("id",data.user.id).maybeSingle()
 ]);

 if(platform?.status==="active") return {...data,platform,profile:null,app_role:"super_admin",landing_path:resolveLandingPath("super_admin")};
 if(profileError || !profile || profile.status!=="active"){
   await supabase.auth.signOut();
   throw new Error("This account is inactive. Contact your Gym Admin.");
 }
 const gym=await loadGymAccess(profile);
 try{ensureGymAccess(gym)}catch(err){await supabase.auth.signOut();throw err}
 try{
   const resolved=withResolvedRole(profile);
   return {...data,platform:null,profile:{...resolved,gym_platform_status:gym?.platform_status||"active",gym_slug:gym?.slug||null}};
 }catch(err){await supabase.auth.signOut();throw err}
}

export async function signOut(){if(supabase)await supabase.auth.signOut();}

export async function currentProfile(){
 if(!supabase)return null;
 const {data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const {data:platform}=await supabase.from("platform_admins").select("id,email,full_name,status").eq("id",user.id).maybeSingle();
 if(platform?.status==="active") return {id:user.id,gym_id:null,login_id:"ATELIEROG",full_name:platform.full_name||"Atelier OG Super Admin",role:"super_admin",app_role:"super_admin",landing_path:resolveLandingPath("super_admin"),status:"active",email:platform.email||user.email};
 const {data,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();
 if(error)throw error;
 if(data.status!=="active"){await supabase.auth.signOut();return null;}
 const gym=await loadGymAccess(data);
 if(gym?.platform_status==="suspended"){await supabase.auth.signOut();return null;}
 return {...withResolvedRole(data),gym_platform_status:gym?.platform_status||"active",gym_slug:gym?.slug||null};
}

export { SUPER_ADMIN_EMAIL,ROLE_LANDING_PATHS };