import type { Metadata } from "next";
import { RestaurantSettings } from "@/components/admin/RestaurantSettings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return <RestaurantSettings restaurantId={restaurantId} />;
}
