import { expect, test, type Locator, type Page } from "@playwright/test";

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
      const match = payload.oobCodes?.find((record) => {
        if (record.email !== email) return false;
        if (record.oobLink?.includes("mode=signIn")) return true;
        return record.requestType === "EMAIL_SIGNIN";
      });
      if (match) {
        if (match.oobLink) {
          const source = new URL(match.oobLink);
          const target = new URL("/auth/finish", APP_BASE_URL);
          for (const [key, value] of source.searchParams.entries()) {
            target.searchParams.set(key, value);
          }
          return target.toString();
        }

        if (match.oobCode) {
          const target = new URL("/auth/finish", APP_BASE_URL);
          target.searchParams.set("mode", "signIn");
          target.searchParams.set("oobCode", match.oobCode);
          target.searchParams.set("apiKey", "demo-api-key");
          return target.toString();
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for an email sign-in link for ${email}`);
}

async function signIn(page: Page, prefix = "smoke") {
  const email = `${prefix}-${Date.now()}@example.com`;

  await page.goto("/spaces");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Email Me a Sign-In Link" }).click();
  await expect(page.getByText(`Sign-in link sent to ${email}`)).toBeVisible();

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

async function createSpaceWithMainArea(page: Page) {
  await page.getByRole("button", { name: /^Add$/ }).click();
  const addSpaceDialog = page.getByRole("dialog", { name: "New Space" });
  await addSpaceDialog.getByLabel("Space name *").fill("Gear Closet");
  await addSpaceDialog.getByRole("button", { name: "Create Space" }).click();

  await expect(page.getByRole("heading", { name: "Gear Closet" })).toBeVisible();
  await page.getByRole("button", { name: /Main/i }).click();
  await expect(page.getByRole("heading", { name: "Main" })).toBeVisible();
}

async function setImageFile(dialog: Locator, name: string) {
  await dialog.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: "image/png",
    buffer: PNG_BYTES
  });
}

async function mockCallable(page: Page, functionName: string, result: unknown) {
  await page.route(`**/${functionName}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result })
    });
  });
}

async function openAddItemChoice(page: Page) {
  await page.locator(".fab").click();
}

