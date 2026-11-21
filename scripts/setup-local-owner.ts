import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "dotenv";
import { applyGoeSetup } from "./apply-goe-setup";

const envPath = path.resolve(process.argv[2] || ".env");
const current = fs.existsSync(envPath) ? parse(fs.readFileSync(envPath, "utf8")) : {};
if (current.OWNER_ID || current.OWNER_DID) {
  throw new Error("This GOE already has an owner. Keep its existing owner identity.");
}

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "goe-owner-"));
try {
  const setupPath = path.join(temporaryDirectory, "owner.env");
  fs.writeFileSync(setupPath, `OWNER_ID=goe:${crypto.randomUUID()}\n`, { mode: 0o600 });
  const result = await applyGoeSetup(setupPath, envPath);
  if (result.owner.action !== "created") {
    throw new Error("The database already has an owner; review it before continuing.");
  }
  console.log("Local GOE owner created. Keep .env private and backed up.");
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
