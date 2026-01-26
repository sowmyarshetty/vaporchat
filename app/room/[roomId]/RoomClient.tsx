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
import { disconnectSocket, getSocket } from "@/app/lib/socket";

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: number;
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
  const listRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId) {
      router.replace(`/join?room=${roomId}`);
      return;
    }
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setConnected(true);

    socket.emit("join-room", { roomId, sessionId });

    socket.on("join-ok", (payload: { roomName?: string; messages?: Message[] }) => {
      setJoinError("");
      if (payload.roomName) setRoomName(payload.roomName);
      if (Array.isArray(payload.messages)) setMessages(payload.messages);
    });

    socket.on("join-error", (payload: { error?: string }) => {
      setJoinError(payload?.error ?? "Could not join room");
    });

    socket.on("message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("messages-cleared", () => {
      setMessages([]);
    });

    socket.on("exit-ok", () => {
      disconnectSocket();
      socketRef.current = null;
      router.replace("/create");
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("join-ok");
      socket.off("join-error");
      socket.off("message");
      socket.off("messages-cleared");
      socket.off("exit-ok");
      if (socketRef.current && sessionId) {
        socket.emit("exit-room");
        disconnectSocket();
        socketRef.current = null;
      }
    };
  }, [roomId, sessionId, router]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const handleSend = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || !socketRef.current) return;
      socketRef.current.emit("send-message", { content: text });
      setInput("");
    },
    [input]
  );

  const handleVaporize = useCallback(() => {
    socketRef.current?.emit("vaporize-history");
  }, []);

  const handleExit = useCallback(() => {
    socketRef.current?.emit("exit-room");
  }, []);

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
                {connected ? "Connected" : "Connecting…"}
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

          <div
            ref={listRef}
            className="mb-6 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-4"
          >
            {messages.length === 0 && !joinError ? (
              <p className="py-8 text-center text-sm text-[var(--vapor-warm-gray)]">
                No messages yet. Say something or share the room link for others
                to join.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${isYou(m.senderId) ? "items-end" : "items-start"}`}
                >
                  <span
                    className={`text-xs font-medium ${
                      isYou(m.senderId)
                        ? "text-[var(--vapor-amber)]"
                        : "text-[var(--vapor-warm-gray)]"
                    }`}
                  >
                    {isYou(m.senderId)
                      ? `${m.senderName} (You)`
                      : m.senderName}
                  </span>
                  <div
                    className={`mt-0.5 max-w-[85%] rounded-lg px-3 py-2 ${
                      isYou(m.senderId)
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
                disabled={!!joinError}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExit}
                disabled={!!joinError}
                className="rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-2 text-sm font-medium text-[var(--vapor-charcoal)] transition-colors hover:bg-[var(--vapor-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2 disabled:opacity-60"
              >
                Exit Room
              </button>
              <button
                type="button"
                onClick={handleVaporize}
                disabled={!!joinError}
                className="rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-2 text-sm font-medium text-[var(--vapor-charcoal)] transition-colors hover:bg-[var(--vapor-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2 disabled:opacity-60"
              >
                Vaporize History
              </button>
              <button
                type="submit"
                disabled={!!joinError}
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
