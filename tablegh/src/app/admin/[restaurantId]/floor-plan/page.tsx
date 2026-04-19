import type { Metadata } from "next";
import { FloorPlanEditor } from "@/components/admin/FloorPlanEditor";

export const metadata: Metadata = { title: "Floor Plan" };

export default async function FloorPlanPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return <FloorPlanEditor restaurantId={restaurantId} />;
}
