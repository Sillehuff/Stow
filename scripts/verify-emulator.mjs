import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_FIREBASE_PROJECT_ID = "stow-50f36";
const FIREBASE_CLI = resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "firebase.cmd" : "firebase"
);

function ensureCommand(name, args = ["--version"]) {
  const result = spawnSync(name, args, { stdio: "pipe", encoding: "utf8" });
  if (result.status === 0) return;

  const stderr = (result.stderr || "").trim();
  const stdout = (result.stdout || "").trim();
  const details = stderr || stdout;
  const reason = name === "java"
    ? "Java is required to run the Firestore and Storage emulators. Install a JRE/JDK and re-run `npm run verify:emulator`."
    : `Required command \`${name}\` is not available.`;

  console.error(reason);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function ensureFirebaseCli() {
  if (existsSync(FIREBASE_CLI)) return;

  console.error("Firebase CLI is required to run emulator verification. Install project dependencies with `npm install` and re-run `npm run verify:emulator`.");
  process.exit(1);
}

ensureCommand("java", ["-version"]);
ensureFirebaseCli();
ensureCommand(FIREBASE_CLI, ["--version"]);

const result = spawnSync(
  FIREBASE_CLI,
  [
    "emulators:exec",
    "--project",
    DEFAULT_FIREBASE_PROJECT_ID,
    "--only",
    "auth,firestore,functions,storage",
    "npm run verify:inside-emulator"
  ],
  {
    stdio: "inherit"
  }
);

process.exit(result.status ?? 1);
