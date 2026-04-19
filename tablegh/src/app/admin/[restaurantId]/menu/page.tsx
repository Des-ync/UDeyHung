import type { Metadata } from "next";
import { MenuEditor } from "@/components/admin/MenuEditor";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return <MenuEditor restaurantId={restaurantId} />;
}
