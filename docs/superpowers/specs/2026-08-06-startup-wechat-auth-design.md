# Startup WeChat Authentication Design

## Goal

Start WeChat authentication after the game has finished loading its runtime assets, instead of waiting until the player opens the leaderboard. The game must remain playable when authentication or the backend is unavailable.

## Current Flow

`Cat2048Boot` renders the home screen after `runStartupSequence` completes. The first leaderboard load calls an authenticated leaderboard request; when no stored JWT exists, `LeaderboardClient` calls `wx.login`, sends the code to `/v1/auth/wechat`, and stores the returned JWT.

## Design

Add an idempotent `ensureAuthenticated` operation to `LeaderboardClient`. It returns an existing stored session immediately, starts one login request when no session exists, and reuses that in-flight promise for concurrent callers. Existing 401 recovery continues to clear the expired session and perform a fresh login.

After startup assets are ready and the home screen is shown, `Cat2048Boot` starts `ensureAuthenticated` in the background. Authentication errors are logged and ignored so offline play and local score queuing continue. Opening the leaderboard later reuses the stored or in-flight session and does not issue a second `wx.login` request.

## Error Handling

Authentication failure does not change the current screen or block gameplay. The leaderboard keeps its existing error/retry behavior. A later leaderboard request can retry authentication after a failed startup attempt.

## Testing

Add a client test proving that a startup authentication call and a concurrent first authorized request share one login/code exchange. Keep the existing expired-token reauthentication test passing, and run the complete game unit test suite and typecheck.
