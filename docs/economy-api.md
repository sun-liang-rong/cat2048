# Economy API Contract

The first client implementation uses `LocalEconomyRepository`. A future HTTP adapter should keep the same `EconomyRepository` interface and use these routes.

## Bootstrap

`GET /v1/economy/bootstrap`

Returns the authoritative balance, owned item IDs, equipped cosmetic IDs, daily reward state, and catalog version. The client should not trust prices or balances stored in the local catalog once this adapter is enabled.

## Daily Claim

`POST /v1/economy/daily-claim`

The server uses its own calendar date and returns the updated balance, streak, claim date, and awarded amount. Repeating the request for the same date must be idempotent.

## Run Reward

`POST /v1/economy/run-reward`

```json
{
  "runId": "run-unique-id",
  "score": 1024,
  "highestLevel": 5
}
```

`runId` is the idempotency key. The server validates the reward and returns the updated balance plus the awarded amount. A repeated `runId` must not award coins twice.

## Purchase and Equip

`POST /v1/economy/purchase`

```json
{
  "itemId": "board.pink",
  "catalogVersion": "2026-08"
}
```

`POST /v1/economy/equip`

```json
{
  "itemId": "board.pink"
}
```

Purchase is atomic: the server checks ownership and price, deducts coins, and returns the new balance and owned item list. Equip only succeeds for an owned item. Both operations return a stable error code for insufficient balance, invalid item, and stale catalog versions.
