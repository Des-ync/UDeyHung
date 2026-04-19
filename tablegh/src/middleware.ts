import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes — no auth required
const isPublicRoute = createRouteMatcher([
  "/",
  "/search(.*)",
  "/restaurants/(.*)",
  "/booking/(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // API routes that are public
  "/api/v1/restaurants(.*)",
  // Webhook endpoints (skip auth — they use signature verification instead)
  "/api/v1/webhooks(.*)",
]);

// Admin routes — must be RESTAURANT_OWNER or RESTAURANT_STAFF
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Match all routes except Next.js internals and static files
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
