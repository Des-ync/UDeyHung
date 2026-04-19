"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  User,
  Phone,
  Users,
  Clock,
  CalendarDays,
  MessageSquare,
  CreditCard,
  CheckCircle2,
  UserX,
  ChairIcon,
  Loader2,
  StickyNote,
} from "lucide-react";
import { minutesToDisplay, formatDateGH } from "@/lib/utils/slots";
import { formatGHS } from "@/lib/utils/currency";

interface Reservation {
  id: string;
  ref: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  date: string;
  timeSlot: number;
  status: string;
  occasion: string | null;
  specialReqs: string | null;
  tableLabel: string | null;
  depositRequired: boolean;
  depositPaid: boolean;
  depositPesewas: number | null;
  adminNotes: string | null;
  paymentStatus: string | null;
}

interface ReservationDetailModalProps {
  reservation: Reservation;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  isMutating: boolean;
}

const STATUS_ACTIONS: Record<
  string,
  Array<{ label: string; nextStatus: string; color: string; icon: React.ReactNode }>
> = {
  CONFIRMED: [
    {
      label: "Seat now",
      nextStatus: "SEATED",
      color: "#3B82F6",
      icon: <CheckCircle2 size={15} />,
    },
    {
      label: "Mark no-show",
      nextStatus: "NO_SHOW",
      color: "#EF4444",
      icon: <UserX size={15} />,
    },
    {
      label: "Cancel (venue)",
      nextStatus: "CANCELLED_VENUE",
      color: "#EF4444",
      icon: <X size={15} />,
    },
  ],
  SEATED: [
    {
      label: "Mark completed",
      nextStatus: "COMPLETED",
      color: "#10B981",
      icon: <CheckCircle2 size={15} />,
    },
  ],
  PENDING: [
    {
      label: "Confirm (waive deposit)",
      nextStatus: "CONFIRMED",
      color: "#10B981",
      icon: <CheckCircle2 size={15} />,
    },
    {
      label: "Cancel (venue)",
      nextStatus: "CANCELLED_VENUE",
      color: "#EF4444",
      icon: <X size={15} />,
    },
  ],
};

export function ReservationDetailModal({
  reservation: r,
  onClose,
  onStatusChange,
  isMutating,
}: ReservationDetailModalProps) {
  const qc = useQueryClient();
  const [adminNotes, setAdminNotes] = useState(r.adminNotes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);

  const notesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const res = await fetch(`/api/v1/admin/reservations/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: notes }),
      });
      if (!res.ok) throw new Error("Failed to save notes");
    },
    onSuccess: () => {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ["admin-reservations"] });
    },
  });

  const actions = STATUS_ACTIONS[r.status] ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Reservation ${r.ref}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 pt-5 pb-4 border-b border-[#E8E5E0] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-[#0F7B5A]">
                {r.ref}
              </span>
              <StatusBadge status={r.status} />
            </div>
            <h2
              className="text-xl font-bold text-[#1A1A1A]"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              {r.guestName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F5F2ED] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Core details grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailItem icon={<Phone size={14} />} label="Phone" value={r.guestPhone} />
            <DetailItem
              icon={<Users size={14} />}
              label="Party size"
              value={`${r.partySize} ${r.partySize === 1 ? "guest" : "guests"}`}
            />
            <DetailItem
              icon={<CalendarDays size={14} />}
              label="Date"
              value={formatDateGH(new Date(r.date))}
            />
            <DetailItem
              icon={<Clock size={14} />}
              label="Time"
              value={minutesToDisplay(r.timeSlot)}
            />
            {r.tableLabel && (
              <DetailItem label="Table" value={r.tableLabel} />
            )}
            {r.occasion && (
              <DetailItem
                label="Occasion"
                value={r.occasion.replace(/_/g, " ")}
              />
            )}
          </div>

          {/* Special requests */}
          {r.specialReqs && (
            <div className="p-3 rounded-xl bg-[#FEF3C7] border border-[#F59E0B]/20">
              <p className="text-xs font-semibold text-[#92400E] mb-1 flex items-center gap-1">
                <MessageSquare size={12} />
                Special request
              </p>
              <p className="text-sm text-[#92400E]">{r.specialReqs}</p>
            </div>
          )}

          {/* Deposit status */}
          {r.depositRequired && (
            <div
              className={`p-3 rounded-xl border ${
                r.depositPaid
                  ? "bg-[#D1FAE5] border-[#10B981]/20"
                  : "bg-[#FEE2E2] border-[#EF4444]/20"
              }`}
            >
              <p
                className={`text-xs font-semibold flex items-center gap-1 ${
                  r.depositPaid ? "text-[#065F46]" : "text-[#991B1B]"
                }`}
              >
                <CreditCard size={12} />
                Deposit {r.depositPesewas ? formatGHS(r.depositPesewas) : ""} —{" "}
                {r.depositPaid ? "Paid ✓" : "Not paid"}
              </p>
            </div>
          )}

          {/* Admin notes */}
          <div>
            <label className="block text-xs font-semibold text-[#5E5A57] mb-1.5 flex items-center gap-1">
              <StickyNote size={12} />
              Admin notes (internal only)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              className="w-full text-sm rounded-xl border border-[#E8E5E0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2] resize-none"
              placeholder="VIP guest, allergy alert, etc..."
            />
            <button
              onClick={() => notesMutation.mutate(adminNotes)}
              disabled={notesMutation.isPending}
              className="mt-1.5 text-xs text-[#0F7B5A] hover:underline disabled:opacity-60"
            >
              {notesMutation.isPending
                ? "Saving..."
                : notesSaved
                ? "✓ Saved"
                : "Save notes"}
            </button>
          </div>

          {/* Status actions */}
          {actions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E8E5E0]">
              <p className="text-xs font-semibold text-[#5E5A57]">Actions</p>
              {actions.map((action) => (
                <button
                  key={action.nextStatus}
                  onClick={() => onStatusChange(r.id, action.nextStatus)}
                  disabled={isMutating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60"
                  style={{ background: action.color }}
                >
                  {isMutating ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    action.icon
                  )}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-[#8B8680] flex items-center gap-1 mb-0.5">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium text-[#1A1A1A]">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, [string, string, string]> = {
    PENDING:         ["#FEF3C7", "#92400E", "Pending"],
    CONFIRMED:       ["#D1FAE5", "#065F46", "Confirmed"],
    SEATED:          ["#DBEAFE", "#1E40AF", "Seated"],
    COMPLETED:       ["#F3F4F6", "#374151", "Completed"],
    CANCELLED_DINER: ["#FEE2E2", "#991B1B", "Cancelled"],
    CANCELLED_VENUE: ["#FEE2E2", "#991B1B", "Cancelled (Venue)"],
    NO_SHOW:         ["#FEE2E2", "#991B1B", "No Show"],
  };
  const [bg, text, label] = labels[status] ?? ["#F3F4F6", "#374151", status];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: bg, color: text }}
    >
      {label}
    </span>
  );
}
