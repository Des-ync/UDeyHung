"use client";

import { useState, useRef, DragEvent, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Trash2,
  Star,
  Upload,
  X,
  AlertCircle,
  Loader2,
  ImageIcon,
  UtensilsCrossed,
} from "lucide-react";
import { formatGHS } from "@/lib/utils/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  pricePesewas: number;
  photoUrl: string | null;
  isAvailable: boolean;
  isSignatureDish: boolean;
  sortOrder: number;
  dietaryTags: string[];
  dishSpecialties: string[];
  categoryId: string;
  restaurantId: string;
}

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  restaurantId: string;
  items: MenuItem[];
  _count: { items: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIETARY_LABELS: Record<string, string> = {
  VEGETARIAN: "Vegetarian",
  VEGAN: "Vegan",
  GLUTEN_FREE: "Gluten Free",
  HALAL: "Halal",
  CONTAINS_NUTS: "Contains Nuts",
  DAIRY_FREE: "Dairy Free",
  SPICY_1: "Mild 🌶",
  SPICY_2: "Medium 🌶🌶",
  SPICY_3: "Hot 🌶🌶🌶",
};

const SPECIALTY_LABELS: Record<string, string> = {
  JOLLOF: "Jollof Rice",
  WAAKYE: "Waakye",
  BANKU: "Banku",
  TILAPIA: "Tilapia",
  KHEBAB: "Khebab",
  FUFU: "Fufu",
  KELEWELE: "Kelewele",
  KONTOMIRE: "Kontomire",
  EGUSI: "Egusi",
  PEANUT_SOUP: "Peanut Soup",
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function TagChip({ label, gold = false }: { label: string; gold?: boolean }) {
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
        gold
          ? "bg-[#D4A853]/10 text-[#9A7235]"
          : "bg-[#F5F2ED] text-[#5E5A57]"
      }`}
    >
      {label}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  color = "green",
}: {
  checked: boolean;
  onChange: () => void;
  color?: "green" | "gold";
}) {
  const bg = checked
    ? color === "gold"
      ? "bg-[#D4A853]"
      : "bg-[#0F7B5A]"
    : "bg-[#E8E5E0]";
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${bg}`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MenuEditor({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const qKey = ["admin-menu", restaurantId];

  const { data: categories = [], isLoading, error } = useQuery<MenuCategory[]>({
    queryKey: qKey,
    queryFn: async () => {
      const res = await fetch(`/api/v1/admin/menu?restaurantId=${restaurantId}`);
      if (!res.ok) throw new Error("Failed to load menu");
      const json = await res.json();
      return json.data as MenuCategory[];
    },
  });

  // ── Drag state ───────────────────────────────────────────────────────────
  const catDragRef = useRef<string | null>(null);
  const [catDragOver, setCatDragOver] = useState<string | null>(null);
  const itemDragRef = useRef<string | null>(null); // "{catId}:{itemId}"
  const [itemDragOver, setItemDragOver] = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "category" | "item";
    id: string;
    error?: string;
  } | null>(null);

  // ── Modals ───────────────────────────────────────────────────────────────
  const [catModal, setCatModal] = useState<{
    mode: "add" | "edit";
    cat?: MenuCategory;
  } | null>(null);

  const [itemModal, setItemModal] = useState<{
    mode: "add" | "edit";
    categoryId: string;
    item?: MenuItem;
  } | null>(null);

  // ── Mutations ────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: qKey });

  const reorderMutation = useMutation({
    mutationFn: async (payload: {
      type: "category" | "item";
      items: { id: string; sortOrder: number }[];
    }) => {
      const res = await fetch("/api/v1/admin/menu/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, ...payload }),
      });
      if (!res.ok) throw new Error("Reorder failed");
    },
    onSuccess: invalidate,
  });

  const toggleCatMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/v1/admin/menu/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onSuccess: invalidate,
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      const res = await fetch(`/api/v1/admin/menu/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable }),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onSuccess: invalidate,
  });

  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/admin/menu/categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Delete failed");
      }
    },
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
    },
    onError: (err: Error) => {
      setConfirmDelete((prev) =>
        prev ? { ...prev, error: err.message } : null
      );
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/admin/menu/items/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
    },
  });

  // ── Category drag ────────────────────────────────────────────────────────
  function onCatDragStart(id: string) {
    catDragRef.current = id;
  }

  function onCatDragOver(e: DragEvent, id: string) {
    e.preventDefault();
    if (catDragRef.current !== id) setCatDragOver(id);
  }

  function onCatDrop(targetId: string) {
    const dragId = catDragRef.current;
    catDragRef.current = null;
    setCatDragOver(null);
    if (!dragId || dragId === targetId) return;

    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const fromIdx = sorted.findIndex((c) => c.id === dragId);
    const toIdx = sorted.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved!);
    reorderMutation.mutate({
      type: "category",
      items: reordered.map((c, i) => ({ id: c.id, sortOrder: i })),
    });
  }

  // ── Item drag ────────────────────────────────────────────────────────────
  function onItemDragStart(catId: string, itemId: string) {
    itemDragRef.current = `${catId}:${itemId}`;
  }

  function onItemDragOver(e: DragEvent, catId: string, itemId: string) {
    e.preventDefault();
    const key = `${catId}:${itemId}`;
    if (itemDragRef.current !== key) setItemDragOver(key);
  }

  function onItemDrop(catId: string, targetItemId: string) {
    const dragKey = itemDragRef.current;
    itemDragRef.current = null;
    setItemDragOver(null);
    if (!dragKey) return;

    const [dragCatId, dragItemId] = dragKey.split(":") as [string, string];
    if (dragCatId !== catId || dragItemId === targetItemId) return;

    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    const sorted = [...cat.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const fromIdx = sorted.findIndex((i) => i.id === dragItemId);
    const toIdx = sorted.findIndex((i) => i.id === targetItemId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved!);
    reorderMutation.mutate({
      type: "item",
      items: reordered.map((item, i) => ({ id: item.id, sortOrder: i })),
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#0F7B5A]" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 p-6">
        <AlertCircle size={18} />
        <span>Failed to load menu. Please refresh the page.</span>
      </div>
    );
  }

  const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const totalItems = categories.reduce((s, c) => s + c._count.items, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-[#1A1A1A]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Menu
          </h1>
          <p className="text-sm text-[#8B8680] mt-0.5">
            {categories.length}{" "}
            {categories.length === 1 ? "category" : "categories"} · {totalItems}{" "}
            {totalItems === 1 ? "item" : "items"}
          </p>
        </div>
        <button
          onClick={() => setCatModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0F7B5A] text-white rounded-xl text-sm font-medium hover:bg-[#0a6349] transition-colors"
        >
          <Plus size={16} />
          Add Category
        </button>
      </div>

      {/* Empty state */}
      {sortedCats.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-[#E8E5E0] rounded-2xl">
          <UtensilsCrossed size={40} className="mx-auto mb-3 text-[#C5C0BB]" />
          <p className="text-[#8B8680] text-sm">
            No categories yet. Add your first menu category to get started.
          </p>
        </div>
      )}

      {/* Category list */}
      <div className="space-y-3">
        {sortedCats.map((cat) => {
          const isExpanded = expanded.has(cat.id);
          const isDragOver = catDragOver === cat.id;
          const sortedItems = [...cat.items].sort(
            (a, b) => a.sortOrder - b.sortOrder
          );
          const deleteState =
            confirmDelete?.type === "category" && confirmDelete.id === cat.id
              ? confirmDelete
              : null;

          return (
            <div
              key={cat.id}
              className={`bg-white rounded-2xl border transition-all ${
                isDragOver
                  ? "border-[#0F7B5A] shadow-md scale-[1.001]"
                  : "border-[#E8E5E0]"
              }`}
              draggable
              onDragStart={() => onCatDragStart(cat.id)}
              onDragOver={(e) => onCatDragOver(e, cat.id)}
              onDrop={() => onCatDrop(cat.id)}
              onDragEnd={() => {
                catDragRef.current = null;
                setCatDragOver(null);
              }}
            >
              {/* Category header row */}
              <div className="flex items-center gap-2 px-4 py-3 select-none">
                <GripVertical
                  size={17}
                  className="text-[#C5C0BB] flex-shrink-0 cursor-grab active:cursor-grabbing"
                />

                {/* Expand button */}
                <button
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                      return next;
                    })
                  }
                  className="flex items-center gap-2 flex-1 text-left min-w-0"
                >
                  <span className="text-[#8B8680] flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </span>
                  <span className="font-semibold text-[#1A1A1A] truncate">
                    {cat.name}
                  </span>
                  {cat.description && (
                    <span className="text-xs text-[#8B8680] truncate hidden sm:block max-w-[200px]">
                      {cat.description}
                    </span>
                  )}
                  <span className="text-xs text-[#8B8680] ml-auto mr-2 flex-shrink-0">
                    {cat._count.items}{" "}
                    {cat._count.items === 1 ? "item" : "items"}
                  </span>
                </button>

                {/* Active badge */}
                <button
                  onClick={() =>
                    toggleCatMutation.mutate({
                      id: cat.id,
                      isActive: !cat.isActive,
                    })
                  }
                  className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors flex-shrink-0 ${
                    cat.isActive
                      ? "bg-green-50 text-green-700 hover:bg-green-100"
                      : "bg-[#F5F2ED] text-[#8B8680] hover:bg-[#E8E5E0]"
                  }`}
                >
                  {cat.isActive ? "Active" : "Hidden"}
                </button>

                {/* Edit */}
                <button
                  onClick={() => setCatModal({ mode: "edit", cat })}
                  className="p-1.5 rounded-lg hover:bg-[#F5F2ED] text-[#8B8680] hover:text-[#1A1A1A] transition-colors"
                  aria-label="Edit category"
                >
                  <Pencil size={14} />
                </button>

                {/* Delete / confirm */}
                {deleteState ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => deleteCatMutation.mutate(cat.id)}
                      disabled={deleteCatMutation.isPending}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteCatMutation.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        "Confirm"
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="p-1.5 rounded-lg hover:bg-[#F5F2ED] text-[#8B8680]"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      setConfirmDelete({ type: "category", id: cat.id })
                    }
                    className="p-1.5 rounded-lg hover:bg-red-50 text-[#8B8680] hover:text-red-600 transition-colors"
                    aria-label="Delete category"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Delete error */}
              {deleteState?.error && (
                <p className="px-4 pb-3 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {deleteState.error}
                </p>
              )}

              {/* Items panel */}
              {isExpanded && (
                <div className="border-t border-[#E8E5E0]">
                  {sortedItems.length === 0 && (
                    <p className="text-sm text-[#8B8680] px-6 py-4 text-center">
                      No items yet in this category.
                    </p>
                  )}

                  {sortedItems.map((item) => {
                    const itemKey = `${cat.id}:${item.id}`;
                    const isDragOverItem = itemDragOver === itemKey;
                    const itemDeleteState =
                      confirmDelete?.type === "item" &&
                      confirmDelete.id === item.id
                        ? confirmDelete
                        : null;

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2.5 px-4 py-3 border-b border-[#E8E5E0] last:border-b-0 transition-colors ${
                          isDragOverItem
                            ? "bg-[#F0FAF6]"
                            : "hover:bg-[#FAF7F2]"
                        }`}
                        draggable
                        onDragStart={() =>
                          onItemDragStart(cat.id, item.id)
                        }
                        onDragOver={(e) =>
                          onItemDragOver(e, cat.id, item.id)
                        }
                        onDrop={() => onItemDrop(cat.id, item.id)}
                        onDragEnd={() => {
                          itemDragRef.current = null;
                          setItemDragOver(null);
                        }}
                      >
                        <GripVertical
                          size={14}
                          className="text-[#C5C0BB] flex-shrink-0 cursor-grab active:cursor-grabbing"
                        />

                        {/* Photo thumbnail */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#F5F2ED] flex-shrink-0">
                          {item.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.photoUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon
                                size={15}
                                className="text-[#C5C0BB]"
                              />
                            </div>
                          )}
                        </div>

                        {/* Name + tags */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-[#1A1A1A] truncate">
                              {item.name}
                            </span>
                            {item.isSignatureDish && (
                              <Star
                                size={11}
                                className="text-[#D4A853] fill-[#D4A853] flex-shrink-0"
                              />
                            )}
                          </div>
                          {(item.dietaryTags.length > 0 ||
                            item.dishSpecialties.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.dietaryTags.slice(0, 3).map((t) => (
                                <TagChip
                                  key={t}
                                  label={DIETARY_LABELS[t] ?? t}
                                />
                              ))}
                              {item.dishSpecialties.slice(0, 2).map((s) => (
                                <TagChip
                                  key={s}
                                  label={SPECIALTY_LABELS[s] ?? s}
                                  gold
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Price */}
                        <span className="text-sm font-semibold text-[#1A1A1A] flex-shrink-0 tabular-nums">
                          {formatGHS(item.pricePesewas)}
                        </span>

                        {/* Availability */}
                        <button
                          onClick={() =>
                            toggleItemMutation.mutate({
                              id: item.id,
                              isAvailable: !item.isAvailable,
                            })
                          }
                          className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors flex-shrink-0 ${
                            item.isAvailable
                              ? "bg-green-50 text-green-700 hover:bg-green-100"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          }`}
                        >
                          {item.isAvailable ? "Available" : "86'd"}
                        </button>

                        {/* Edit item */}
                        <button
                          onClick={() =>
                            setItemModal({
                              mode: "edit",
                              categoryId: cat.id,
                              item,
                            })
                          }
                          className="p-1.5 rounded-lg hover:bg-[#F5F2ED] text-[#8B8680] hover:text-[#1A1A1A] transition-colors"
                          aria-label="Edit item"
                        >
                          <Pencil size={14} />
                        </button>

                        {/* Delete item */}
                        {itemDeleteState ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() =>
                                deleteItemMutation.mutate(item.id)
                              }
                              disabled={deleteItemMutation.isPending}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              {deleteItemMutation.isPending ? (
                                <Loader2
                                  size={12}
                                  className="animate-spin"
                                />
                              ) : (
                                "Confirm"
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="p-1.5 rounded-lg hover:bg-[#F5F2ED] text-[#8B8680]"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setConfirmDelete({ type: "item", id: item.id })
                            }
                            className="p-1.5 rounded-lg hover:bg-red-50 text-[#8B8680] hover:text-red-600 transition-colors"
                            aria-label="Delete item"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add item */}
                  <button
                    onClick={() =>
                      setItemModal({ mode: "add", categoryId: cat.id })
                    }
                    className="w-full flex items-center gap-2 px-6 py-3 text-sm text-[#0F7B5A] hover:bg-[#F0FAF6] transition-colors rounded-b-2xl"
                  >
                    <Plus size={14} />
                    Add item to {cat.name}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {catModal && (
        <CategoryFormModal
          mode={catModal.mode}
          cat={catModal.cat}
          restaurantId={restaurantId}
          onClose={() => setCatModal(null)}
          onSuccess={() => {
            invalidate();
            setCatModal(null);
          }}
        />
      )}

      {itemModal && (
        <ItemFormModal
          mode={itemModal.mode}
          categoryId={itemModal.categoryId}
          item={itemModal.item}
          restaurantId={restaurantId}
          onClose={() => setItemModal(null)}
          onSuccess={() => {
            invalidate();
            setItemModal(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Category Form Modal ──────────────────────────────────────────────────────

interface CategoryFormModalProps {
  mode: "add" | "edit";
  cat?: MenuCategory;
  restaurantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CategoryFormModal({
  mode,
  cat,
  restaurantId,
  onClose,
  onSuccess,
}: CategoryFormModalProps) {
  const [name, setName] = useState(cat?.name ?? "");
  const [description, setDescription] = useState(cat?.description ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "add") {
        const res = await fetch("/api/v1/admin/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            name: name.trim(),
            description: description.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(
            (json as { error?: string }).error ?? "Failed to create category"
          );
        }
      } else {
        const res = await fetch(`/api/v1/admin/menu/categories/${cat!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
          }),
        });
        if (!res.ok) throw new Error("Failed to update category");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E5E0]">
          <h2 className="font-semibold text-[#1A1A1A]">
            {mode === "add" ? "Add Category" : "Edit Category"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#F5F2ED] rounded-lg"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3D3936] mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Starters, Grills, Drinks"
              maxLength={60}
              required
              autoFocus
              className="w-full px-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3D3936] mb-1.5">
              Description{" "}
              <span className="text-[#8B8680] font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this category"
              maxLength={300}
              rows={2}
              className="w-full px-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A] resize-none"
            />
            <p className="text-right text-xs text-[#8B8680] mt-1">
              {description.length}/300
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-[#E8E5E0] rounded-xl text-sm font-medium text-[#5E5A57] hover:bg-[#F5F2ED] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2.5 bg-[#0F7B5A] text-white rounded-xl text-sm font-medium hover:bg-[#0a6349] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === "add" ? "Create Category" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Item Form Modal ──────────────────────────────────────────────────────────

type PhotoState =
  | { status: "existing"; url: string }
  | { status: "empty" }
  | { status: "preview"; file: File; dataUrl: string }
  | { status: "uploading"; dataUrl: string }
  | { status: "error"; message: string };

interface ItemFormModalProps {
  mode: "add" | "edit";
  categoryId: string;
  item?: MenuItem;
  restaurantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ItemFormModal({
  mode,
  categoryId,
  item,
  restaurantId,
  onClose,
  onSuccess,
}: ItemFormModalProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [priceStr, setPriceStr] = useState(
    item ? (item.pricePesewas / 100).toFixed(2) : ""
  );
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  const [isSignatureDish, setIsSignatureDish] = useState(
    item?.isSignatureDish ?? false
  );
  const [dietaryTags, setDietaryTags] = useState<Set<string>>(
    new Set(item?.dietaryTags ?? [])
  );
  const [specialties, setSpecialties] = useState<Set<string>>(
    new Set(item?.dishSpecialties ?? [])
  );
  const [photo, setPhoto] = useState<PhotoState>(
    item?.photoUrl
      ? { status: "existing", url: item.photoUrl }
      : { status: "empty" }
  );
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSet(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  }

  async function handleFile(file: File) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setPhoto({ status: "error", message: "Only JPEG, PNG, or WebP images are allowed" });
      return;
    }
    if (file.size > 10_000_000) {
      setPhoto({ status: "error", message: "File must be under 10 MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) =>
      setPhoto({
        status: "preview",
        file,
        dataUrl: e.target?.result as string,
      });
    reader.readAsDataURL(file);
  }

  function onDropZoneDrop(e: DragEvent) {
    e.preventDefault();
    setDropZoneActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function uploadPendingPhoto(itemId: string): Promise<void> {
    if (photo.status !== "preview") return;
    const { file, dataUrl } = photo;
    setPhoto({ status: "uploading", dataUrl });

    const fd = new FormData();
    fd.append("file", file);
    fd.append("restaurantId", restaurantId);
    fd.append("context", "DISH");
    fd.append("itemId", itemId);

    const res = await fetch("/api/v1/admin/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error ?? "Photo upload failed");
    }
    const json = await res.json();
    setPhoto({ status: "existing", url: (json as { data: { url: string } }).data.url });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 1) {
      setError("Price must be at least ₵1.00");
      return;
    }
    const pricePesewas = Math.round(price * 100);

    setLoading(true);
    try {
      if (mode === "add") {
        const res = await fetch("/api/v1/admin/menu/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId,
            name: name.trim(),
            description: description.trim() || undefined,
            pricePesewas,
            isSignatureDish,
            dietaryTags: [...dietaryTags],
            dishSpecialties: [...specialties],
          }),
        });
        if (!res.ok) throw new Error("Failed to create item");
        const json = await res.json();
        const newId = (json as { data: { id: string } }).data.id;
        // Upload photo after creation so itemId is available
        await uploadPendingPhoto(newId);
      } else {
        const res = await fetch(`/api/v1/admin/menu/items/${item!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            pricePesewas,
            isAvailable,
            isSignatureDish,
            dietaryTags: [...dietaryTags],
            dishSpecialties: [...specialties],
          }),
        });
        if (!res.ok) throw new Error("Failed to update item");
        // Upload photo after update (handler auto-sets photoUrl)
        await uploadPendingPhoto(item!.id);
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setError(msg);
      setPhoto((prev) =>
        prev.status === "uploading"
          ? { status: "error", message: msg }
          : prev
      );
    } finally {
      setLoading(false);
    }
  }

  const previewUrl =
    photo.status === "existing"
      ? photo.url
      : photo.status === "preview" || photo.status === "uploading"
        ? photo.dataUrl
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E5E0] flex-shrink-0">
          <h2 className="font-semibold text-[#1A1A1A]">
            {mode === "add" ? "Add Item" : "Edit Item"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-[#F5F2ED] rounded-lg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* ── Photo ──────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-[#3D3936] mb-1.5">
              Photo{" "}
              <span className="text-[#8B8680] font-normal">(optional)</span>
            </label>

            {previewUrl ? (
              <div className="relative w-full h-44 rounded-xl overflow-hidden bg-[#F5F2ED]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                {photo.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="animate-spin text-white" size={28} />
                    <span className="ml-2 text-white text-sm font-medium">
                      Uploading…
                    </span>
                  </div>
                )}
                {photo.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() =>
                      setPhoto(
                        item?.photoUrl
                          ? { status: "existing", url: item.photoUrl }
                          : { status: "empty" }
                      )
                    }
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                    aria-label="Remove photo selection"
                  >
                    <X size={14} />
                  </button>
                )}
                {photo.status === "preview" && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 text-xs px-3 py-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-colors"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dropZoneActive
                    ? "border-[#0F7B5A] bg-[#F0FAF6]"
                    : "border-[#E8E5E0] hover:border-[#0F7B5A]/50 hover:bg-[#FAF7F2]"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropZoneActive(true);
                }}
                onDragLeave={() => setDropZoneActive(false)}
                onDrop={onDropZoneDrop}
              >
                <Upload
                  className={`mx-auto mb-2 transition-colors ${
                    dropZoneActive ? "text-[#0F7B5A]" : "text-[#C5C0BB]"
                  }`}
                  size={26}
                />
                <p className="text-sm text-[#5E5A57]">
                  Drag & drop or{" "}
                  <span className="text-[#0F7B5A] font-medium">browse</span>
                </p>
                <p className="text-xs text-[#C5C0BB] mt-1">
                  JPEG, PNG, WebP · max 10 MB · converted to WebP
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />

            {photo.status === "error" && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                <AlertCircle size={12} />
                {photo.message}
              </p>
            )}
          </div>

          {/* ── Name ───────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-[#3D3936] mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jollof Rice with Grilled Chicken"
              maxLength={100}
              required
              autoFocus
              className="w-full px-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
            />
          </div>

          {/* ── Description ────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-[#3D3936] mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ingredients, preparation style, allergen notes…"
              maxLength={300}
              rows={2}
              className="w-full px-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A] resize-none"
            />
            <p className="text-right text-xs text-[#8B8680] mt-1">
              {description.length}/300
            </p>
          </div>

          {/* ── Price ──────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-[#3D3936] mb-1.5">
              Price (GHS) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B8680] font-semibold pointer-events-none">
                ₵
              </span>
              <input
                type="number"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="0.00"
                min="1"
                step="0.01"
                required
                className="w-full pl-7 pr-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
              />
            </div>
          </div>

          {/* ── Toggles ────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Toggle
                checked={isSignatureDish}
                onChange={() => setIsSignatureDish((v) => !v)}
                color="gold"
              />
              <span className="text-sm text-[#3D3936] flex items-center gap-1">
                <Star
                  size={13}
                  className={
                    isSignatureDish
                      ? "text-[#D4A853] fill-[#D4A853]"
                      : "text-[#C5C0BB]"
                  }
                />
                Signature dish
              </span>
            </label>

            {mode === "edit" && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Toggle
                  checked={isAvailable}
                  onChange={() => setIsAvailable((v) => !v)}
                />
                <span className="text-sm text-[#3D3936]">
                  {isAvailable ? "Available" : "86'd (unavailable)"}
                </span>
              </label>
            )}
          </div>

          {/* ── Dietary tags ───────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-[#3D3936] mb-2">
              Dietary Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DIETARY_LABELS).map(([key, label]) => {
                const on = dietaryTags.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setDietaryTags((prev) => toggleSet(prev, key))
                    }
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-colors ${
                      on
                        ? "bg-[#0F7B5A] text-white border-[#0F7B5A]"
                        : "bg-white text-[#5E5A57] border-[#E8E5E0] hover:border-[#0F7B5A]/40 hover:bg-[#F5F2ED]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Dish specialties ───────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-[#3D3936] mb-2">
              Dish Specialties
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SPECIALTY_LABELS).map(([key, label]) => {
                const on = specialties.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setSpecialties((prev) => toggleSet(prev, key))
                    }
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-colors ${
                      on
                        ? "bg-[#D4A853] text-white border-[#D4A853]"
                        : "bg-white text-[#5E5A57] border-[#E8E5E0] hover:border-[#D4A853]/50 hover:bg-[#FEF9EE]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle size={14} />
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#E8E5E0] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-[#E8E5E0] rounded-xl text-sm font-medium text-[#5E5A57] hover:bg-[#F5F2ED] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim() || !priceStr}
            className="flex-1 py-2.5 bg-[#0F7B5A] text-white rounded-xl text-sm font-medium hover:bg-[#0a6349] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {mode === "add" ? "Add Item" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
