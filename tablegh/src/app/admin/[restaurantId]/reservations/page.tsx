import type { Metadata } from "next";
import { ReservationCalendar } from "@/components/admin/ReservationCalendar";

export const metadata: Metadata = { title: "Reservations" };

export default async function AdminReservationsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return <ReservationCalendar restaurantId={restaurantId} />;
}
