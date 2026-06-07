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
  const email = `mobile-capture-${Date.now()}@example.com`;

  await page.goto("/app");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Email Me a Sign-In Link" }).click();
  await expect(page.getByText(`Sign-in link sent to ${email}`)).toBeVisible();

  await page.goto(await waitForEmailLink(email));
  const finishSignInButton = page.getByRole("button", { name: "Finish Sign-In" });
  if (await finishSignInButton.isVisible()) {
    await page.getByPlaceholder("you@example.com").fill(email);
    await finishSignInButton.click();
  }

  await expect(page).toHaveURL(/\/app(?:$|[/?#])/);
  await expect(page.getByText("Your Spaces")).toBeVisible({ timeout: 20_000 });
}

async function addSpace(page: Page) {
  await page.getByRole("button", { name: "Add Space" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Space" });
  await dialog.getByPlaceholder("e.g. Bedroom").fill("Capture Closet");
  await dialog.getByPlaceholder("Closet, Nightstand, Dresser").fill("Shelf A");
  await dialog.getByRole("button", { name: "Create Space" }).click();
  await expect(page.getByText("Space created")).toBeVisible();
  await expect(page.getByText("Capture Closet", { exact: true })).toBeVisible();
}

async function mockVisionCallable(page: Page) {
  await page.route("**/visionCategorizeItemImage**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          suggestion: {
            suggestedName: "Sony WH-1000XM5",
            tags: ["Tech", "Audio"],
            notes: "Over-ear headphones",
            confidence: 0.9
          },
          provider: { providerType: "gemini", model: "test" },
          jobId: "test-job"
        }
      })
    });
  });
}

test.describe("mobile capture fallback", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    });
    await mockVisionCallable(page);
  });

  test("adds an item via file-input fallback with mocked vision", async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page);
    await addSpace(page);

    await page.getByRole("button", { name: "Scan" }).click();
    const scanDialog = page.getByRole("dialog", { name: "AI Scan" });
    await expect(scanDialog.getByText("Camera unavailable")).toBeVisible();
    await expect(scanDialog.getByRole("button", { name: "Choose from library" })).toBeVisible();

    const fileInput = scanDialog.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("capture", "environment");
    await fileInput.setInputFiles(FIXTURE);

    const addItemDialog = page.getByRole("dialog", { name: "Add Item" });
    await expect(addItemDialog.getByText("AI filled")).toBeVisible({ timeout: 20_000 });
    await expect(addItemDialog.getByPlaceholder("e.g. Wireless Charger")).toHaveValue("Sony WH-1000XM5");
    await expect(addItemDialog.getByText("2 tags")).toBeVisible();

    await addItemDialog.getByRole("button", { name: "Add Item" }).click();

    await expect(page.getByText("Item added")).toBeVisible();
    await expect(page.getByText("Sony WH-1000XM5")).toBeVisible();
  });
});
