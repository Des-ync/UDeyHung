import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DinerDashboard } from "@/components/diner/DinerDashboard";

export const metadata: Metadata = { title: "My Bookings" };

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/dashboard");
  return <DinerDashboard />;
}
