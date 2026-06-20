import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

export default defineConfig({
  migrations: {
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
