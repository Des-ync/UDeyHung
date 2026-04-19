"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

const POPULAR_SEARCHES = [
  "Jollof rice",
  "Rooftop bars",
  "Fine dining",
  "East Legon",
  "Seafood",
  "Date night",
];

export function HeroSection() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function handlePopular(term: string) {
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <section className="relative overflow-hidden bg-[#1A1A1A] min-h-[600px] flex items-center texture-grain">
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://placehold.co/1920x800/0F7B5A/FAF7F2?text=TableGH')",
          opacity: 0.25,
        }}
        aria-hidden="true"
      />

      {/* Gold accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: "linear-gradient(90deg, #D4A853, #e8c278, #D4A853)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Tagline badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D4A853]/20 border border-[#D4A853]/40 text-[#D4A853] text-sm font-medium mb-6">
            <MapPin size={14} />
            Accra, Ghana
          </div>

          <h1
            className="text-[#FAF7F2] text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight text-balance mb-6"
            style={{ fontFamily: "Fraunces, Georgia, serif" }}
          >
            Chop time?{" "}
            <span style={{ color: "#D4A853" }}>Book your spot.</span>
          </h1>

          <p className="text-[#C4BFB9] text-lg sm:text-xl max-w-2xl mx-auto mb-10">
            Discover and reserve tables at the best restaurants in Accra — from
            fine dining in Cantonments to legendary chop bars in Osu.
          </p>
        </motion.div>

        {/* Search bar */}
        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          onSubmit={handleSearch}
          className="relative max-w-2xl mx-auto"
          role="search"
          aria-label="Search restaurants"
        >
          <div className="relative flex items-center bg-[#FAF7F2] rounded-2xl shadow-2xl overflow-hidden">
            <Search
              size={20}
              className="absolute left-5 text-[#8B8680]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cuisine, restaurant name, or neighbourhood..."
              className="w-full pl-14 pr-36 py-5 bg-transparent text-[#1A1A1A] placeholder-[#8B8680] text-base focus:outline-none"
              aria-label="Search for restaurants"
            />
            <button
              type="submit"
              className="absolute right-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ background: "#0F7B5A" }}
              aria-label="Search"
            >
              Search
            </button>
          </div>
        </motion.form>

        {/* Popular searches */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-2 mt-6"
        >
          <span className="text-[#8B8680] text-sm mr-1">Popular:</span>
          {POPULAR_SEARCHES.map((term) => (
            <button
              key={term}
              onClick={() => handlePopular(term)}
              className="px-3 py-1.5 rounded-full text-sm text-[#C4BFB9] border border-[#8B8680]/40 hover:border-[#D4A853]/60 hover:text-[#D4A853] transition-colors"
            >
              {term}
            </button>
          ))}
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-wrap justify-center gap-8 mt-16 pt-8 border-t border-[#FAF7F2]/10"
        >
          {[
            { value: "200+", label: "Restaurants" },
            { value: "11", label: "Neighbourhoods" },
            { value: "50K+", label: "Reservations made" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div
                className="text-2xl font-bold"
                style={{ color: "#D4A853", fontFamily: "Fraunces, serif" }}
              >
                {value}
              </div>
              <div className="text-[#8B8680] text-sm mt-1">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        aria-hidden="true"
      >
        <ChevronDown size={24} className="text-[#8B8680]" />
      </motion.div>
    </section>
  );
}
