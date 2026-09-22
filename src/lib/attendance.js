import { supabase } from "../main";

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2-lat1)*rad, dLon = (lon2-lon1)*rad;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

export async function checkIn(userId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (new Date().getDay() === 0) throw new Error("Gym is closed on Sunday.");
  const { data:gym, error:ge } = await supabase.from("gyms").select("*").single();
  if (ge) throw ge;
  const position = await new Promise((resolve,reject) =>
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000})
  );
  const lat=position.coords.latitude, lng=position.coords.longitude;
  const meters=distanceMeters(lat,lng,Number(gym.latitude),Number(gym.longitude));
  if (meters > gym.allowed_radius_m) throw new Error("You are outside the gym check-in radius.");
  const {data,error}=await supabase.from("attendance").insert({
    gym_id:gym.id,user_id:userId,check_in_lat:lat,check_in_lng:lng
  }).select().single();
  if(error) throw error;
  return data;
}

export async function checkOut(attendanceId) {
  const {data,error}=await supabase.from("attendance").update({
    check_out:new Date().toISOString(),checkout_type:"manual",status:"closed"
  }).eq("id",attendanceId).is("check_out",null).select().single();
  if(error) throw error;
  return data;
}
