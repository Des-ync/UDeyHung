"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export function FavoriteButton({
  restaurantId,
  initialSaved,
}: {
  restaurantId: string;
  initialSaved: boolean;
}) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/me/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (res.ok) {
        const json = await res.json();
        setSaved((json as { data: { saved: boolean } }).data.saved);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Remove from saved" : "Save restaurant"}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-60 ${
        saved
          ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
          : "bg-white border-[#E8E5E0] text-[#5E5A57] hover:border-[#0F7B5A]/40 hover:bg-[#F0FAF6]"
      }`}
    >
      <Heart
        size={15}
        className={saved ? "fill-red-500 text-red-500" : ""}
      />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
