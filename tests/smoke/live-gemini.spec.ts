import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "demo-stow";
const APP_BASE_URL = "http://127.0.0.1:4273";
const FIXTURE = fileURLToPath(new URL("./fixtures/sample-item.png", import.meta.url));

type OobCodeRecord = {
  email?: string;
  oobCode?: string;
  oobLink?: string;
  requestType?: string;
};

async function waitForEmailLink(email: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
    if (response.ok) {
      const payload = (await response.json()) as { oobCodes?: OobCodeRecord[] };
      const match = payload.oobCodes?.find((record) => record.email === email && (record.oobLink?.includes("mode=signIn") || record.requestType === "EMAIL_SIGNIN"));
      if (match?.oobLink) {
        const source = new URL(match.oobLink);
        const target = new URL("/auth/finish", APP_BASE_URL);
        for (const [key, value] of source.searchParams.entries()) target.searchParams.set(key, value);
        return target.toString();
      }
      if (match?.oobCode) {
        const target = new URL("/auth/finish", APP_BASE_URL);
        target.searchParams.set("mode", "signIn");
        target.searchParams.set("oobCode", match.oobCode);
        target.searchParams.set("apiKey", "demo-api-key");
        return target.toString();
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for an email sign-in link for ${email}`);
}

async function signIn(page: Page) {
  const email = `live-gemini-${Date.now()}@example.com`;
  await page.goto("/spaces");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Email Me a Sign-In Link" }).click();
  const signInLink = await waitForEmailLink(email);
  await page.goto(signInLink);
  const finishSignInButton = page.getByRole("button", { name: "Finish Sign-In" });
  if (await finishSignInButton.isVisible()) {
    await page.getByPlaceholder("you@example.com").fill(email);
    await finishSignInButton.click();
  }
  await expect(page).toHaveURL(/\/spaces/);
  await expect(page.getByText("Your Spaces")).toBeVisible({ timeout: 20_000 });
}

// Exercises the real Gemini path end-to-end against the current mobile UI:
// configure + enable AI in Settings, validate the live connection, then run a
// single-item AI scan (via the file-input fallback) and save the reviewed item.
test("@live-gemini configures Gemini, validates it, and saves a reviewed AI-scanned item", async ({ page }) => {
  test.skip(!process.env.GEMINI_API_KEY, "GEMINI_API_KEY not provided");
  test.setTimeout(180_000);

  // Force the library/file-input fallback so the scan is deterministic in headless CI.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
  });

  await signIn(page);

  // Configure AI in Settings.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Toggle AI Vision").click();
  await page.getByLabel("AI provider").selectOption("gemini");
  await page.getByPlaceholder("gemini-2.5-flash").fill("gemini-2.5-flash");
  await page.getByPlaceholder("Paste to update").fill(process.env.GEMINI_API_KEY ?? "");
  await page.getByRole("button", { name: "Save AI settings" }).click();
  await expect(page.getByText("AI settings saved")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Connection successful")).toBeVisible({ timeout: 30_000 });

  // Run a single-item AI scan via the file-input fallback.
  await page.getByRole("button", { name: "Spaces" }).click();
  await page.getByRole("button", { name: "Scan" }).click();
  await page.getByRole("menuitem", { name: "AI Scan" }).click();
  const scanDialog = page.getByRole("dialog", { name: "AI Scan" });
  await scanDialog.locator('input[type="file"]').setInputFiles(FIXTURE);

  // The real Gemini suggestion lands in the Add Item sheet.
  const addItemDialog = page.getByRole("dialog", { name: "Add Item" });
  await expect(addItemDialog.getByText("AI filled")).toBeVisible({ timeout: 60_000 });

  // Pin a deterministic name so the assertion doesn't depend on the model's wording.
  await addItemDialog.getByPlaceholder("e.g. Wireless Charger").fill("Live Gemini Reviewed Item");
  await addItemDialog.getByRole("button", { name: "Add Item" }).click();

  await expect(page.getByText("Item added")).toBeVisible();
  await expect(page.getByText("Live Gemini Reviewed Item")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Search" }).click();
  await page.getByPlaceholder("Items, tags, or spaces...").fill("Live Gemini");
  await expect(page.getByText("Live Gemini Reviewed Item")).toBeVisible();
});
