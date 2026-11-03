/** Sparkle delivery rider on a pink scooter (decoration for the tracking page). */
export function DeliveryRider({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 200" className={className} aria-hidden>
      {/* motion lines */}
      <path d="M8 150 C 60 140, 90 165, 140 150" stroke="#F9A8D4" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".55" />
      <path d="M22 172 C 70 162, 100 182, 150 170" stroke="#FBCFE8" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".7" />
      {/* wheels */}
      <circle cx="78" cy="168" r="22" fill="#1F2937" /><circle cx="78" cy="168" r="9" fill="#9CA3AF" />
      <circle cx="206" cy="168" r="22" fill="#1F2937" /><circle cx="206" cy="168" r="9" fill="#9CA3AF" />
      {/* scooter body */}
      <path d="M58 150 C 60 120, 95 112, 132 120 L 176 120 C 196 120, 214 134, 222 152 L 230 162 L 186 162 C 180 146, 160 140, 146 150 L 104 156 C 96 148, 78 144, 58 150 Z" fill="#EC4899" />
      <path d="M176 120 L 190 74 L 204 74" stroke="#BE185D" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="198" y="68" width="18" height="8" rx="4" fill="#1F2937" />
      <path d="M96 118 L 150 116" stroke="#BE185D" strokeWidth="9" strokeLinecap="round" />
      {/* delivery box */}
      <rect x="30" y="72" width="62" height="54" rx="8" fill="#F472B6" />
      <rect x="30" y="72" width="62" height="12" rx="6" fill="#EC4899" />
      <path d="M61 92 c-4 7-4 14 0 20 c4-6 4-13 0-20 Z M50 98 c1 7 5 12 11 14 c-1-7-5-12-11-14 Z M72 98 c-6 2-10 7-11 14 c6-2 10-7 11-14 Z" fill="#fff" />
      {/* rider */}
      <path d="M118 116 L 150 116 L 170 138 L 158 146 L 140 128 L 118 128 Z" fill="#111827" />
      <path d="M150 138 L 168 162 L 182 162" stroke="#111827" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M112 118 C 108 92, 116 66, 140 62 C 158 60, 166 74, 164 92 L 160 118 Z" fill="#EC4899" />
      <path d="M150 74 C 166 80, 178 76, 192 74" stroke="#EC4899" strokeWidth="11" fill="none" strokeLinecap="round" />
      <circle cx="194" cy="74" r="6" fill="#7C4A2D" />
      {/* head and helmet */}
      <circle cx="146" cy="42" r="15" fill="#7C4A2D" />
      <path d="M128 42 C 126 22, 140 12, 152 14 C 166 16, 172 30, 168 42 L 150 40 L 128 44 Z" fill="#DB2777" />
      <path d="M152 30 L 170 34 L 168 42 L 152 40 Z" fill="#FBCFE8" opacity=".9" />
    </svg>
  );
}
