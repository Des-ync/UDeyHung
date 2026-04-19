import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/** Root /admin — redirect to first managed restaurant's dashboard */
export default async function AdminRootPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkId },
    include: {
      staffRoles: {
        include: { restaurant: { select: { id: true } } },
        take: 1,
      },
    },
  });

  if (user?.role === "ADMIN") {
    // Global admin: show all restaurants list (stub — expand in v2)
    redirect("/admin/restaurants");
  }

  const firstRestaurant = user?.staffRoles[0]?.restaurant;
  if (firstRestaurant) {
    redirect(`/admin/${firstRestaurant.id}/dashboard`);
  }

  redirect("/");
}
