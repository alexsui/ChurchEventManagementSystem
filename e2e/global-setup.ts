import { execSync } from "child_process";

export default async function globalSetup() {
  console.log("🌱 Re-seeding database for E2E tests...");
  execSync("npx prisma db seed", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env },
  });
  console.log("✅ Database seeded");
}
