export type FilterId = string;

export type FilterOption = {
  id: FilterId;
  label: string;
  /** Preview glyph shown in the Messenger-style tray */
  emoji: string;
  /** Soft pastel used for the circular tray icon background */
  swatch: string;
};

/** Classic Messenger / Meta camera-style face effects */
export const FILTERS: FilterOption[] = [
  { id: "none", label: "Original", emoji: "🚫", swatch: "#3f3f46" },
  { id: "dog", label: "Dog", emoji: "🐶", swatch: "#b45309" },
  { id: "cat", label: "Cat", emoji: "🐱", swatch: "#ea580c" },
  { id: "bunny", label: "Bunny", emoji: "🐰", swatch: "#f472b6" },
  { id: "bear", label: "Bear", emoji: "🐻", swatch: "#92400e" },
  { id: "deer", label: "Deer", emoji: "🦌", swatch: "#a16207" },
  { id: "pig", label: "Pig", emoji: "🐷", swatch: "#fb7185" },
  { id: "mouse", label: "Mouse", emoji: "🐭", swatch: "#a8a29e" },
  { id: "panda", label: "Panda", emoji: "🐼", swatch: "#52525b" },
  { id: "fox", label: "Fox", emoji: "🦊", swatch: "#ea580c" },
  { id: "raccoon", label: "Raccoon", emoji: "🦝", swatch: "#78716c" },
  { id: "chick", label: "Chick", emoji: "🐤", swatch: "#facc15" },
  { id: "frog", label: "Frog", emoji: "🐸", swatch: "#22c55e" },
  { id: "unicorn", label: "Unicorn", emoji: "🦄", swatch: "#c084fc" },
  { id: "flower", label: "Flower", emoji: "🌸", swatch: "#f9a8d4" },
  { id: "hearts", label: "Hearts", emoji: "😍", swatch: "#e11d48" },
  { id: "stars", label: "Stars", emoji: "🤩", swatch: "#eab308" },
  { id: "blush", label: "Blush", emoji: "😊", swatch: "#fda4af" },
  { id: "freckles", label: "Freckles", emoji: "☺️", swatch: "#fdba74" },
  { id: "glow", label: "Glow", emoji: "✨", swatch: "#fde68a" },
  { id: "shades", label: "Shades", emoji: "🕶️", swatch: "#1e293b" },
  { id: "bigeyes", label: "Big Eyes", emoji: "👀", swatch: "#38bdf8" },
  { id: "mustache", label: "Mustache", emoji: "🥸", swatch: "#78716c" },
  { id: "crown", label: "Crown", emoji: "👑", swatch: "#fbbf24" },
  { id: "halo", label: "Halo", emoji: "😇", swatch: "#fef08a" },
  { id: "devil", label: "Devil", emoji: "😈", swatch: "#dc2626" },
  { id: "ghost", label: "Ghost", emoji: "👻", swatch: "#e2e8f0" },
  { id: "sparkle", label: "Sparkle", emoji: "💖", swatch: "#f472b6" },
  { id: "rainbow", label: "Rainbow", emoji: "🌈", swatch: "#818cf8" },
  { id: "snow", label: "Snow", emoji: "❄️", swatch: "#7dd3fc" },
  { id: "warm", label: "Warm", emoji: "🌅", swatch: "#fb923c" },
  { id: "cool", label: "Cool", emoji: "🧊", swatch: "#22d3ee" },
];

export function isFilterId(value: string): value is FilterId {
  return FILTERS.some((f) => f.id === value);
}

export function getFilter(id: FilterId) {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}
