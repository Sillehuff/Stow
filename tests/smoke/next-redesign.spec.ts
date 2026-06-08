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
  const email = `next-redesign-${Date.now()}@example.com`;
  await page.goto("/next");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Email Me a Sign-In Link" }).click();
  await expect(page.getByText(`Sign-in link sent to ${email}`)).toBeVisible();
  await page.goto(await waitForEmailLink(email));
  const finishSignInButton = page.getByRole("button", { name: "Finish Sign-In" });
  if (await finishSignInButton.isVisible()) {
    await page.getByPlaceholder("you@example.com").fill(email);
    await finishSignInButton.click();
  }
  await expect(page).toHaveURL(/\/next/);
  await expect(page.getByRole("heading", { name: "Organize inventory" })).toBeVisible({ timeout: 20_000 });
}

test.describe("next redesign", () => {
  test.use({ viewport: { width: 1280, height: 850 }, isMobile: false, hasTouch: false });

  test("supports core organize, find, pack, and settings flows", async ({ page }) => {
    await signIn(page);

    await page.getByPlaceholder("New space").fill("Next Smoke Home");
    await page.getByRole("button", { name: "Add space" }).click();
    await expect(page.getByRole("button", { name: "Next Smoke Home 1 areas" })).toBeVisible();

    await page.getByRole("button", { name: "No photo Text-only" }).click();
    await page.getByPlaceholder("e.g. Passport folder").fill("Next Smoke Folder");
    await page.getByRole("button", { name: "Save item" }).click();
    await expect(page.getByText("Photo intentionally skipped")).toBeVisible();
    await expect(page.getByText("AI not used")).toBeVisible();

    await page.getByRole("button", { name: /Find/ }).click();
    await page.getByPlaceholder("Search names, tags, notes, places").fill("smoke");
    await expect(page.locator(".next-find-list").getByRole("button", { name: /Next Smoke Folder/ })).toBeVisible();

    await page.getByRole("button", { name: "Pack", exact: true }).click();
    await page.getByPlaceholder("New packing list").fill("Next Smoke Kit");
    await page.getByRole("button", { name: "Create packing list" }).click();
    await page.getByPlaceholder("Search inventory to add").fill("smoke");
    await page.locator(".next-inventory-pick").getByRole("button", { name: /Next Smoke Folder/ }).click();
    await expect(page.getByRole("button", { name: "Check", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByText("1 of 1 checked")).toBeVisible();
    await page.getByRole("button", { name: "Clear checks" }).click();
    await page.getByRole("dialog", { name: "Clear checked items?" }).getByRole("button", { name: "Clear checks" }).click();
    await expect(page.getByText("0 of 1 checked")).toBeVisible();

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Household settings" })).toBeVisible();
    await expect(page.locator(".next-section-head").getByText("Members", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Invite role")).toBeVisible();
    await expect(page.getByText("Enable AI photo assist")).toBeVisible();
    await expect(page.getByText("Review required. Keys stay server-side.")).toBeVisible();
    await page.getByText("Connection", { exact: true }).click();
    await expect(page.getByLabel("Provider")).toHaveValue("gemini");
    await page.getByText("Expert tuning").click();
    await expect(page.getByText("Creativity")).toBeVisible();
    await page.getByLabel("Invite role").selectOption("ADMIN");
    await page.getByRole("button", { name: "Create invite" }).click();
    await expect(page.getByRole("dialog", { name: "Create admin invite?" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Create admin invite?" }).getByRole("button", { name: "Cancel" })).toBeFocused();
    await expect(page.getByText("Anyone with this link can join")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Create admin invite?" })).toBeHidden();
    await page.locator(".next-support-details").getByText("Support", { exact: true }).click();
    await expect(page.getByRole("link", { name: "Open legacy spaces" })).toHaveAttribute("href", "/spaces");

    await page.goto("/next?preview=mobile");
    await expect(page.getByRole("heading", { name: "Organize inventory" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Locations/ })).toBeVisible();
    await expect(page.getByText("Location map")).toBeHidden();
    await page.getByRole("button", { name: /Locations/ }).click();
    await expect(page.getByText("Location map")).toBeVisible();
    await page.getByRole("button", { name: "Home capture" }).click();
    await expect(page.getByText("Location map")).toBeHidden();
    await page.getByRole("button", { name: /Locations/ }).click();
    await page.locator(".next-item-grid").getByRole("button", { name: /Next Smoke Folder/ }).click();
    await expect(page.getByText("Item inspector")).toBeVisible();
    await expect(page.getByText("Photo intentionally skipped")).toBeVisible();
    await page.locator(".next-mobile-nav").getByRole("button", { name: "Find" }).click();
    await expect(page.locator(".next-mobile-nav").getByRole("button", { name: "Find" })).toHaveAttribute("aria-current", "page");
    await page.locator(".next-mobile-nav").getByRole("button", { name: "Settings" }).click();
    await expect(page.locator(".next-mobile-nav").getByRole("button", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });
});
