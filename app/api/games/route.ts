import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = createClient();

  // Get today's games only, sorted by start time
  const { data: games, error } = await supabase
    .from("games")
    .select("*")
    .gte("commence_time", new Date().toISOString().split("T")[0])
    .lte("commence_time", new Date().toISOString().split("T")[0] + " 23:59:59")
    .order("commence_time", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ games }); // keeps same shape UI expects
}
