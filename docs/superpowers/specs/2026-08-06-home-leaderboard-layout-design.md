# Home Leaderboard Layout Design

## Goal

Make the leaderboard a prominent home-screen action by moving it out of the bottom icon dock and placing it directly below the classic-mode button.

## Design

The classic-mode button remains the primary coral action. Add a 500x76 teal leaderboard button below it, using the existing leaderboard fallback icon and `onLeaderboard` action. Keep the existing gameplay hint below the new button. Remove the leaderboard icon and label from the bottom dock, then center the remaining five entries with equal spacing.

The layout remains resolution-aware through the existing `homeTopY` helper. The bottom dock keeps its current size and safe-area position; only its item count and positions change.

## Testing

Extract a pure helper for evenly centering a fixed number of dock entries and test the five-entry positions. Run the full game verification command and inspect the generated diff for unchanged navigation behavior.
