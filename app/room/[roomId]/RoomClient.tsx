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
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map()); // sessionId -> displayName
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);

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

        // Store current user's display name for typing indicators
        setCurrentUserDisplayName(session.display_name);

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
            async (payload) => {
              console.log("Messages deleted:", payload);
              // When any message is deleted, check if all are gone
              // Supabase might not fire events for bulk deletes, so we check the table
              const { data: remainingMessages } = await supabase
                .from("messages")
                .select("id")
                .eq("room_id", roomId)
                .limit(1);
              
              // If no messages remain, clear the UI
              if (!remainingMessages || remainingMessages.length === 0) {
                setMessages([]);
              } else {
                // If some messages remain, reload all to sync
                const { data: allMessages } = await supabase
                  .from("messages")
                  .select("*")
                  .eq("room_id", roomId)
                  .order("sent_at", { ascending: true });
                if (allMessages) setMessages(allMessages);
              }
            }
          )
          .on(
            "broadcast",
            { event: "vaporize" },
            (payload) => {
              console.log("Vaporize broadcast received:", payload);
              // Clear all messages when vaporize event is broadcast
              setMessages([]);
            }
          )
          .on(
            "broadcast",
            { event: "typing" },
            (payload) => {
              const { sessionId: typingSessionId, displayName, isTyping } = payload.payload || {};
              // Don't show typing indicator for yourself
              if (typingSessionId === sessionId) return;

              setTypingUsers((prev) => {
                const next = new Map(prev);
                if (isTyping) {
                  next.set(typingSessionId, displayName);
                } else {
                  next.delete(typingSessionId);
                }
                return next;
              });
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
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (channelRef.current) {
        // Send typing stop before leaving
        if (sessionId && currentUserDisplayName) {
          channelRef.current
            .send({
              type: "broadcast",
              event: "typing",
              payload: {
                sessionId,
                displayName: currentUserDisplayName,
                isTyping: false,
              },
            })
            .catch(() => {});
        }
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, sessionId, router, currentUserDisplayName]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);


  const handleSend = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || !sessionId) return;

      // Stop typing indicator when sending
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: "broadcast",
            event: "typing",
            payload: {
              sessionId,
              displayName: currentUserDisplayName,
              isTyping: false,
            },
          });
        } catch (err) {
          console.warn("Failed to send typing stop:", err);
        }
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

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
    [input, sessionId, roomId, currentUserDisplayName]
  );

  const handleVaporize = useCallback(async () => {
    if (!sessionId || !channelRef.current) return;

    try {
      // Optimistically clear messages immediately (better UX)
      setMessages([]);

      const res = await fetch(
        `/api/rooms/${roomId}/messages?sessionId=${sessionId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        setJoinError(data.error || "Failed to clear messages");
        // Reload messages if deletion failed
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });
        if (messagesData) setMessages(messagesData);
      } else {
        // Broadcast vaporize event to other clients in the room
        // This ensures real-time updates for other users
        try {
          await channelRef.current.send({
            type: "broadcast",
            event: "vaporize",
            payload: { roomId, timestamp: Date.now() },
          });
        } catch (broadcastError) {
          // Non-critical - deletion succeeded, broadcast is just for real-time UX
          console.warn("Broadcast error (non-critical):", broadcastError);
        }
      }
    } catch (error) {
      console.error("Error clearing messages:", error);
      setJoinError("Failed to clear messages");
      // Reload messages if deletion failed
      try {
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });
        if (messagesData) setMessages(messagesData);
      } catch (reloadError) {
        console.error("Error reloading messages:", reloadError);
      }
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

          {/* Typing indicators */}
          {typingUsers.size > 0 && (
            <div className="mb-2 flex items-center gap-2 px-2">
              <div className="flex gap-1">
                <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--vapor-amber)]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--vapor-amber)] delay-75" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--vapor-amber)] delay-150" />
              </div>
              <p className="text-xs text-[var(--vapor-warm-gray)] italic">
                {typingUsers.size === 1
                  ? `${Array.from(typingUsers.values())[0]} is typing...`
                  : typingUsers.size === 2
                    ? `${Array.from(typingUsers.values()).join(" and ")} are typing...`
                    : `${Array.from(typingUsers.values())[0]} and ${typingUsers.size - 1} others are typing...`}
              </p>
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
                onChange={(e) => {
                  setInput(e.target.value);
                  // Broadcast typing indicator
                  const now = Date.now();
                  // Throttle typing broadcasts (max once per 1 second)
                  if (now - lastTypingBroadcastRef.current > 1000 && channelRef.current) {
                    lastTypingBroadcastRef.current = now;
                    channelRef.current
                      .send({
                        type: "broadcast",
                        event: "typing",
                        payload: {
                          sessionId,
                          displayName: currentUserDisplayName,
                          isTyping: true,
                        },
                      })
                      .catch((err) => console.warn("Failed to send typing:", err));
                  }

                  // Clear existing timeout
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }

                  // Set timeout to stop typing indicator after 3 seconds of inactivity
                  typingTimeoutRef.current = setTimeout(() => {
                    if (channelRef.current) {
                      channelRef.current
                        .send({
                          type: "broadcast",
                          event: "typing",
                          payload: {
                            sessionId,
                            displayName: currentUserDisplayName,
                            isTyping: false,
                          },
                        })
                        .catch((err) => console.warn("Failed to send typing stop:", err));
                    }
                    typingTimeoutRef.current = null;
                  }, 3000);
                }}
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