test("capture-first add paths, deterministic Gemini assist, packing, and settings", async ({ page }) => {
  await mockCallable(page, "saveHouseholdLlmConfig", { ok: true });
  await mockCallable(page, "setHouseholdLlmSecret", { ok: true });
  await mockCallable(page, "validateHouseholdLlmConfig", { ok: true, message: "Connection successful" });
  await mockCallable(page, "visionCategorizeItemImage", {
    suggestion: {
      suggestedName: "AI Camera Draft",
      tags: ["tech", "camera"],
      notes: "Generated deterministic draft.",
      confidence: 0.84,
      rationale: "Visible camera-like shape."
    },
    provider: {
      providerType: "gemini",
      model: "gemini-2.5-flash"
    },
    jobId: "deterministic-job-1"
  });

  await signIn(page);
  await expect(page.getByRole("button", { name: /Scan or photograph/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add manually/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Scan QR label/i })).toBeVisible();

  await createSpaceWithMainArea(page);

  await openAddItemChoice(page);
  await page.getByRole("dialog", { name: "Add Item" }).getByRole("button", { name: /No photo/i }).click();
  const noPhotoDialog = page.getByRole("dialog", { name: "No Photo Item" });
  await noPhotoDialog.getByLabel("Name *").fill("Sensitive Documents");
  await noPhotoDialog.getByRole("button", { name: "Save Item" }).click();
  await expect(page.getByText("Sensitive Documents")).toBeVisible();

  await openAddItemChoice(page);
  await page.getByRole("dialog", { name: "Add Item" }).getByRole("button", { name: /Add manually/i }).click();
  const manualDialog = page.getByRole("dialog", { name: "Add Manually" });
  await manualDialog.getByLabel("Name *").fill("Travel Camera");
  await setImageFile(manualDialog, "travel-camera.png");
  await manualDialog.getByRole("button", { name: "Save Item" }).click();
  await expect(page.getByText("Travel Camera")).toBeVisible();

  for (const name of ["Delete Me Draft", "Complete Me Draft"]) {
    await openAddItemChoice(page);
    await page.getByRole("dialog", { name: "Add Item" }).getByRole("button", { name: /Photo now, details later/i }).click();
    const draftDialog = page.getByRole("dialog", { name: "Photo Draft" });
    await setImageFile(draftDialog, `${name.toLowerCase().replace(/\s+/g, "-")}.png`);
    await draftDialog.getByRole("button", { name: "Save Photo Draft" }).click();
    await expect(page.getByText("Photo draft saved")).toBeVisible();
  }

  await page.getByRole("button", { name: /Gear Closet/ }).click();
  await page.getByRole("button", { name: /Spaces/ }).click();
  await expect(page.getByText("Drafts")).toBeVisible();

  await page.getByRole("button", { name: "Delete draft" }).first().click();
  await page.getByRole("dialog", { name: "Delete Draft" }).getByRole("button", { name: "Delete Draft" }).click();
  await expect(page.getByText("Draft deleted")).toBeVisible();

  await page.getByRole("button", { name: /Photo draft|Complete Me Draft/ }).first().click();
  const completeDialog = page.getByRole("dialog", { name: "Complete Draft" });
  await completeDialog.getByLabel("Name *").fill("Draft Completed Item");
  await completeDialog.getByRole("button", { name: "Save Item" }).click();
  await expect(page.getByText("Draft completed")).toBeVisible();

  await page.getByRole("button", { name: /Scan or photograph/i }).click();
  const aiDialog = page.getByRole("dialog", { name: "AI Photo Assist" });
  await setImageFile(aiDialog, "ai-camera.png");
  await aiDialog.getByRole("button", { name: "Categorize Photo" }).click();
  await expect(aiDialog.getByText("Review Draft")).toBeVisible();
  await aiDialog.getByLabel("Suggested name").fill("AI Saved Camera");
  await aiDialog.getByRole("button", { name: "Save Item" }).click();

  await page.getByRole("button", { name: "Search" }).click();
  await page.getByPlaceholder("Items, tags, or spaces…").fill("Camera");
  await expect(page.getByText("Travel Camera")).toBeVisible();
  await expect(page.getByText("AI Saved Camera")).toBeVisible();
  await page.getByRole("button", { name: "Switch to grid view" }).click();
  await expect(page.getByRole("button", { name: /Open item AI Saved Camera/i })).toBeVisible();

  await page.getByRole("button", { name: /Open item AI Saved Camera/i }).click();
  await expect(page.getByText("Evidence")).toBeVisible();
  await expect(page.getByText("AI photo assist used")).toBeVisible();
  await page.getByRole("button", { name: "Back to list" }).click();

  await page.getByRole("button", { name: "Packing" }).click();
  await page.getByRole("button", { name: "New List" }).click();
  const newListDialog = page.getByRole("dialog", { name: "New Packing List" });
  await newListDialog.getByLabel("List name *").fill("Weekend Trip");
  await newListDialog.getByRole("button", { name: "Create List" }).click();

  await expect(page.getByRole("heading", { name: "Weekend Trip" })).toBeVisible();
  await page.getByRole("button", { name: "Add Items" }).click();
  const pickerDialog = page.getByRole("dialog", { name: "Select Items" });
  await pickerDialog.locator(".picker-item", { hasText: "Travel Camera" }).locator('input[type="checkbox"]').check();
  await pickerDialog.getByRole("button", { name: "Done" }).click();

  await expect(page.getByText("0 of 1 checked")).toBeVisible();
  await page.getByRole("button", { name: /Open item details for Travel Camera/i }).click();
  await page.getByRole("button", { name: "Delete item" }).click();
  await page.locator(".delete-confirm-card").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No items in this list")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Provider").selectOption("gemini");
  await page.getByLabel("Model").fill("gemini-2.5-flash");
  await page.getByLabel("API Key (stored encrypted)").fill("test-gemini-key");
  await page.getByRole("button", { name: "Save AI Settings" }).click();
  await expect(page.getByText("LLM settings saved")).toBeVisible();
  await page.getByRole("button", { name: "Test Connection" }).click();
  await expect(page.getByText("Connection successful")).toBeVisible();
});

test.describe("desktop capture workspace", () => {
  test.use({ viewport: { width: 1280, height: 850 }, isMobile: false, hasTouch: false });

  test("shows command, draft/navigation, and workspace regions", async ({ page }) => {
    await signIn(page, "desktop-smoke");
    await expect(page.getByRole("button", { name: /Scan or photograph/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add manually/i })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
  });
});
