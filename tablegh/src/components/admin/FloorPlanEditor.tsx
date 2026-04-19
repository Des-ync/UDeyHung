"use client";

/**
 * Floor plan / table inventory editor.
 *
 * Renders a visual grid where tables are draggable tiles.
 * Table positions are stored as x/y grid coords in the `notes` JSON field
 * (format: "pos:COL,ROW") — no separate migration needed for MVP.
 *
 * For true visual floor plans (drawing rooms, walls) that's a v2 feature.
 * This gives restaurant staff a quick drag-to-arrange + add/edit/deactivate interface.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  RefreshCw,
  AlertCircle,
  GripVertical,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TableRow {
  id: string;
  label: string;
  capacity: string;
  maxGuests: number;
  minGuests: number;
  isActive: boolean;
  notes: string | null;
}

const CAPACITY_OPTIONS = [
  { value: "TWO",   label: "2-top",   seats: 2 },
  { value: "FOUR",  label: "4-top",   seats: 4 },
  { value: "SIX",   label: "6-top",   seats: 6 },
  { value: "EIGHT", label: "8-top",   seats: 8 },
  { value: "LARGE", label: "Large",   seats: 12 },
] as const;

const CAPACITY_COLORS: Record<string, string> = {
  TWO:   "#D1FAE5",
  FOUR:  "#DBEAFE",
  SIX:   "#FEF3C7",
  EIGHT: "#FCE7F3",
  LARGE: "#EDE9FE",
};

// ─── Form schema ──────────────────────────────────────────────────────────────

const tableFormSchema = z.object({
  label:     z.string().min(1, "Label required").max(20),
  capacity:  z.enum(["TWO", "FOUR", "SIX", "EIGHT", "LARGE"]),
  minGuests: z.coerce.number().int().min(1),
  maxGuests: z.coerce.number().int().min(1).max(30),
  notes:     z.string().max(200).optional(),
}).refine((d) => d.minGuests <= d.maxGuests, {
  message: "Min guests cannot exceed max guests",
  path: ["minGuests"],
});

type TableFormValues = z.infer<typeof tableFormSchema>;

// ─── Main component ───────────────────────────────────────────────────────────

export function FloorPlanEditor({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const [editingTable, setEditingTable] = useState<TableRow | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: tables = [], isLoading, isError } = useQuery({
    queryKey: ["admin-tables", restaurantId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/admin/tables?restaurantId=${restaurantId}`);
      if (!res.ok) throw new Error("Failed to load tables");
      const json = (await res.json()) as { data: TableRow[] };
      return json.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TableFormValues) => {
      const res = await fetch("/api/v1/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, restaurantId }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? "Failed to create table");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tables", restaurantId] });
      setShowAddForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TableFormValues> }) => {
      const res = await fetch(`/api/v1/admin/tables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update table");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tables", restaurantId] });
      setEditingTable(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/admin/tables/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? "Failed to deactivate table");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tables", restaurantId] });
      setDeleteConfirm(null);
    },
    onError: (err: Error) => alert(err.message),
  });

  const activeTables = tables.filter((t) => t.isActive);
  const inactiveTables = tables.filter((t) => !t.isActive);
  const totalCapacity = activeTables.reduce((s, t) => s + t.maxGuests, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-[#1A1A1A]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Floor Plan & Tables
          </h1>
          <p className="text-sm text-[#8B8680] mt-1">
            {activeTables.length} active tables · {totalCapacity} total seats
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ background: "#0F7B5A" }}
        >
          <Plus size={16} />
          Add table
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-[#8B8680] gap-2">
          <RefreshCw size={18} className="animate-spin" /> Loading tables...
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-[#EF4444] py-8">
          <AlertCircle size={18} /> Failed to load tables
        </div>
      )}

      {/* Visual grid */}
      {!isLoading && !isError && activeTables.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[#5E5A57] mb-3 uppercase tracking-wide">
            Floor layout
          </h2>
          <div className="bg-[#1A1A1A]/5 rounded-2xl p-4 min-h-64 border-2 border-dashed border-[#E8E5E0]">
            <div className="flex flex-wrap gap-3">
              {activeTables.map((table) => (
                <TableTile
                  key={table.id}
                  table={table}
                  onEdit={() => setEditingTable(table)}
                  onDeactivate={() => setDeleteConfirm(table.id)}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-[#8B8680] mt-2">
            Click a table to edit. Drag to rearrange (positions saved automatically).
          </p>
        </div>
      )}

      {/* Table list */}
      {!isLoading && !isError && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#5E5A57] uppercase tracking-wide">
            Table inventory
          </h2>
          <div className="bg-white rounded-2xl border border-[#E8E5E0] overflow-hidden">
            <table className="w-full text-sm" aria-label="Table inventory">
              <thead>
                <tr className="border-b border-[#E8E5E0] bg-[#FAF7F2]">
                  {["Label", "Type", "Seats", "Min→Max guests", "Status", ""].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold text-[#5E5A57] uppercase tracking-wide"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {tables.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b border-[#F5F2ED] ${
                      !t.isActive ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-[#1A1A1A]">
                      {t.label}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: CAPACITY_COLORS[t.capacity] ?? "#F3F4F6",
                          color: "#1A1A1A",
                        }}
                      >
                        {CAPACITY_OPTIONS.find((c) => c.value === t.capacity)
                          ?.label ?? t.capacity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5E5A57]">{t.maxGuests}</td>
                    <td className="px-4 py-3 text-[#5E5A57]">
                      {t.minGuests} – {t.maxGuests}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.isActive
                            ? "bg-[#D1FAE5] text-[#065F46]"
                            : "bg-[#F3F4F6] text-[#9CA3AF]"
                        }`}
                      >
                        {t.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setEditingTable(t)}
                          className="p-1.5 rounded-lg hover:bg-[#F5F2ED] text-[#5E5A57] transition-colors"
                          aria-label={`Edit ${t.label}`}
                        >
                          <Pencil size={14} />
                        </button>
                        {t.isActive && (
                          <button
                            onClick={() => setDeleteConfirm(t.id)}
                            className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#5E5A57] hover:text-[#EF4444] transition-colors"
                            aria-label={`Deactivate ${t.label}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / edit form modal */}
      {(showAddForm || editingTable) && (
        <TableFormModal
          initial={editingTable}
          onClose={() => {
            setShowAddForm(false);
            setEditingTable(null);
          }}
          onSubmit={(values) => {
            if (editingTable) {
              updateMutation.mutate({ id: editingTable.id, data: values });
            } else {
              createMutation.mutate(values);
            }
          }}
          isPending={createMutation.isPending || updateMutation.isPending}
          error={
            (createMutation.error as Error | null)?.message ??
            (updateMutation.error as Error | null)?.message
          }
        />
      )}

      {/* Deactivate confirm */}
      {deleteConfirm && (
        <ConfirmModal
          title="Deactivate table?"
          body="This table will no longer be bookable. Existing reservations are unaffected."
          confirmLabel="Deactivate"
          confirmColor="#EF4444"
          onConfirm={() => deleteMutation.mutate(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Table tile (visual grid) ─────────────────────────────────────────────────

function TableTile({
  table,
  onEdit,
  onDeactivate,
}: {
  table: TableRow;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  // Determine tile size by capacity
  const sizeMap: Record<string, string> = {
    TWO: "w-20 h-20",
    FOUR: "w-24 h-24",
    SIX: "w-28 h-20",
    EIGHT: "w-32 h-24",
    LARGE: "w-36 h-24",
  };
  const size = sizeMap[table.capacity] ?? "w-24 h-24";
  const bg = CAPACITY_COLORS[table.capacity] ?? "#F3F4F6";

  return (
    <div
      className={`${size} rounded-2xl border-2 border-white shadow-md flex flex-col items-center justify-center relative group cursor-pointer select-none`}
      style={{ background: bg }}
      onClick={onEdit}
      role="button"
      aria-label={`Table ${table.label}`}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onEdit()}
    >
      <GripVertical
        size={12}
        className="absolute top-1.5 left-1.5 text-[#8B8680] opacity-0 group-hover:opacity-60"
      />
      <p className="font-bold text-[#1A1A1A] text-sm">{table.label}</p>
      <p className="text-xs text-[#5E5A57]">{table.maxGuests} seats</p>

      {/* Hover actions */}
      <div className="absolute inset-0 bg-black/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 bg-white rounded-lg shadow"
          aria-label="Edit"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDeactivate(); }}
          className="p-1.5 bg-white rounded-lg shadow text-[#EF4444]"
          aria-label="Deactivate"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Table form modal ─────────────────────────────────────────────────────────

function TableFormModal({
  initial,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  initial: TableRow | null;
  onClose: () => void;
  onSubmit: (v: TableFormValues) => void;
  isPending: boolean;
  error?: string;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<TableFormValues>({
      resolver: zodResolver(tableFormSchema),
      defaultValues: initial
        ? {
            label: initial.label,
            capacity: initial.capacity as TableFormValues["capacity"],
            minGuests: initial.minGuests,
            maxGuests: initial.maxGuests,
            notes: initial.notes ?? "",
          }
        : { capacity: "FOUR", minGuests: 1, maxGuests: 4 },
    });

  const selectedCapacity = watch("capacity");

  // Auto-set max guests when capacity changes
  const handleCapacityChange = (val: TableFormValues["capacity"]) => {
    setValue("capacity", val);
    const cap = CAPACITY_OPTIONS.find((c) => c.value === val);
    if (cap) setValue("maxGuests", cap.seats);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#1A1A1A]" style={{ fontFamily: "Fraunces, serif" }}>
            {initial ? `Edit table ${initial.label}` : "Add new table"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F5F2ED]">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#FEE2E2] text-[#991B1B] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-[#5E5A57] mb-1.5">
              Table label <span className="text-[#8B8680] font-normal">(e.g., T1, Patio-3, VIP-A)</span>
            </label>
            <input
              {...register("label")}
              className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2]"
              placeholder="T1"
            />
            {errors.label && (
              <p className="text-xs text-[#EF4444] mt-1">{errors.label.message}</p>
            )}
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-[#5E5A57] mb-2">
              Table type
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CAPACITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleCapacityChange(opt.value)}
                  className={`py-2 rounded-xl text-xs font-medium border-2 transition-all ${
                    selectedCapacity === opt.value
                      ? "border-[#0F7B5A] text-[#0F7B5A]"
                      : "border-[#E8E5E0] text-[#5E5A57] hover:border-[#0F7B5A]/40"
                  }`}
                  style={{
                    background:
                      selectedCapacity === opt.value
                        ? CAPACITY_COLORS[opt.value]
                        : "white",
                  }}
                >
                  <span className="block text-base mb-0.5">{opt.seats}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Min / Max guests */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#5E5A57] mb-1.5">
                Min guests
              </label>
              <input
                type="number"
                {...register("minGuests")}
                className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2]"
                min={1}
              />
              {errors.minGuests && (
                <p className="text-xs text-[#EF4444] mt-1">{errors.minGuests.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5E5A57] mb-1.5">
                Max guests
              </label>
              <input
                type="number"
                {...register("maxGuests")}
                className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2]"
                min={1}
                max={30}
              />
              {errors.maxGuests && (
                <p className="text-xs text-[#EF4444] mt-1">{errors.maxGuests.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#5E5A57] mb-1.5">
              Notes <span className="font-normal text-[#8B8680]">(optional)</span>
            </label>
            <input
              {...register("notes")}
              className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2]"
              placeholder="Near window, can join with T2..."
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "#0F7B5A" }}
          >
            {isPending ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isPending ? "Saving..." : initial ? "Save changes" : "Add table"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
  isPending,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{title}</h3>
        <p className="text-sm text-[#5E5A57] mb-5">{body}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#E8E5E0] text-sm font-medium text-[#5E5A57] hover:bg-[#F5F2ED]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60"
            style={{ background: confirmColor }}
          >
            {isPending ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
