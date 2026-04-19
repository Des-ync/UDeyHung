/**
 * /walkin/[restaurantSlug]/queue?id=[entryId]
 *
 * Live queue position tracker for a walk-in guest.
 * Uses Server-Sent Events to push real-time updates.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { QueueTracker } from "./QueueTracker";

export const metadata: Metadata = { title: "Your Queue Position — TableGH" };

interface Props {
  searchParams: Promise<{ id?: string }>;
  params: Promise<{ restaurantSlug: string }>;
}

export default async function QueuePage({ searchParams, params }: Props) {
  const { id } = await searchParams;
  const { restaurantSlug } = await params;

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Suspense fallback={<QueueSkeleton />}>
          {id ? (
            <QueueTracker entryId={id} restaurantSlug={restaurantSlug} />
          ) : (
            <div className="text-center py-16 text-sm text-[#8B8680]">
              Invalid link. Please scan the QR code again.
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 bg-[#E8E5E0] rounded w-1/2 mx-auto" />
      <div className="h-32 bg-[#E8E5E0] rounded-2xl" />
      <div className="h-4 bg-[#E8E5E0] rounded w-3/4 mx-auto" />
    </div>
  );
}
