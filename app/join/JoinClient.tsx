"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUID(s: string): boolean {
  return UUID_RE.test((s || "").trim());
}

function extractRoomFromUrl(s: string): string | null {
  const t = (s || "").trim();
  const match = t.match(/[?&]room=([^&]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

export function JoinClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomFromUrl = searchParams.get("room") ?? "";

  const [roomInput, setRoomInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (roomFromUrl) setRoomInput(roomFromUrl);
  }, [roomFromUrl]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedRoom = roomInput.trim();
    const trimmedDisplay = displayName.trim();
    const trimmedPassword = password.trim();

    if (!trimmedRoom) {
      setError("Please specify the room you want to join (ID or name).");
      setLoading(false);
      return;
    }
    if (!trimmedDisplay) {
      setError("Please specify your display name.");
      setLoading(false);
      return;
    }
    if (!trimmedPassword) {
      setError("Please specify the room password.");
      setLoading(false);
      return;
    }

    try {
      const roomFromPaste = extractRoomFromUrl(trimmedRoom);
      const roomIdOrName = roomFromPaste ?? trimmedRoom;
      const body: Record<string, string> = {
        password: trimmedPassword,
        displayName: trimmedDisplay,
      };
      if (isUUID(roomIdOrName)) body.roomId = roomIdOrName;
      else body.roomName = roomIdOrName;

      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join room");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        sessionId: data.sessionId,
        displayName: trimmedDisplay,
        roomName: data.roomName || trimmedRoom,
      });
      router.push(`/room/${data.roomId}?${params.toString()}`);
    } catch {
      setError("Could not reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-medium tracking-tight text-[var(--vapor-charcoal)]">
              Join a Room
            </h1>
            <p className="mt-2 text-sm text-[var(--vapor-warm-gray)]">
              Enter the room ID or name, password, and your display name. Use
              the link shared with you to pre-fill the room.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p
                className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
                role="alert"
              >
                {error}
              </p>
            )}

            <div>
              <label htmlFor="join-room" className="sr-only">
                Room ID or Name
              </label>
              <input
                id="join-room"
                type="text"
                placeholder="Room ID or Name (or paste shared link)"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="w-full rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-3 text-[var(--vapor-charcoal)] placeholder:text-[var(--vapor-warm-gray)] focus:border-[var(--vapor-amber)] focus:outline-none focus:ring-1 focus:ring-[var(--vapor-amber)]"
                autoComplete="off"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="join-password" className="sr-only">
                Specify Password
              </label>
              <input
                id="join-password"
                type="password"
                placeholder="Specify Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-3 text-[var(--vapor-charcoal)] placeholder:text-[var(--vapor-warm-gray)] focus:border-[var(--vapor-amber)] focus:outline-none focus:ring-1 focus:ring-[var(--vapor-amber)]"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="join-display-name" className="sr-only">
                Specify Your Display Name
              </label>
              <input
                id="join-display-name"
                type="text"
                placeholder="Specify Your Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-3 text-[var(--vapor-charcoal)] placeholder:text-[var(--vapor-warm-gray)] focus:border-[var(--vapor-amber)] focus:outline-none focus:ring-1 focus:ring-[var(--vapor-amber)]"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--vapor-charcoal)] px-4 py-3 font-medium text-white transition-colors hover:bg-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2 disabled:opacity-60"
            >
              {loading ? "Joining…" : "Join"}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
