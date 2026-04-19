"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Flag, MessageSquare, CheckCircle2, Loader2, AlertCircle, ThumbsUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewUser { id: string; name: string }

interface ReviewResponse {
  id: string;
  body: string;
  createdAt: string;
}

interface Review {
  id: string;
  rating: number;
  body: string | null;
  photoUrls: string[];
  isVerified: boolean;
  createdAt: string;
  user: ReviewUser;
  response: ReviewResponse | null;
}

interface ReviewSummary {
  average: number;
  total: number;
  breakdown: { star: number; count: number }[];
}

interface ReviewsData {
  items: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
  summary: ReviewSummary;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReviewsSectionProps {
  restaurantSlug: string;
  restaurantName: string;
  /** If provided, show "Leave a review" form for this completed reservation */
  pendingReviewReservationId?: string;
  /** Whether the current user is a staff member (shows respond UI) */
  isStaff?: boolean;
}

// ─── Stars display ────────────────────────────────────────────────────────────

function Stars({
  rating,
  size = 14,
  interactive = false,
  onRate,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onRate?: (r: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = interactive ? s <= (hovered || rating) : s <= rating;
        return (
          <Star
            key={s}
            size={size}
            className={`transition-colors ${
              filled
                ? "text-[#D4A853] fill-[#D4A853]"
                : "text-[#E8E5E0] fill-[#E8E5E0]"
            } ${interactive ? "cursor-pointer" : ""}`}
            onMouseEnter={() => interactive && setHovered(s)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onRate?.(s)}
          />
        );
      })}
    </div>
  );
}

// ─── Rating summary bar ───────────────────────────────────────────────────────

