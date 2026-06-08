import { expect, test, type Page } from "@playwright/test";

const PROJECT_ID = "demo-stow";
const APP_BASE_URL = "http://127.0.0.1:4273";

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
  // The canonical mobile app renders the retrieval-first home at /spaces.
  await expect(page).toHaveURL(/\/spaces/);
  await expect(page.getByText("Your Spaces")).toBeVisible({ timeout: 20_000 });
}

// Creates a space (with a default "Main" area) from the home screen and opens it.
// Returns the space's canonical /spaces/<id> URL.
async function createAndOpenSpace(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "Add Space" }).click();
  const addSpaceSheet = page.getByRole("dialog", { name: "Add Space" });
  await addSpaceSheet.getByPlaceholder("e.g. Bedroom").fill(name);
  await addSpaceSheet.getByRole("button", { name: "Create Space" }).click();
  await expect(addSpaceSheet).toBeHidden();

  // The new space appears in the "Your Spaces" list; opening it routes to /spaces/<id>.
  await expect(page.getByText(name)).toBeVisible();
  await page.getByText(name).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+$/);

  return page.url();
}

test("mobile canonical app: spaces, add item, search, packing, settings", async ({ page }) => {
  await signIn(page);

  // Bottom nav + scan FAB are the canonical mobile shell.
  await expect(page.getByRole("navigation", { name: "Stow sections" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan" })).toBeVisible();

  // Add a space and open it (URL -> /spaces/:id).
  await createAndOpenSpace(page, "Gear Closet");

  // Open the default "Main" area (URL -> /spaces/:id/areas/:areaId).
  await page.getByText("Main").click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/areas\/[^/]+$/);

  // Capture-first: the empty area's "Add Item" opens the camera; skip to manual details.
  await page.getByRole("button", { name: "Add Item", exact: true }).click();
  const captureDialog = page.getByRole("dialog", { name: "New Item" });
  await expect(captureDialog).toBeVisible();
  await captureDialog.getByRole("button", { name: "Skip" }).click();

  const addItemSheet = page.getByRole("dialog", { name: "Add Item" });
  await expect(addItemSheet).toBeVisible();
  await addItemSheet.getByPlaceholder("e.g. Wireless Charger").fill("Travel Camera");
  await addItemSheet.getByRole("button", { name: "Add Item" }).click();
  await expect(addItemSheet).toBeHidden();
  await expect(page.getByText("Travel Camera")).toBeVisible();

  // Search tab (URL -> /search) finds the item.
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search/);
  await page.getByPlaceholder("Items, tags, or spaces...").fill("Camera");
  await expect(page.getByText("Travel Camera")).toBeVisible();

  // Packing tab (URL -> /packing).
  await page.getByRole("button", { name: "Packing" }).click();
  await expect(page).toHaveURL(/\/packing/);
  await expect(page.getByRole("heading", { name: "Packing" })).toBeVisible();

  // Settings tab (URL -> /settings).
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("mobile canonical app: per-space QR deep link round-trips", async ({ page }) => {
  await signIn(page, "qr-smoke");

  const spaceUrl = await createAndOpenSpace(page, "QR Cabinet");
  const spacePath = new URL(spaceUrl).pathname;

  // Open the per-space QR sheet from the room header; it shows the /spaces/<id> link.
  await page.getByRole("button", { name: "Space QR" }).click();
  const qrSheet = page.getByRole("dialog", { name: /QR label$/ });
  await expect(qrSheet).toBeVisible();
  await expect(qrSheet.getByText(spaceUrl, { exact: true })).toBeVisible();
  await expect(qrSheet.getByText(spacePath)).toBeVisible();
  await qrSheet.getByRole("button", { name: "Close" }).click();
  await expect(qrSheet).toBeHidden();

  // Navigating to the captured link reopens the room (heading = space name).
  await page.goto(spaceUrl);
  await expect(page).toHaveURL(spacePath);
  await expect(page.getByText("QR Cabinet")).toBeVisible();
});
