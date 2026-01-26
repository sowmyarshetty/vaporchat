import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // Verify session belongs to room
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("room_id", roomId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    // Delete all messages in room (vaporize history)
    await supabaseAdmin.from("messages").delete().eq("room_id", roomId);

    // Delete session (participant)
    await supabaseAdmin.from("sessions").delete().eq("id", sessionId);

    // Check if room is empty, delete if so
    const { data: remainingSessions } = await supabaseAdmin
      .from("sessions")
      .select("id")
      .eq("room_id", roomId)
      .limit(1);

    if (!remainingSessions || remainingSessions.length === 0) {
      await supabaseAdmin.from("rooms").delete().eq("id", roomId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Exit room error:", error);
    return NextResponse.json(
      { error: "Failed to exit room" },
      { status: 500 }
    );
  }
}
