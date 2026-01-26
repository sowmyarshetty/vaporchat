import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPassword } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, roomName, password, displayName } = body;
    const d = (displayName || "").trim();
    const p = (password || "").trim();

    if (!d || !p) {
      return NextResponse.json(
        { error: "Missing display name or password" },
        { status: 400 }
      );
    }

    // Find room by ID or name
    let room = null;
    if (roomId) {
      const { data, error } = await supabaseAdmin
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      if (!error && data) room = data;
    }

    if (!room && roomName) {
      const rn = (roomName || "").trim();
      const { data: roomsData, error } = await supabaseAdmin
        .from("rooms")
        .select("*");
      if (!error && roomsData) {
        room = roomsData.find(
          (r) => r.name.trim().toLowerCase() === rn.toLowerCase()
        ) || null;
      }
    }

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Verify password
    if (!verifyPassword(p, room.password_salt, room.password_hash)) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Create session
    const sessionId = randomUUID();
    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        id: sessionId,
        room_id: room.id,
        display_name: d,
      });

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return NextResponse.json(
        { error: "Failed to join room" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      roomId: room.id,
      roomName: room.name,
      sessionId,
    });
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json(
      { error: "Failed to join room" },
      { status: 500 }
    );
  }
}
