import { expect, test, type Page } from "@playwright/test";

const PROJECT_ID = "demo-stow";
const APP_BASE_URL = "http://127.0.0.1:4273";
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

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
  await expect(page.getByText("Your Spaces")).toBeVisible({ timeout: 20_000 });
}

test("@live-gemini saves a reviewed Gemini-assisted item when credentials are present", async ({ page }) => {
  test.skip(!process.env.GEMINI_API_KEY, "GEMINI_API_KEY not provided");
  test.setTimeout(180_000);

  await signIn(page);

  await page.getByRole("button", { name: /^Add$/ }).click();
  const addSpaceDialog = page.getByRole("dialog", { name: "New Space" });
  await addSpaceDialog.getByLabel("Space name *").fill("Gemini Closet");
  await addSpaceDialog.getByRole("button", { name: "Create Space" }).click();
  await expect(page.getByRole("heading", { name: "Gemini Closet" })).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Provider").selectOption("gemini");
  await page.getByLabel("Model").fill("gemini-2.5-flash");
  await page.getByLabel("API Key (stored encrypted)").fill(process.env.GEMINI_API_KEY ?? "");
  await page.getByRole("button", { name: "Save AI Settings" }).click();
  await expect(page.getByText("LLM settings saved")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Test Connection" }).click();
  await expect(page.getByText("Connection successful")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Spaces" }).click();
  await page.getByRole("button", { name: /Scan or photograph/i }).click();
  const aiDialog = page.getByRole("dialog", { name: "AI Photo Assist" });
  await aiDialog.locator('input[type="file"]').setInputFiles({
    name: "known-live-gemini-image.png",
    mimeType: "image/png",
    buffer: PNG_BYTES
  });
  await aiDialog.getByRole("button", { name: "Categorize Photo" }).click();
  await expect(aiDialog.getByText("Review Draft")).toBeVisible({ timeout: 60_000 });
  await aiDialog.getByLabel("Suggested name").fill("Live Gemini Reviewed Item");
  await aiDialog.getByRole("button", { name: "Save Item" }).click();

  await expect(page.getByText("Live Gemini Reviewed Item")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByPlaceholder("Items, tags, or spaces…").fill("Live Gemini");
  await expect(page.getByText("Live Gemini Reviewed Item")).toBeVisible();
});
