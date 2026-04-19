import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { WalkInQRCode } from "@/components/admin/WalkInQRCode";

export const metadata: Metadata = { title: "Walk-In Queue" };

interface Props {
  params: Promise<{ restaurantId: string }>;
}

export default async function WalkInPage({ params }: Props) {
  const { restaurantId } = await params;

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, slug: true },
  });

  if (!restaurant) notFound();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-[#1A1A1A]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          Walk-In Queue
        </h1>
        <p className="text-sm text-[#8B8680] mt-1">
          Share the QR code at your entrance so walk-in guests can join the
          queue from their phones.
        </p>
      </div>

      <WalkInQRCode
        restaurantId={restaurant.id}
        restaurantSlug={restaurant.slug}
        restaurantName={restaurant.name}
      />
    </div>
  );
}
