"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function CreateRoomPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const trimmedRoom = roomName.trim();
    const trimmedDisplay = displayName.trim();

    if (!trimmedRoom) {
      setError("Please specify a room name.");
      return;
    }
    if (!trimmedDisplay) {
      setError("Please specify your display name.");
      return;
    }
    if (!password.trim()) {
      setError("Please specify a password.");
      return;
    }

    const slug = slugify(trimmedRoom) || "room";
    const params = new URLSearchParams({
      displayName: trimmedDisplay,
      roomName: trimmedRoom,
    });
    router.push(`/room/${slug}?${params.toString()}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-medium tracking-tight text-[var(--vapor-charcoal)]">
              Create a Room
            </h1>
            <p className="mt-2 text-sm text-[var(--vapor-warm-gray)]">
              Set up a virtual chat room and share the link with others.
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
              <label htmlFor="create-room-name" className="sr-only">
                Specify Room Name
              </label>
              <input
                id="create-room-name"
                type="text"
                placeholder="Specify Room Name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-3 text-[var(--vapor-charcoal)] placeholder:text-[var(--vapor-warm-gray)] focus:border-[var(--vapor-amber)] focus:outline-none focus:ring-1 focus:ring-[var(--vapor-amber)]"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="create-password" className="sr-only">
                Specify Password
              </label>
              <input
                id="create-password"
                type="password"
                placeholder="Specify Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-3 text-[var(--vapor-charcoal)] placeholder:text-[var(--vapor-warm-gray)] focus:border-[var(--vapor-amber)] focus:outline-none focus:ring-1 focus:ring-[var(--vapor-amber)]"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="create-display-name" className="sr-only">
                Specify Your Display Name
              </label>
              <input
                id="create-display-name"
                type="text"
                placeholder="Specify Your Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-[var(--vapor-stone)] bg-white px-4 py-3 text-[var(--vapor-charcoal)] placeholder:text-[var(--vapor-warm-gray)] focus:border-[var(--vapor-amber)] focus:outline-none focus:ring-1 focus:ring-[var(--vapor-amber)]"
                autoComplete="username"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--vapor-charcoal)] px-4 py-3 font-medium text-white transition-colors hover:bg-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-[var(--vapor-amber)] focus:ring-offset-2"
            >
              Create
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
