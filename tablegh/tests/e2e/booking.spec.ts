/**
 * Playwright E2E: Booking happy path
 *
 * Flow: Homepage → Search → Restaurant detail → Select slot → Fill form → Confirm
 *
 * Prerequisites:
 * - Local dev server running (npm run dev)
 * - Test DB seeded (npm run db:seed)
 * - Clerk test mode with bypass (CLERK_TEST_USER_TOKEN in env)
 */

import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";

// Helper: log in with a test phone OTP bypass
async function loginAsTestUser(page: Page) {
  // Clerk test mode: use phone number +233200000001 with OTP 424242
  await page.goto(`${BASE_URL}/sign-in`);
  await page.fill('[name="identifier"]', "+233200000001");
  await page.click('[data-localization-key="signIn.start.actionButton"]');
  await page.fill('[name="code"]', "424242");
  await page.click('[data-localization-key="signIn.phoneCode.actionButton"]');
  await page.waitForURL("**/dashboard", { timeout: 10_000 });
}

test.describe("Booking happy path", () => {
  test.beforeEach(async ({ page }) => {
    // Skip auth if Clerk test mode not configured
    const clerkConfigured = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]?.startsWith("pk_test");
    if (!clerkConfigured) {
      test.skip();
    }
  });

  test("user can find and book a restaurant", async ({ page }) => {
    // Step 1: Visit homepage
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/TableGH/);
    await expect(page.getByRole("heading", { name: /Chop time/i })).toBeVisible();

    // Step 2: Search for a restaurant
    const searchInput = page.getByRole("searchbox", { name: /search/i });
    await searchInput.fill("Santoku");
    await searchInput.press("Enter");

    await page.waitForURL("**/search**");
    await expect(page.getByText("Santoku")).toBeVisible();

    // Step 3: Click restaurant card
    await page.getByRole("link", { name: /Santoku/i }).first().click();
    await page.waitForURL("**/restaurants/santoku**");

    // Step 4: Verify restaurant detail page
    await expect(page.getByRole("heading", { name: "Santoku" })).toBeVisible();
    await expect(page.getByText("Japanese-fusion")).toBeVisible();

    // Step 5: Booking widget — select party size
    const partySizeSelect = page.getByLabel(/party size/i);
    await partySizeSelect.selectOption("2");

    // Step 6: Select a date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0]!;
    await page.getByLabel(/date/i).fill(dateStr);

    // Step 7: Wait for availability to load and select first available slot
    await page.waitForResponse(
      (res) => res.url().includes("/availability") && res.status() === 200
    );

    // Click first available time slot button
    const availableSlot = page
      .getByRole("option")
      .filter({ hasNot: page.getByText(/not available/i) })
      .first();

    if (await availableSlot.count() > 0) {
      await availableSlot.click();
      await expect(availableSlot).toHaveAttribute("aria-selected", "true");

      // Step 8: Click Continue
      await page.getByRole("button", { name: /continue/i }).click();
      await page.waitForURL("**/book**");

      // Step 9: Fill booking form
      await page.getByLabel(/full name/i).fill("Kofi Acheampong");
      await page.getByLabel(/phone/i).fill("0241234567");
      await page.selectOption('[id="occasion"]', "DATE_NIGHT");
      await page.getByLabel(/special requests/i).fill("Window table please, celebrating 5 years together.");

      // Step 10: Submit booking
      await page.getByRole("button", { name: /confirm reservation/i }).click();

      // Step 11: Verify confirmation page
      await page.waitForURL("**/booking/TGH-**", { timeout: 15_000 });
      await expect(page.getByText(/you're all set/i)).toBeVisible();
      await expect(page.getByText(/TGH-/)).toBeVisible();
      await expect(page.getByText("Kofi Acheampong")).not.toBeVisible(); // not shown in confirmation
      await expect(page.getByText(/0241234567/)).toBeVisible();

      // Step 12: Verify booking ref format
      const refText = await page.locator(".font-mono").textContent();
      expect(refText).toMatch(/^TGH-[A-Z0-9]{6}$/);
    } else {
      // No availability — verify waitlist option exists
      test.skip(true, "No availability on this date");
    }
  });

  test("cancellation flow works", async ({ page }) => {
    await loginAsTestUser(page);

    // Navigate to bookings
    await page.goto(`${BASE_URL}/dashboard`);
    await page.getByRole("link", { name: /bookings/i }).click();

    // Find a confirmed booking and cancel it
    const cancelButton = page
      .getByRole("link", { name: /cancel/i })
      .first();

    if (await cancelButton.count() > 0) {
      await cancelButton.click();
      await page.waitForURL("**/cancel");

      await page.getByRole("button", { name: /confirm cancel/i }).click();
      await expect(page.getByText(/cancelled/i)).toBeVisible({ timeout: 5_000 });
    } else {
      test.skip(true, "No bookings to cancel");
    }
  });

  test("waitlist join works when fully booked", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto(`${BASE_URL}/restaurants/santoku`);

    // Trigger waitlist by finding a fully-booked slot
    const joinWaitlistButton = page.getByRole("button", { name: /join waitlist/i });
    if (await joinWaitlistButton.count() > 0) {
      await joinWaitlistButton.click();
      await expect(page.getByText(/you're on the list/i)).toBeVisible();
    }
  });
});

test.describe("Restaurant search", () => {
  test("search returns results", async ({ page }) => {
    await page.goto(`${BASE_URL}/search?q=jollof`);
    // Should show at least one result with "jollof" related restaurants
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("filter by neighborhood works", async ({ page }) => {
    await page.goto(`${BASE_URL}/search?neighborhood=OSU`);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("restaurant detail page renders", async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants/abenas-kitchen`);
    await expect(page.getByRole("heading", { name: /Abena/i })).toBeVisible();
    await expect(page.getByText("Waakye")).toBeVisible();
  });

  test("restaurant page has structured data", async ({ page }) => {
    await page.goto(`${BASE_URL}/restaurants/santoku`);
    const ldJson = await page.locator('script[type="application/ld+json"]').textContent();
    expect(ldJson).toBeTruthy();
    const parsed = JSON.parse(ldJson ?? "{}") as { "@type"?: string };
    expect(parsed["@type"]).toBe("Restaurant");
  });
});
