import { supabase } from "./supabase";

const SUPER_ADMIN_EMAIL="atelierog.co@gmail.com";

async function loadGymAccess(profile){
 if(!profile?.gym_id) return null;
 const {data:gym}=await supabase.from("gyms").select("id,slug,platform_status").eq("id",profile.gym_id).maybeSingle();
 return gym||null;
}

function ensureGymAccess(gym){
 if(gym?.platform_status==="suspended") throw new Error("This gym is currently suspended. Contact Atelier OG.");
}

export async function signIn(loginId,password){
 if(!supabase) throw new Error("Supabase is not configured.");
 const raw=loginId.trim().toLowerCase();
 const email=raw.includes("@")?raw:raw+"@gymos.local";
 const {data,error}=await supabase.auth.signInWithPassword({email,password});
 if(error)throw error;

 // Fetch account records together to keep login fast.
 const [{data:platform},{data:profile,error:profileError}]=await Promise.all([
   supabase.from("platform_admins").select("id,email,full_name,status").eq("id",data.user.id).maybeSingle(),
   supabase.from("profiles").select("*").eq("id",data.user.id).maybeSingle()
 ]);

 if(platform?.status==="active") return {...data,platform,profile:null};
 if(profileError || !profile || profile.status!=="active"){
   await supabase.auth.signOut();
   throw new Error("This account is inactive. Contact your Gym Admin.");
 }
 const gym=await loadGymAccess(profile);
 try{ensureGymAccess(gym)}catch(err){await supabase.auth.signOut();throw err}
 return {...data,platform:null,profile:{...profile,gym_platform_status:gym?.platform_status||"active",gym_slug:gym?.slug||null}};
}

export async function signOut(){if(supabase)await supabase.auth.signOut();}
export async function currentProfile(){
 if(!supabase)return null;
 const {data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const {data:platform}=await supabase.from("platform_admins").select("id,email,full_name,status").eq("id",user.id).maybeSingle();
 if(platform?.status==="active") return {id:user.id,gym_id:null,login_id:"ATELIEROG",full_name:platform.full_name||"Atelier OG Super Admin",role:"super_admin",status:"active",email:platform.email||user.email};
 const {data,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();
 if(error)throw error;
 if(data.status!=="active"){await supabase.auth.signOut();return null;}
 const gym=await loadGymAccess(data);
 if(gym?.platform_status==="suspended"){await supabase.auth.signOut();return null;}
 return {...data,gym_platform_status:gym?.platform_status||"active",gym_slug:gym?.slug||null};
}
export { SUPER_ADMIN_EMAIL };
