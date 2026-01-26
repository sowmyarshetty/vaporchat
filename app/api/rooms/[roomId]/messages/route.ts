import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { sessionId, content } = body;

    if (!sessionId || !content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing sessionId or content" },
        { status: 400 }
      );
    }

    const text = content.trim();
    if (!text) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    // Get session to verify it exists and get display name
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("display_name")
      .eq("id", sessionId)
      .eq("room_id", roomId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    // Insert message
    const { error: messageError } = await supabaseAdmin
      .from("messages")
      .insert({
        id: randomUUID(),
        room_id: roomId,
        sender_id: sessionId,
        sender_name: session.display_name,
        content: text,
      });

    if (messageError) {
      console.error("Message creation error:", messageError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

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

    // Delete all messages in room
    const { error: deleteError } = await supabaseAdmin
      .from("messages")
      .delete()
      .eq("room_id", roomId);

    if (deleteError) {
      console.error("Delete messages error:", deleteError);
      return NextResponse.json(
        { error: "Failed to clear messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear messages error:", error);
    return NextResponse.json(
      { error: "Failed to clear messages" },
      { status: 500 }
    );
  }
}
