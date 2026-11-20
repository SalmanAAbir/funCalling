export type FilterId =
  | "none"
  | "cat"
  | "dog"
  | "mouse"
  | "bunny"
  | "ghost"
  | "sunglasses"
  | "hearts";

export type FilterOption = {
  id: FilterId;
  label: string;
  emoji: string;
  description: string;
};

export const FILTERS: FilterOption[] = [
  { id: "none", label: "None", emoji: "🙂", description: "No filter" },
  { id: "cat", label: "Cat", emoji: "🐱", description: "Whiskers and ears" },
  { id: "dog", label: "Dog", emoji: "🐶", description: "Floppy ears" },
  { id: "mouse", label: "Mouse", emoji: "🐭", description: "Round ears" },
  { id: "bunny", label: "Bunny", emoji: "🐰", description: "Tall ears" },
  { id: "ghost", label: "Ghost", emoji: "👻", description: "Spooky glow" },
  {
    id: "sunglasses",
    label: "Shades",
    emoji: "🕶️",
    description: "Cool shades",
  },
  { id: "hearts", label: "Hearts", emoji: "😍", description: "Heart eyes" },
];

export function isFilterId(value: string): value is FilterId {
  return FILTERS.some((f) => f.id === value);
}
