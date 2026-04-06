import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use process.env directly — Prisma's env() throws during `prisma generate`
    // on Vercel even when the var exists, because the config loads before
    // Vercel injects build env vars. generate doesn't need a real URL anyway.
    url: process.env.PC_DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
    directUrl: process.env.PC_DIRECT_URL,
  },
});
