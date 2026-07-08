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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForEmailLink(email: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
    if (response.ok) {
      const payload = (await response.json()) as { oobCodes?: OobCodeRecord[] };
      const match = payload.oobCodes?.find((record) => {
        if (record.email !== email) return false;
        if (record.oobLink?.includes("mode=signIn")) return true;
        return record.requestType === "EMAIL_SIGNIN";
      });

      if (match?.oobLink) {
        const source = new URL(match.oobLink);
        const target = new URL("/auth/finish", APP_BASE_URL);
        for (const [key, value] of source.searchParams.entries()) {
          target.searchParams.set(key, value);
        }
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

    await wait(500);
  }

  throw new Error(`Timed out waiting for an email sign-in link for ${email}`);
}

async function signIn(page: Page) {
  const email = `shelf-capture-${Date.now()}@example.com`;

  await page.goto("/spaces");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Email Me a Sign-In Link" }).click();
  await expect(page.getByText(`Sign-in link sent to ${email}`)).toBeVisible();

  await page.goto(await waitForEmailLink(email));
  const finishSignInButton = page.getByRole("button", { name: "Finish Sign-In" });
  if (await finishSignInButton.isVisible()) {
    await page.getByPlaceholder("you@example.com").fill(email);
    await finishSignInButton.click();
  }

  await expect(page).toHaveURL(/\/spaces/);
  await expect(page.getByText("Your Spaces")).toBeVisible({ timeout: 20_000 });
}

async function addSpace(page: Page) {
  await page.getByRole("button", { name: "Add Space" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Space" });
  await dialog.getByPlaceholder("e.g. Bedroom").fill("Shelf Closet");
  await dialog.getByPlaceholder("Closet, Nightstand, Dresser").fill("Shelf A");
  await dialog.getByRole("button", { name: "Create Space" }).click();
  await expect(page.getByText("Space created")).toBeVisible();
  await expect(page.getByText("Shelf Closet", { exact: true })).toBeVisible();
}

async function mockShelfDetection(page: Page) {
  await page.route("**/visionDetectShelfItems**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          detections: [
            {
              label: "Mechanical Keyboard",
              confidence: 0.97,
              bbox: [0.11, 0.15, 0.45, 0.29],
              suggestedValue: 140,
              tags: ["Tech"]
            },
            { label: "Headphones", confidence: 0.61, bbox: [0.63, 0.19, 0.27, 0.23], tags: ["Audio"] },
            { label: "", confidence: 0.44, bbox: [0.09, 0.7, 0.26, 0.17] }
          ],
          provider: "gemini",
          jobId: "job-test-1"
        }
      })
    });
  });
}

test.describe("whole-shelf batch capture", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    });
    await mockShelfDetection(page);
  });

  test("detects, reviews least-confident-first, and batch-commits", async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page);
    await addSpace(page);

    await page.getByRole("button", { name: "Scan" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "AI Scan" }).click();
    const scanDialog = page.getByRole("dialog", { name: "AI Scan" });
    await scanDialog.getByRole("button", { name: "Whole shelf" }).click();
    await expect(scanDialog.getByRole("button", { name: "Whole shelf" })).toHaveAttribute("aria-pressed", "true");

    await scanDialog.locator('input[type="file"]').setInputFiles(FIXTURE);

    await expect(page.getByText(/3 found/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/1 need a look/i)).toBeVisible();
    await page.getByRole("button", { name: /Review 3 items/i }).click();

    await expect(page.getByText(/Couldn't identify/i)).toBeVisible();
    await page.getByPlaceholder("e.g. Wireless Earbuds").fill("Desk Speaker");
    await page.getByRole("button", { name: /Confirm/i }).click();

    await expect(page.getByText("Headphones")).toBeVisible();
    await page.getByRole("button", { name: /Confirm/i }).click();

    await expect(page.getByText("Mechanical Keyboard")).toBeVisible();
    await page.getByRole("button", { name: /Confirm/i }).click();

    await expect(page.getByText("3 items filed")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByText("Added 3 items")).toBeVisible();
    await expect(page.getByText("Desk Speaker")).toBeVisible();
    await expect(page.getByText("Headphones")).toBeVisible();
    await expect(page.getByText("Mechanical Keyboard")).toBeVisible();
  });
});
