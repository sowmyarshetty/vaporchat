import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password, displayName } = body;
    const n = (name || "").trim();
    const d = (displayName || "").trim();
    const p = (password || "").trim();

    if (!n || !d || !p) {
      return NextResponse.json(
        { error: "Missing room name, display name, or password" },
        { status: 400 }
      );
    }

    const roomId = randomUUID();
    const sessionId = randomUUID();
    const { salt, hash } = hashPassword(p);

    // Create room
    const { error: roomError } = await supabaseAdmin
      .from("rooms")
      .insert({
        id: roomId,
        name: n,
        password_salt: salt,
        password_hash: hash,
        created_by: d,
      });

    if (roomError) {
      console.error("Room creation error:", roomError);
      return NextResponse.json(
        { error: "Failed to create room" },
        { status: 500 }
      );
    }

    // Create session (participant)
    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        id: sessionId,
        room_id: roomId,
        display_name: d,
      });

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      // Clean up room if session creation fails
      await supabaseAdmin.from("rooms").delete().eq("id", roomId);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      roomId,
      roomName: n,
      sessionId,
    });
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
