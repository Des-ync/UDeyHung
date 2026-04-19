/**
 * Slot availability logic for TableGH.
 *
 * Key concepts:
 * - Time stored as "minutes since midnight" (e.g., 720 = 12:00, 1320 = 22:00)
 * - Timezone: Africa/Accra (GMT+0, no DST — use date-fns-tz to be explicit)
 * - Turn time: how long a table is occupied per reservation (default 90 min)
 * - A table is "occupied" from [timeSlot, timeSlot + turnTime)
 * - Slots generated in 30-min increments between open and (close - turnTime)
 */

import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { addMinutes, isSameDay } from "date-fns";

export const ACCRA_TZ = "Africa/Accra";
export const SLOT_INCREMENT_MINUTES = 30;

export interface TableConfig {
  id: string;
  capacity: number;
  maxGuests: number;
  minGuests: number;
}

export interface ExistingReservation {
  tableId: string;
  timeSlot: number; // minutes since midnight
  turnTime: number; // minutes
}

export interface SlotAvailability {
  timeSlot: number; // minutes since midnight
  displayTime: string; // "7:30 PM"
  availableTables: TableConfig[];
  totalCapacity: number;
  isAvailable: boolean;
}

/**
 * Convert minutes-since-midnight to display string.
 * Uses 12-hour format as is standard in Ghana.
 */
export function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h < 12 ? "AM" : "PM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m.toString().padStart(2, "0");
  return `${displayH}:${displayM} ${period}`;
}

/**
 * Convert a Date + time slot (minutes) to a full DateTime in Africa/Accra.
 * Used for reminder scheduling, deposit refund windows, etc.
 */
export function slotToDateTime(date: Date, timeSlotMinutes: number): Date {
  const zonedDate = toZonedTime(date, ACCRA_TZ);
  const year = zonedDate.getFullYear();
  const month = String(zonedDate.getMonth() + 1).padStart(2, "0");
  const day = String(zonedDate.getDate()).padStart(2, "0");
  const h = Math.floor(timeSlotMinutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (timeSlotMinutes % 60).toString().padStart(2, "0");
  // Build ISO string in Accra timezone
  const isoString = `${year}-${month}-${day}T${h}:${m}:00`;
  return fromZonedTime(isoString, ACCRA_TZ);
}

/**
 * Get current time in Accra as minutes-since-midnight.
 * Used for "open now" indicator.
 */
export function nowAccraMinutes(): number {
  const now = toZonedTime(new Date(), ACCRA_TZ);
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Check if a restaurant is currently open given its operating hours.
 * @param openTime  minutes since midnight
 * @param closeTime minutes since midnight
 */
export function isOpenNow(openTime: number, closeTime: number): boolean {
  const currentMinutes = nowAccraMinutes();
  // Handle overnight hours (e.g., open 22:00 → close 02:00)
  if (closeTime < openTime) {
    return currentMinutes >= openTime || currentMinutes < closeTime;
  }
  return currentMinutes >= openTime && currentMinutes < closeTime;
}

/**
 * Generate available time slots for a restaurant on a given date.
 *
 * Algorithm:
 * 1. Get operating hours for that day of week.
 * 2. Generate candidate slots every 30 min from openTime to (closeTime - turnTime).
 * 3. For each slot, find tables not occupied by [slot, slot + turnTime).
 * 4. Filter by party size (table.minGuests <= partySize <= table.maxGuests).
 * 5. Return slot with count of available tables.
 */
export function generateAvailableSlots(params: {
  openTime: number; // minutes since midnight
  closeTime: number;
  turnTime: number; // minutes per booking
  tables: TableConfig[];
  existingReservations: ExistingReservation[];
  partySize: number;
  isToday: boolean; // if true, filter out past slots
}): SlotAvailability[] {
  const {
    openTime,
    closeTime,
    turnTime,
    tables,
    existingReservations,
    partySize,
    isToday,
  } = params;

  const slots: SlotAvailability[] = [];
  const currentMinutes = isToday ? nowAccraMinutes() : -1;

  // Last slot must allow the turn time to complete before closing
  const lastSlotStart = closeTime - turnTime;

  for (
    let slot = openTime;
    slot <= lastSlotStart;
    slot += SLOT_INCREMENT_MINUTES
  ) {
    // Skip past slots if booking for today
    if (isToday && slot <= currentMinutes) continue;

    const slotEnd = slot + turnTime;

    // Find tables not occupied during [slot, slotEnd)
    const availableTables = tables.filter((table) => {
      // Check party size compatibility
      if (partySize < table.minGuests || partySize > table.maxGuests) {
        return false;
      }

      // Check no existing reservation occupies this table during this slot
      const isOccupied = existingReservations.some((res) => {
        if (res.tableId !== table.id) return false;
        const resEnd = res.timeSlot + res.turnTime;
        // Occupied if intervals overlap: [slot, slotEnd) ∩ [res.timeSlot, resEnd) ≠ ∅
        return slot < resEnd && slotEnd > res.timeSlot;
      });

      return !isOccupied;
    });

    slots.push({
      timeSlot: slot,
      displayTime: minutesToDisplay(slot),
      availableTables,
      totalCapacity: availableTables.reduce((sum, t) => sum + t.maxGuests, 0),
      isAvailable: availableTables.length > 0,
    });
  }

  return slots;
}

/**
 * Select the best table for a given party size.
 * Strategy: smallest table that can fit the party (minimize wasted capacity).
 */
export function selectBestTable(
  availableTables: TableConfig[],
  partySize: number
): TableConfig | null {
  const fitting = availableTables.filter(
    (t) => t.minGuests <= partySize && t.maxGuests >= partySize
  );
  if (fitting.length === 0) return null;
  // Sort by maxGuests ascending → pick smallest fitting table
  fitting.sort((a, b) => a.maxGuests - b.maxGuests);
  return fitting[0] ?? null;
}

/**
 * Format a date for display in Ghanaian convention: DD/MM/YYYY
 */
export function formatDateGH(date: Date): string {
  return formatInTimeZone(date, ACCRA_TZ, "dd/MM/yyyy");
}

/**
 * Format date and time for booking confirmations.
 */
export function formatBookingDateTime(
  date: Date,
  timeSlotMinutes: number
): string {
  const dateStr = formatDateGH(date);
  const timeStr = minutesToDisplay(timeSlotMinutes);
  return `${dateStr} at ${timeStr}`;
}

/**
 * Generate booking reference code: TGH-XXXXXX
 * 6 uppercase alphanumeric characters (A-Z, 0-9) = 36^6 ≈ 2.1B combinations.
 */
export function generateBookingRef(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "TGH-";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
