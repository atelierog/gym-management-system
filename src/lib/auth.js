import { supabase } from "./supabase";

const SUPER_ADMIN_EMAIL="atelierog.co@gmail.com";

export async function signIn(loginId,password){
 if(!supabase) throw new Error("Supabase is not configured.");
 const raw=loginId.trim().toLowerCase();
 const email=raw.includes("@")?raw:raw+"@gymos.local";
 const {data,error}=await supabase.auth.signInWithPassword({email,password});
 if(error)throw error;
 const {data:platform}=await supabase.from("platform_admins").select("status").eq("id",data.user.id).maybeSingle();
 if(platform?.status==="active") return data;
 const {data:profile,error:pe}=await supabase.from("profiles").select("status").eq("id",data.user.id).single();
 if(pe||profile?.status!=="active"){
   await supabase.auth.signOut();
   throw new Error("This account is inactive. Contact your Gym Admin.");
 }
 return data;
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
 return data;
}
export { SUPER_ADMIN_EMAIL };
