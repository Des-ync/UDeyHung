/**
 * POST /api/v1/payments/deposit — Initiate a deposit payment
 * Supports card (via Paystack redirect) and MoMo (direct charge).
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  badRequest,
  unauthorized,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";
import { initiateDepositSchema } from "@/lib/validations";
import {
  initializeTransaction,
  chargeMoMo,
} from "@/lib/payments/paystack";
import { detectMoMoNetwork } from "@/lib/utils/phone";
import { ReservationStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const body: unknown = await req.json();
  const parsed = parseBody(initiateDepositSchema, body);
  if (!parsed.success) return parsed.response;

  const { reservationId, paymentMethod, momoPhone } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized();

    const reservation = await db.reservation.findUnique({
      where: { id: reservationId },
      include: { restaurant: { select: { name: true } } },
    });

    if (!reservation) return badRequest("Reservation not found");
    if (reservation.userId !== user.id) {
      return badRequest("Reservation does not belong to this user");
    }
    if (!reservation.depositRequired || !reservation.depositPesewas) {
      return badRequest("No deposit required for this reservation");
    }
    if (reservation.depositPaid) {
      return badRequest("Deposit already paid");
    }
    if (reservation.status !== ReservationStatus.PENDING) {
      return badRequest("Reservation is not in a payable state");
    }

    // Unique payment reference: TGH-PAY-{uuid8}
    const providerRef = `TGH-PAY-${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    const callbackUrl = `${process.env["NEXT_PUBLIC_APP_URL"]}/booking/${reservation.ref}?payment=success`;

    if (paymentMethod === "card") {
      // Paystack hosted checkout
      const result = await initializeTransaction({
        email: user.email ?? `${user.phone.replace("+", "")}@tablegh.app`,
        amountPesewas: reservation.depositPesewas,
        reference: providerRef,
        callbackUrl,
        metadata: {
          reservationId: reservation.id,
          reservationRef: reservation.ref,
          userId: user.id,
          type: "deposit",
        },
        channels: ["card", "bank_transfer"],
      });

      // Create pending payment record
      await db.payment.create({
        data: {
          reservationId: reservation.id,
          userId: user.id,
          amountPesewas: reservation.depositPesewas,
          provider: "PAYSTACK",
          providerRef,
          status: "PENDING",
        },
      });

      return ok({
        paymentMethod: "card",
        authorizationUrl: result.authorizationUrl,
        reference: providerRef,
      });
    } else {
      // MoMo direct charge
      if (!momoPhone) return badRequest("MoMo phone required");

      const network = detectMoMoNetwork(momoPhone);
      if (!network) return badRequest("Unrecognised MoMo network for phone number");

      const chargeResult = await chargeMoMo({
        email: user.email ?? `${user.phone.replace("+", "")}@tablegh.app`,
        amountPesewas: reservation.depositPesewas,
        reference: providerRef,
        phone: momoPhone,
        network,
      });

      await db.payment.create({
        data: {
          reservationId: reservation.id,
          userId: user.id,
          amountPesewas: reservation.depositPesewas,
          provider: "PAYSTACK",
          providerRef,
          status: "PENDING",
          momoNetwork: network,
          momoPhone,
        },
      });

      return ok({
        paymentMethod: "momo",
        status: chargeResult.status,
        reference: providerRef,
        displayText: chargeResult.displayText,
        // "pending" = user approves on phone; webhook confirms
      });
    }
  } catch (err) {
    console.error("Initiate deposit error:", err);
    return serverError();
  }
}
