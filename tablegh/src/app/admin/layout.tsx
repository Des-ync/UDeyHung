import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/AdminNav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s | TableGH Admin", default: "Admin | TableGH" },
  robots: "noindex, nofollow",
};

/**
 * Admin layout — verifies the signed-in user is RESTAURANT_OWNER or RESTAURANT_STAFF
 * for at least one restaurant. Attaches the restaurant list to context via searchParams
 * (actual restaurant selection happens in child pages via [restaurantId] param).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in?redirect_url=/admin");

  const user = await db.user.findUnique({
    where: { clerkId },
    include: {
      staffRoles: {
        include: {
          restaurant: {
            select: { id: true, name: true, slug: true, isActive: true },
          },
        },
        where: {
          restaurant: { isActive: true, deletedAt: null },
        },
      },
    },
  });

  if (!user) redirect("/sign-in");

  const isGlobalAdmin = user.role === "ADMIN";
  const managedRestaurants = user.staffRoles.map((r) => r.restaurant);

  // Redirect regular diners with no staff roles
  if (!isGlobalAdmin && managedRestaurants.length === 0) {
    redirect("/?error=no_admin_access");
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] flex">
      <AdminNav
        restaurants={managedRestaurants}
        userName={user.name}
        isGlobalAdmin={isGlobalAdmin}
      />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
