export type FilterId = string;

export type FilterCategory =
  | "animals"
  | "creatures"
  | "accessories"
  | "mood"
  | "fx";

export type FilterOption = {
  id: FilterId;
  label: string;
  emoji: string;
  description: string;
  category: FilterCategory;
};

export const FILTERS: FilterOption[] = [
  { id: "none", label: "None", emoji: "🙂", description: "Clean cam", category: "fx" },

  // Animals
  { id: "cat", label: "Cat", emoji: "🐱", description: "Classic cat ears", category: "animals" },
  { id: "dog", label: "Puppy", emoji: "🐶", description: "Floppy puppy", category: "animals" },
  { id: "bunny", label: "Bunny", emoji: "🐰", description: "Tall bunny ears", category: "animals" },
  { id: "mouse", label: "Mouse", emoji: "🐭", description: "Tiny whiskers", category: "animals" },
  { id: "bear", label: "Bear", emoji: "🐻", description: "Round bear ears", category: "animals" },
  { id: "fox", label: "Fox", emoji: "🦊", description: "Pointy fox ears", category: "animals" },
  { id: "panda", label: "Panda", emoji: "🐼", description: "Panda eyes", category: "animals" },
  { id: "frog", label: "Frog", emoji: "🐸", description: "Big frog eyes", category: "animals" },
  { id: "pig", label: "Piggy", emoji: "🐷", description: "Snout + ears", category: "animals" },
  { id: "chick", label: "Chick", emoji: "🐤", description: "Fluffy chick", category: "animals" },
  { id: "koala", label: "Koala", emoji: "🐨", description: "Fuzzy ears", category: "animals" },
  { id: "tiger", label: "Tiger", emoji: "🐯", description: "Tiger stripes", category: "animals" },
  { id: "lion", label: "Lion", emoji: "🦁", description: "Mane vibes", category: "animals" },
  { id: "cow", label: "Cow", emoji: "🐮", description: "Spots + horns", category: "animals" },

  // Creatures
  { id: "unicorn", label: "Unicorn", emoji: "🦄", description: "Magic horn", category: "creatures" },
  { id: "dragon", label: "Dragon", emoji: "🐲", description: "Dragon horns", category: "creatures" },
  { id: "alien", label: "Alien", emoji: "👽", description: "Out of this world", category: "creatures" },
  { id: "ghost", label: "Ghost", emoji: "👻", description: "Spooky soft glow", category: "creatures" },
  { id: "robot", label: "Robot", emoji: "🤖", description: "Chrome faceplate", category: "creatures" },
  { id: "devil", label: "Devil", emoji: "😈", description: "Little horns", category: "creatures" },
  { id: "angel", label: "Angel", emoji: "😇", description: "Halo glow", category: "creatures" },
  { id: "clown", label: "Clown", emoji: "🤡", description: "Circus mode", category: "creatures" },
  { id: "vampire", label: "Vampire", emoji: "🧛", description: "Fang night", category: "creatures" },
  { id: "zombie", label: "Zombie", emoji: "🧟", description: "Undead tint", category: "creatures" },
  { id: "witch", label: "Witch", emoji: "🧙", description: "Spellcaster", category: "creatures" },
  { id: "pirate", label: "Pirate", emoji: "🏴‍☠️", description: "Eye patch vibes", category: "creatures" },

  // Accessories
  { id: "shades", label: "Shades", emoji: "🕶️", description: "Cool shades", category: "accessories" },
  { id: "hearts", label: "Hearts", emoji: "😍", description: "Heart eyes", category: "accessories" },
  { id: "starry", label: "Stars", emoji: "🤩", description: "Star eyes", category: "accessories" },
  { id: "mustache", label: "Stache", emoji: "🥸", description: "Fancy mustache", category: "accessories" },
  { id: "crown", label: "Crown", emoji: "👑", description: "Royalty", category: "accessories" },
  { id: "flower", label: "Flower", emoji: "🌸", description: "Flower crown", category: "accessories" },
  { id: "party", label: "Party", emoji: "🥳", description: "Party hat", category: "accessories" },
  { id: "mask", label: "Mask", emoji: "🎭", description: "Mystery mask", category: "accessories" },
  { id: "glasses", label: "Nerd", emoji: "🤓", description: "Round glasses", category: "accessories" },
  { id: "mono", label: "Mono", emoji: "🧐", description: "Monocle", category: "accessories" },

  // Mood + FX
  { id: "blush", label: "Blush", emoji: "😊", description: "Soft blush", category: "mood" },
  { id: "tears", label: "Tears", emoji: "😭", description: "Happy tears", category: "mood" },
  { id: "fire", label: "Fire", emoji: "🔥", description: "On fire", category: "fx" },
  { id: "ice", label: "Ice", emoji: "❄️", description: "Frozen glow", category: "fx" },
  { id: "neon", label: "Neon", emoji: "💚", description: "Neon outline", category: "fx" },
  { id: "rainbow", label: "Rainbow", emoji: "🌈", description: "Pride glow", category: "fx" },
  { id: "sparkle", label: "Sparkle", emoji: "✨", description: "Glitter rain", category: "fx" },
  { id: "comic", label: "Comic", emoji: "💥", description: "Pop-art dots", category: "fx" },
  { id: "noir", label: "Noir", emoji: "🎬", description: "B&W drama", category: "fx" },
  { id: "vintage", label: "Retro", emoji: "📷", description: "Warm vintage", category: "fx" },
  { id: "cyber", label: "Cyber", emoji: "💠", description: "HUD cyber lines", category: "fx" },
  { id: "pixel", label: "Pixel", emoji: "👾", description: "Pixel face", category: "fx" },
];

export const FILTER_CATEGORIES: { id: FilterCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "animals", label: "Animals" },
  { id: "creatures", label: "Creatures" },
  { id: "accessories", label: "Looks" },
  { id: "mood", label: "Mood" },
  { id: "fx", label: "FX" },
];

export function isFilterId(value: string): value is FilterId {
  return FILTERS.some((f) => f.id === value);
}

export function getFilter(id: FilterId) {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}