function RatingSummary({ summary }: { summary: ReviewSummary }) {
  const max = Math.max(...summary.breakdown.map((b) => b.count), 1);
  return (
    <div className="flex items-start gap-8 p-5 bg-[#FAF7F2] rounded-2xl border border-[#E8E5E0]">
      {/* Big average */}
      <div className="text-center flex-shrink-0">
        <p
          className="text-5xl font-bold text-[#1A1A1A] tabular-nums"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          {summary.average.toFixed(1)}
        </p>
        <Stars rating={Math.round(summary.average)} size={16} />
        <p className="text-xs text-[#8B8680] mt-1">
          {summary.total} {summary.total === 1 ? "review" : "reviews"}
        </p>
      </div>

      {/* Bar chart */}
      <div className="flex-1 space-y-1.5">
        {summary.breakdown.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs text-[#8B8680] w-3 flex-shrink-0">
              {star}
            </span>
            <div className="flex-1 h-2 bg-[#E8E5E0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#D4A853] rounded-full transition-all"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-[#8B8680] w-4 text-right flex-shrink-0 tabular-nums">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Single review card ───────────────────────────────────────────────────────

function ReviewCard({
  review,
  slug,
  isStaff,
  restaurantName,
  onFlag,
  onRespond,
  onDeleteResponse,
}: {
  review: Review;
  slug: string;
  isStaff: boolean;
  restaurantName: string;
  onFlag: (id: string) => void;
  onRespond: (id: string, body: string) => void;
  onDeleteResponse: (id: string) => void;
}) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseBody, setResponseBody] = useState(
    review.response?.body ?? ""
  );
  const [flagging, setFlagging] = useState(false);

  return (
    <div className="py-5 border-b border-[#E8E5E0] last:border-b-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#1A1A1A]">
              {review.user.name}
            </span>
            {review.isVerified && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#0F7B5A]/10 text-[#0F7B5A] font-medium">
                <CheckCircle2 size={10} />
                Verified diner
              </span>
            )}
          </div>
          <Stars rating={review.rating} size={13} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[#8B8680]">
            {new Date(review.createdAt).toLocaleDateString("en-GH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          {/* Flag button — guests only */}
          {!isStaff && (
            <button
              onClick={() => {
                setFlagging(true);
                onFlag(review.id);
              }}
              disabled={flagging}
              className="p-1 rounded hover:bg-[#F5F2ED] text-[#C5C0BB] hover:text-amber-500 transition-colors"
              title="Flag review"
              aria-label="Flag review"
            >
              <Flag size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {review.body && (
        <p className="text-sm text-[#3D3936] mt-2 leading-relaxed">
          {review.body}
        </p>
      )}

      {/* Photos */}
      {review.photoUrls.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {review.photoUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-[#E8E5E0]"
            />
          ))}
        </div>
      )}

      {/* Restaurant response */}
      {review.response && (
        <div className="mt-3 ml-4 pl-4 border-l-2 border-[#0F7B5A]/20 bg-[#F0FAF6] rounded-r-xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#0F7B5A]">
              {restaurantName} responded
            </p>
            {isStaff && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setResponseBody(review.response!.body);
                    setShowResponseForm(true);
                  }}
                  className="text-xs text-[#0F7B5A] hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDeleteResponse(review.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-[#3D3936] mt-1">{review.response.body}</p>
          <p className="text-[10px] text-[#8B8680] mt-1">
            {new Date(review.response.createdAt).toLocaleDateString("en-GH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      )}

      {/* Staff: respond button */}
      {isStaff && !review.response && !showResponseForm && (
        <button
          onClick={() => setShowResponseForm(true)}
          className="mt-2 flex items-center gap-1.5 text-xs text-[#0F7B5A] hover:underline"
        >
          <MessageSquare size={12} />
          Respond to this review
        </button>
      )}

      {/* Staff: response form */}
      {isStaff && showResponseForm && (
        <div className="mt-3 space-y-2">
          <textarea
            value={responseBody}
            onChange={(e) => setResponseBody(e.target.value)}
            placeholder="Write a professional response as the restaurant…"
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A] resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#8B8680]">
              {responseBody.length}/500
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowResponseForm(false);
                  setResponseBody(review.response?.body ?? "");
                }}
                className="text-xs px-3 py-1.5 border border-[#E8E5E0] rounded-lg hover:bg-[#F5F2ED] text-[#5E5A57]"
              >
                Cancel
              </button>
              <button
                disabled={responseBody.trim().length < 10}
                onClick={() => {
                  onRespond(review.id, responseBody.trim());
                  setShowResponseForm(false);
                }}
                className="text-xs px-3 py-1.5 bg-[#0F7B5A] text-white rounded-lg hover:bg-[#0a6349] disabled:opacity-50"
              >
                Post Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Submit review form ───────────────────────────────────────────────────────

function SubmitReviewForm({
  reservationId,
  onSuccess,
}: {
  reservationId: string;
  onSuccess: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Please select a star rating"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          rating,
          body: body.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: { message?: string } }).error?.message ?? "Failed to submit review"
        );
      }
      setDone(true);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-700">
        <CheckCircle2 size={16} />
        Thank you for your review!
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 bg-[#FAF7F2] border border-[#E8E5E0] rounded-2xl space-y-4"
    >
      <h3 className="font-semibold text-[#1A1A1A] text-sm">
        How was your experience?
      </h3>

      <div>
        <Stars rating={rating} size={28} interactive onRate={setRating} />
        {rating > 0 && (
          <p className="text-xs text-[#8B8680] mt-1">
            {["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating]}
          </p>
        )}
      </div>

      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell others about your meal, service, and atmosphere…"
          maxLength={1000}
          rows={4}
          className="w-full px-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A] resize-none bg-white"
        />
        <p className="text-right text-xs text-[#8B8680] mt-1">
          {body.length}/1000
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="w-full py-2.5 bg-[#0F7B5A] text-white rounded-xl text-sm font-medium hover:bg-[#0a6349] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Submit Review
      </button>
    </form>
  );
}

// ─── Main reviews section ─────────────────────────────────────────────────────

export function ReviewsSection({
  restaurantSlug,
  restaurantName,
  pendingReviewReservationId,
  isStaff = false,
}: ReviewsSectionProps) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"recent" | "highest" | "lowest">("recent");

  const qKey = ["reviews", restaurantSlug, page, sort];

  const { data, isLoading, error } = useQuery<ReviewsData>({
    queryKey: qKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sort,
      });
      const res = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/reviews?${params}`
      );
      if (!res.ok) throw new Error("Failed to load reviews");
      const json = await res.json();
      return json.data as ReviewsData;
    },
  });

  const flagMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/reviews/${id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "OTHER" }),
      });
      if (!res.ok) throw new Error("Flag failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews", restaurantSlug] }),
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const res = await fetch(`/api/v1/admin/reviews/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Response failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews", restaurantSlug] }),
  });

  const deleteResponseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/admin/reviews/${id}/respond`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews", restaurantSlug] }),
  });

  return (
    <section className="space-y-6">
      <h2
        className="text-xl font-bold text-[#1A1A1A]"
        style={{ fontFamily: "Fraunces, serif" }}
      >
        Reviews
      </h2>

      {/* Submit review form (only shown for verified diners) */}
      {pendingReviewReservationId && (
        <SubmitReviewForm
          reservationId={pendingReviewReservationId}
          onSuccess={() =>
            qc.invalidateQueries({ queryKey: ["reviews", restaurantSlug] })
          }
        />
      )}

      {/* Summary */}
      {data?.summary && data.summary.total > 0 && (
        <RatingSummary summary={data.summary} />
      )}

      {/* Sort controls */}
      {(data?.summary.total ?? 0) > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8B8680]">Sort by:</span>
          {(["recent", "highest", "lowest"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSort(s);
                setPage(1);
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                sort === s
                  ? "bg-[#0F7B5A] text-white border-[#0F7B5A]"
                  : "bg-white text-[#5E5A57] border-[#E8E5E0] hover:border-[#0F7B5A]/40"
              }`}
            >
              {s === "recent" ? "Most recent" : s === "highest" ? "Highest first" : "Lowest first"}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-[#0F7B5A]" size={22} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm py-4">
          <AlertCircle size={16} />
          Failed to load reviews.
        </div>
      )}

      {data && data.items.length === 0 && !pendingReviewReservationId && (
        <div className="text-center py-12 border-2 border-dashed border-[#E8E5E0] rounded-2xl">
          <ThumbsUp size={32} className="mx-auto mb-3 text-[#C5C0BB]" />
          <p className="text-sm text-[#8B8680]">
            No reviews yet. Be the first to share your experience!
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8E5E0] px-5 divide-y divide-[#E8E5E0]">
          {data.items.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              slug={restaurantSlug}
              isStaff={isStaff}
              restaurantName={restaurantName}
              onFlag={(id) => flagMutation.mutate(id)}
              onRespond={(id, body) => respondMutation.mutate({ id, body })}
              onDeleteResponse={(id) => deleteResponseMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border border-[#E8E5E0] rounded-lg hover:bg-[#F5F2ED] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-[#8B8680] tabular-nums">
            {page} / {data.pagination.totalPages}
          </span>
          <button
            disabled={!data.pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border border-[#E8E5E0] rounded-lg hover:bg-[#F5F2ED] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
