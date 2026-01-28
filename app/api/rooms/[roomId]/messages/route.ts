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
    const messageId = randomUUID();
    const { data: insertedMessage, error: messageError } = await supabaseAdmin
      .from("messages")
      .insert({
        id: messageId,
        room_id: roomId,
        sender_id: sessionId,
        sender_name: session.display_name,
        content: text,
      })
      .select()
      .single();

    if (messageError) {
      console.error("Message creation error:", messageError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // Broadcast new message event (primary mechanism for real-time updates)
    // This works even if postgres_changes has binding issues
    try {
      // Note: Server-side broadcast requires the channel to be subscribed
      // For now, we rely on postgres_changes or client-side polling
      // The broadcast from client-side works better
    } catch (broadcastError) {
      // Non-critical - message was saved
      console.warn("Broadcast error (non-critical):", broadcastError);
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
