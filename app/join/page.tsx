import { Suspense } from "react";
import { JoinClient } from "./JoinClient";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <p className="text-sm text-[var(--vapor-warm-gray)]">Loading…</p>
        </div>
      }
    >
      <JoinClient />
    </Suspense>
  );
}
