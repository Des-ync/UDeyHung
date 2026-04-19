import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return <AnalyticsDashboard restaurantId={restaurantId} />;
}
