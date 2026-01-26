"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: Date;
};

function uuid(): string {
  return (
    crypto.randomUUID?.() ??
    `t-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

type RoomClientProps = { roomId: string };

export function RoomClient({ roomId }: RoomClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomName = searchParams.get("roomName") ?? roomId.replace(/-/g, " ");
  const displayName = searchParams.get("displayName") ?? "Guest";

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: uuid(),
      senderId: "other",
      senderName: "Karmaggedon2",
      content: "short all of the energy stocks",
      sentAt: new Date(Date.now() - 120_000),
    },
    {
      id: uuid(),
      senderId: "me",
      senderName: displayName,
      content: "Can you give me more information?",
      sentAt: new Date(Date.now() - 60_000),
    },
    {
      id: uuid(),
      senderId: "other",
      senderName: "Karmaggedon2",
      content: "Sure, I'll send the details.",
      sentAt: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef("me");

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const handleSend = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text) return;
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          senderId: sessionId.current,
          senderName: displayName,
          content: text,
          sentAt: new Date(),
        },
      ]);
      setInput("");
    },
    [displayName, input]
  );

  const handleVaporize = useCallback(() => {
    setMessages([]);
  }, []);

  const handleExit = useCallback(() => {
    router.push("/create");
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col px-6 py-8">
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
          <h1 className="mb-6 text-xl font-medium tracking-tight text-[var(--vapor-charcoal)]">
            You Are Now in Room: {roomName}
          </h1>

          <div
            ref={listRef}
            className="mb-6 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-4"
          >
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--vapor-warm-gray)]">
                No messages yet. Say something to get started.
              </p>
            ) : (
              messages.map((m) => {
                const isYou = m.senderId === sessionId.current;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isYou ? "items-end" : "items-start"}`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        isYou
                          ? "text-[var(--vapor-amber)]"
                          : "text-[var(--vapor-warm-gray)]"
                      }`}
                    >
                      {isYou ? `${m.senderName} (You)` : m.senderName}
                    </span>
                    <div
                      className={`mt-0.5 max-w-[85%] rounded-lg px-3 py-2 ${
                        isYou
                          ? "bg-[var(--vapor-charcoal)] text-white"
                          : "bg-[var(--vapor-bg)] text-[var(--vapor-charcoal)]"
                      }`}
                    >
                      <p className="text-sm">{m.content}</p>
                    </div>
                  </div>
                );
              })
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
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExit}
                className="rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-2 text-sm font-medium text-[var(--vapor-charcoal)] transition-colors hover:bg-[var(--vapor-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2"
              >
                Exit Room
              </button>
              <button
                type="button"
                onClick={handleVaporize}
                className="rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-2 text-sm font-medium text-[var(--vapor-charcoal)] transition-colors hover:bg-[var(--vapor-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2"
              >
                Vaporize History
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[var(--vapor-charcoal)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2"
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
