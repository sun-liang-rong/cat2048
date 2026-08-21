# Cat2048 leaderboard server

NestJS API for WeChat login, idempotent score submission, and the global historical leaderboard.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `WECHAT_APP_ID`, `WECHAT_APP_SECRET`, and `JWT_SECRET`.
2. Install dependencies with `npm install`.
3. Apply committed migrations with `npm run prisma:deploy`.
4. Start the API with `npm run start:dev`.

The SQLPub account used for the shared MySQL database cannot create Prisma shadow databases, so `prisma migrate dev` is not suitable for that database. Create reviewed SQL migrations with `prisma migrate diff` and apply them with `prisma migrate deploy`.

## Verification

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The health endpoint is `GET /health`. Authenticated API routes are under `/v1`.
