"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import { supabase } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  sent_at: string;
};

type RoomClientProps = { roomId: string };

export function RoomClient({ roomId }: RoomClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId");
  const initialRoomName = searchParams.get("roomName") ?? "";

  const [roomName, setRoomName] = useState(initialRoomName);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load initial room data and messages
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId) {
      router.replace(`/join?room=${roomId}`);
      return;
    }

    async function loadRoom() {
      try {
        setLoading(true);
        setJoinError("");

        // Verify session exists
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("display_name, room_id")
          .eq("id", sessionId)
          .eq("room_id", roomId)
          .single();

        if (sessionError || !session) {
          setJoinError("Invalid session. Please join again.");
          setLoading(false);
          return;
        }

        // Load room name
        const { data: room, error: roomError } = await supabase
          .from("rooms")
          .select("name")
          .eq("id", roomId)
          .single();

        if (roomError || !room) {
          setJoinError("Room not found.");
          setLoading(false);
          return;
        }

        setRoomName(room.name);

        // Load messages
        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });

        if (messagesError) {
          console.error("Error loading messages:", messagesError);
        } else {
          setMessages(messagesData || []);
        }

        setConnected(true);
        setLoading(false);

        // Subscribe to new messages
        const channel = supabase
          .channel(`room:${roomId}`, {
            config: {
              broadcast: { self: true },
            },
          })
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `room_id=eq.${roomId}`,
            },
            (payload) => {
              console.log("New message received:", payload);
              const newMessage = payload.new as Message;
              setMessages((prev) => {
                // Avoid duplicates
                if (prev.some((m) => m.id === newMessage.id)) {
                  return prev;
                }
                return [...prev, newMessage];
              });
            }
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "messages",
              filter: `room_id=eq.${roomId}`,
            },
            (payload) => {
              console.log("Messages deleted:", payload);
              // When any message is deleted, clear all (vaporize)
              setMessages([]);
            }
          )
          .subscribe((status, err) => {
            console.log("Realtime subscription status:", status, err);
            if (status === "SUBSCRIBED") {
              setConnected(true);
            } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
              setConnected(false);
              if (err) {
                console.error("Realtime subscription error:", err);
              }
            } else if (status === "TIMED_OUT") {
              console.error("Realtime subscription timed out");
              setConnected(false);
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error("Error loading room:", error);
        setJoinError("Failed to load room.");
        setLoading(false);
      }
    }

    loadRoom();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, sessionId, router]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const handleSend = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || !sessionId) return;

      try {
        const res = await fetch(`/api/rooms/${roomId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, content: text }),
        });

        if (!res.ok) {
          const data = await res.json();
          setJoinError(data.error || "Failed to send message");
          return;
        }

        setInput("");
      } catch (error) {
        console.error("Error sending message:", error);
        setJoinError("Failed to send message");
      }
    },
    [input, sessionId, roomId]
  );

  const handleVaporize = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(
        `/api/rooms/${roomId}/messages?sessionId=${sessionId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        setJoinError(data.error || "Failed to clear messages");
      }
    } catch (error) {
      console.error("Error clearing messages:", error);
      setJoinError("Failed to clear messages");
    }
  }, [sessionId, roomId]);

  const handleExit = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(`/api/rooms/${roomId}/exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (res.ok) {
        router.replace("/create");
      } else {
        const data = await res.json();
        setJoinError(data.error || "Failed to exit room");
      }
    } catch (error) {
      console.error("Error exiting room:", error);
      // Still navigate away even if API call fails
      router.replace("/create");
    }
  }, [sessionId, roomId, router]);

  const handleCopyLink = useCallback(async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join?room=${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  }, [roomId]);

  if (!sessionId) {
    return null;
  }

  const isYou = (senderId: string) => senderId === sessionId;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col px-6 py-8">
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-medium tracking-tight text-[var(--vapor-charcoal)]">
              You Are Now in Room: {roomName || "…"}
            </h1>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs ${connected ? "text-emerald-600" : "text-[var(--vapor-warm-gray)]"}`}
              >
                {connected ? "Connected" : loading ? "Loading…" : "Disconnected"}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-lg border border-[var(--vapor-stone)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--vapor-charcoal)] transition-colors hover:bg-[var(--vapor-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2"
              >
                {linkCopied ? "Copied!" : "Copy room link"}
              </button>
            </div>
          </div>

          {joinError && (
            <p
              className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
              role="alert"
            >
              {joinError}.{" "}
              <button
                type="button"
                onClick={() => router.replace(`/join?room=${roomId}`)}
                className="font-medium underline underline-offset-2"
              >
                Join again
              </button>
            </p>
          )}

          {loading ? (
            <div className="mb-6 flex min-h-0 flex-1 items-center justify-center">
              <p className="text-sm text-[var(--vapor-warm-gray)]">
                Loading room…
              </p>
            </div>
          ) : (
            <div
              ref={listRef}
              className="mb-6 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-4"
            >
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--vapor-warm-gray)]">
                  No messages yet. Say something or share the room link for others
                  to join.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isYou(m.sender_id) ? "items-end" : "items-start"}`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        isYou(m.sender_id)
                          ? "text-[var(--vapor-amber)]"
                          : "text-[var(--vapor-warm-gray)]"
                      }`}
                    >
                      {isYou(m.sender_id)
                        ? `${m.sender_name} (You)`
                        : m.sender_name}
                    </span>
                    <div
                      className={`mt-0.5 max-w-[85%] rounded-lg px-3 py-2 ${
                        isYou(m.sender_id)
                          ? "bg-[var(--vapor-charcoal)] text-white"
                          : "bg-[var(--vapor-bg)] text-[var(--vapor-charcoal)]"
                      }`}
                    >
                      <p className="text-sm">{m.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label htmlFor="room-message" className="sr-only">
                Type your message
              </label>
              <input
                id="room-message"
                type="text"
                placeholder="Type your message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-3 text-[var(--vapor-charcoal)] placeholder:text-[var(--vapor-warm-gray)] focus:border-[var(--vapor-amber)] focus:outline-none focus:ring-1 focus:ring-[var(--vapor-amber)]"
                autoComplete="off"
                disabled={!!joinError || loading}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExit}
                disabled={!!joinError || loading}
                className="rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-2 text-sm font-medium text-[var(--vapor-charcoal)] transition-colors hover:bg-[var(--vapor-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2 disabled:opacity-60"
              >
                Exit Room
              </button>
              <button
                type="button"
                onClick={handleVaporize}
                disabled={!!joinError || loading}
                className="rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-2 text-sm font-medium text-[var(--vapor-charcoal)] transition-colors hover:bg-[var(--vapor-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2 disabled:opacity-60"
              >
                Vaporize History
              </button>
              <button
                type="submit"
                disabled={!!joinError || loading}
                className="rounded-lg bg-[var(--vapor-charcoal)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2 disabled:opacity-60"
              >
                Send Message
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
