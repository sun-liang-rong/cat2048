# API 文档

后端基于 NestJS + Prisma + MySQL。默认监听 `0.0.0.0:3000`（可用环境变量 `PORT` 修改）。

除 `POST /v1/auth/wechat` 与 `GET /health` 外，所有接口需要 JWT 认证：
请求头 `Authorization: Bearer <accessToken>`。

游戏端基地址配置在 `GAME_CONFIG.network.leaderboardBaseUrl`
（`packages/game/assets/scripts/core/config/gameConfig.ts`）。

所有响应包裹在 `data` 字段中：`{ "data": ... }`。

---

## 认证

### POST /v1/auth/wechat

微信小程序登录（code 换取 token）。

**请求体**

```json
{ "code": "wx.login 返回的临时 code" }
```

| 字段 | 类型 | 约束 |
|---|---|---|
| `code` | string | 1–512 字符 |

**限流**：每分钟 10 次。

**响应**

```json
{
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 7200,
    "player": {
      "id": "playerId",
      "nickname": "喵喵侠",
      "avatarUrl": "https://...",
      "highScore": 2048
    }
  }
}
```

---

## 玩家

### PATCH /v1/players/me/profile

更新当前玩家资料。

**请求体**

| 字段 | 类型 | 约束 |
|---|---|---|
| `nickname` | string? | 1–32 字符 |
| `avatarUrl` | string? | 必须是 https URL，≤512 字符 |

**响应**

```json
{ "data": { "player": { "id": "playerId", "nickname": "喵喵侠", "avatarUrl": null, "highScore": 0 } } }
```

---

## 排行榜

### POST /v1/leaderboard/scores

提交一局成绩（幂等：相同 `runId` 不会重复计分）。

**请求体**

```json
{ "runId": "run-xxx", "score": 2048, "highestLevel": 8 }
```

| 字段 | 类型 | 约束 |
|---|---|---|
| `runId` | string | 1–64 字符 |
| `score` | int | 0 – 2147483647 |
| `highestLevel` | int | 1 – 12 |

**限流**：每分钟 30 次。

**响应**

```json
{
  "data": {
    "runId": "run-xxx",
    "score": 2048,
    "accepted": true,
    "duplicate": false,
    "highScore": 2048,
    "rank": 3
  }
}
```

### GET /v1/leaderboard

获取排行榜（前 N 名 + 我的排名）。

**查询参数**

| 参数 | 类型 | 默认 | 约束 |
|---|---|---|---|
| `limit` | int | 50 | 1–100 |

**响应**

```json
{
  "data": {
    "entries": [
      { "rank": 1, "playerId": "p1", "nickname": "喵喵侠", "avatarUrl": null, "score": 4096, "achievedAt": "2026-08-20T12:00:00.000Z" }
    ],
    "me": { "rank": 3, "score": 2048 }
  }
}
```

---

## 健康检查

### GET /health

**响应**

```json
{ "data": { "status": "ok" } }
```

---

## 错误格式

非 2xx 响应：`{ "statusCode": 400, "message": "...", "error": "Bad Request" }`
（NestJS 默认格式，校验失败时 `message` 为字符串数组）。
