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
  room_id: string;
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
        console.log("Loading messages for room:", roomId);
        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });

        if (messagesError) {
          console.error("Error loading messages:", messagesError);
          console.error("Error details:", JSON.stringify(messagesError, null, 2));
          setJoinError(`Failed to load messages: ${messagesError.message || "Unknown error"}`);
        } else {
          console.log("Loaded messages:", messagesData?.length || 0, messagesData);
          if (messagesData) {
            setMessages(messagesData);
          } else {
            console.warn("messagesData is null or undefined");
            setMessages([]);
          }
        }

        setConnected(true);
        setLoading(false);

        // Subscribe to new messages
        // Use broadcast as primary mechanism (more reliable than postgres_changes)
        // postgres_changes may have binding issues, but broadcasts always work
        const channel = supabase
          .channel(`room:${roomId}`, {
            config: {
              broadcast: { self: true },
            },
          });

        // Try postgres_changes for INSERT (optional - broadcasts will handle it if this fails)
        // Note: Filter removed to avoid binding mismatch errors - we filter in callback instead
        channel.on<Message>(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            console.log("New message received via postgres_changes:", payload);
            const newMessage = payload.new as Message;
            // Filter by room_id in callback to avoid binding mismatch
            if (newMessage.room_id === roomId) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMessage.id)) {
                  return prev;
                }
                return [...prev, newMessage];
              });
            }
          }
        );

        // Broadcast events (primary mechanism - always works)
        channel
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
              console.log("Typing broadcast received:", payload);
              const { sessionId: typingSessionId, displayName, isTyping } = payload.payload || {};
              
              // Validate payload
              if (!typingSessionId || !displayName) {
                console.warn("Invalid typing payload:", payload);
                return;
              }
              
              // Don't show typing indicator for yourself
              if (typingSessionId === sessionId) {
                console.log("Ignoring own typing indicator");
                return;
              }

              console.log(`Typing update: ${displayName} is ${isTyping ? "typing" : "not typing"}`);

              setTypingUsers((prev) => {
                const next = new Map(prev);
                if (isTyping) {
                  next.set(typingSessionId, displayName);
                } else {
                  next.delete(typingSessionId);
                }
                console.log("Typing users updated:", Array.from(next.entries()));
                return next;
              });
            }
          )
          .on(
            "broadcast",
            { event: "new-message" },
            (payload) => {
              // Primary mechanism: broadcast for new messages (more reliable)
              console.log("New message via broadcast:", payload);
              const newMessage = payload.payload as Message;
              // No need to check room_id - we're already on a room-specific channel
              if (newMessage && newMessage.id) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMessage.id)) {
                    return prev;
                  }
                  return [...prev, newMessage];
                });
              }
            }
          )
          .subscribe((status, err) => {
            console.log("Realtime subscription status:", status, err);
            if (status === "SUBSCRIBED") {
              console.log("✅ Realtime channel subscribed - broadcasts will work");
              setConnected(true);
            } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
              setConnected(false);
              if (err) {
                console.error("Realtime subscription error:", err);
                // Binding mismatch errors are warnings - broadcasts still work
                if (err.message?.includes("mismatch") || err.message?.includes("binding")) {
                  console.warn("postgres_changes binding error (non-critical). Broadcasts will still work.");
                  // Still mark as connected since broadcasts work
                  setConnected(true);
                }
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
      if (channelRef.current && sessionId && currentUserDisplayName && connected) {
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
          console.log("Typing stop sent on message send");
        } catch (err) {
          console.warn("Failed to send typing stop:", err);
        }
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // Optimistically add message immediately (better UX)
      const tempMessageId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempMessageId,
        room_id: roomId,
        sender_id: sessionId,
        sender_name: currentUserDisplayName,
        content: text,
        sent_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      setInput("");

      try {
        const res = await fetch(`/api/rooms/${roomId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, content: text }),
        });

        if (!res.ok) {
          const data = await res.json();
          setJoinError(data.error || "Failed to send message");
          // Remove optimistic message on error
          setMessages((prev) => prev.filter((m) => m.id !== tempMessageId));
          setInput(text); // Restore input
          return;
        }

        // Reload messages to get the real message from DB (replaces optimistic one)
        // This ensures we have the correct ID and timestamp
        const { data: updatedMessages } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("sent_at", { ascending: true });
        if (updatedMessages) {
          setMessages(updatedMessages);
        }
      } catch (error) {
        console.error("Error sending message:", error);
        setJoinError("Failed to send message");
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempMessageId));
        setInput(text); // Restore input
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
                <div className="py-8 text-center">
                  <p className="text-sm text-[var(--vapor-warm-gray)]">
                    No messages yet. Say something or share the room link for others
                    to join.
                  </p>
                  {/* Debug info - remove in production */}
                  {process.env.NODE_ENV === "development" && (
                    <p className="mt-2 text-xs text-[var(--vapor-warm-gray)] opacity-50">
                      Debug: messages array length = {messages.length}
                    </p>
                  )}
                </div>
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
                  
                  // Only send typing if we have all required data and channel is connected
                  if (!sessionId || !currentUserDisplayName || !channelRef.current || !connected) {
                    return;
                  }

                  // Broadcast typing indicator
                  const now = Date.now();
                  // Throttle typing broadcasts (max once per 1 second)
                  if (now - lastTypingBroadcastRef.current > 1000) {
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
                      .then(() => {
                        console.log("Typing indicator sent:", currentUserDisplayName);
                      })
                      .catch((err) => {
                        console.warn("Failed to send typing:", err);
                      });
                  }

                  // Clear existing timeout
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }

                  // Set timeout to stop typing indicator after 3 seconds of inactivity
                  typingTimeoutRef.current = setTimeout(() => {
                    if (channelRef.current && sessionId && currentUserDisplayName) {
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
                        .then(() => {
                          console.log("Typing stop sent:", currentUserDisplayName);
                        })
                        .catch((err) => {
                          console.warn("Failed to send typing stop:", err);
                        });
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
