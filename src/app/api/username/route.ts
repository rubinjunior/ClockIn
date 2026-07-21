import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usernameSchema } from "@/lib/validation/schemas";
const attempts = new Map<string,{count:number;reset:number}>();
export async function GET(request:NextRequest){const ip=request.headers.get("x-forwarded-for")?.split(",")[0]??"local";const now=Date.now();const item=attempts.get(ip);if(item&&item.reset>now&&item.count>=20)return NextResponse.json({message:"יותר מדי ניסיונות"},{status:429});attempts.set(ip,{count:item?.reset&&item.reset>now?item.count+1:1,reset:now+60000});const candidate=request.nextUrl.searchParams.get("value")??"";if(!usernameSchema.safeParse(candidate).success)return NextResponse.json({available:false});const supabase=await createClient();const{data}=await supabase.rpc("is_username_available",{candidate});return NextResponse.json({available:Boolean(data)});}
