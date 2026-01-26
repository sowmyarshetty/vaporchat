import { Suspense } from "react";
import { RoomClient } from "./RoomClient";

type RoomPageProps = { params: Promise<{ roomId: string }> };

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <p className="text-sm text-[var(--vapor-warm-gray)]">
            Loading room…
          </p>
        </div>
      }
    >
      <RoomClient roomId={roomId} />
    </Suspense>
  );
}
