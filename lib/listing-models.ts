// The AI models the Listings panel can pick from, by their OpenRouter ids.
// Shared by the dropdown and the API route, so the route only ever sends a
// model that's on this list.
export const LISTING_MODELS = [
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5" },
] as const;

export type ListingModelId = (typeof LISTING_MODELS)[number]["id"];

export function isListingModelId(id: string): id is ListingModelId {
  return LISTING_MODELS.some((m) => m.id === id);
}
