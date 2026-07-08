import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Exhaustive interaction coverage for the canonical mobile app: every primary button and
// function across item detail, packing, search, settings, the scan menu, and accessibility.
// Several tests also assert the audit fixes end-to-end (CSV packed column, self-delete
// return-to-context, packing-picker packed reconcile, default-space preference, a11y rows).

const PROJECT_ID = "demo-stow";
const APP_BASE_URL = "http://127.0.0.1:4273";

type OobCodeRecord = { email?: string; oobCode?: string; oobLink?: string; requestType?: string };
type FirestoreDoc = { name: string; fields?: Record<string, { stringValue?: string }> };
type AuthState = { uid: string; token: string };

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
    await wait(500);
  }
  throw new Error(`Timed out waiting for an email sign-in link for ${email}`);
}

async function signIn(page: Page, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`;
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
  return email;
}

async function addSpace(page: Page, name: string, areas: string) {
  await page.getByRole("button", { name: "Add Space" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Space" });
  await dialog.getByPlaceholder("e.g. Bedroom").fill(name);
  await dialog.getByPlaceholder("Closet, Nightstand, Dresser").fill(areas);
  await dialog.getByRole("button", { name: "Create Space" }).click();
  await expect(page.getByText("Space created")).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

function firestoreUrl(...segments: string[]) {
  return `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/${segments.map(encodeURIComponent).join("/")}`;
}

async function readBrowserAuthState(page: Page) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const value = await page.evaluate(() => {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith("firebase:authUser:")) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as { uid?: string; stsTokenManager?: { accessToken?: string } };
          if (parsed.uid && parsed.stsTokenManager?.accessToken) {
            return { uid: parsed.uid, token: parsed.stsTokenManager.accessToken };
          }
        } catch {
          // keep scanning
        }
      }
      return null;
    });
    if (value) return value as AuthState;
    await wait(250);
  }
  throw new Error("Timed out reading browser auth state");
}

async function collectionDocs(page: Page, ...segments: string[]) {
  const auth = await readBrowserAuthState(page);
  const response = await fetch(firestoreUrl(...segments), { headers: { Authorization: `Bearer ${auth.token}` } });
  if (!response.ok) return [];
  const payload = (await response.json()) as { documents?: FirestoreDoc[] };
  return payload.documents ?? [];
}

async function firestoreGet(page: Page, ...segments: string[]) {
  const auth = await readBrowserAuthState(page);
  const response = await fetch(firestoreUrl(...segments), { headers: { Authorization: `Bearer ${auth.token}` } });
  if (!response.ok) return null;
  return (await response.json()) as FirestoreDoc;
}

async function waitForValue<T>(label: string, resolve: () => Promise<T | null>) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const value = await resolve();
    if (value) return value;
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function householdId(page: Page) {
  const auth = await readBrowserAuthState(page);
  return waitForValue(`household for ${auth.uid}`, async () => {
    const userDoc = await firestoreGet(page, "users", auth.uid);
    return userDoc?.fields?.currentHouseholdId?.stringValue ?? null;
  });
}

async function findSpace(page: Page, name: string) {
  const hid = await householdId(page);
  return waitForValue(`space ${name}`, async () => {
    const spaces = await collectionDocs(page, "households", hid, "spaces");
    const match = spaces.find((space) => space.fields?.name?.stringValue === name);
    return match ? { householdId: hid, id: match.name.split("/").pop() ?? "" } : null;
  });
}

async function findArea(page: Page, hid: string, spaceId: string, name: string) {
  return waitForValue(`area ${name}`, async () => {
    const areas = await collectionDocs(page, "households", hid, "spaces", spaceId, "areas");
    const match = areas.find((area) => area.fields?.name?.stringValue === name);
    return match ? (match.name.split("/").pop() ?? "") : null;
  });
}

// Open the given space's area page directly (bypasses list interactions for setup speed).
async function gotoArea(page: Page, name: string, areaName: string) {
  const space = await findSpace(page, name);
  const areaId = await findArea(page, space.householdId, space.id, areaName);
  await page.goto(`/spaces/${space.id}/areas/${areaId}`);
  await expect(page.getByText(areaName, { exact: true }).first()).toBeVisible();
  return space;
}

// Add a no-photo item to the currently-open area via the capture-first → skip → details path.
// Uses the always-present bottom "Add Item to <area>" button so it works for repeated adds
// (the bare "Add Item" empty-state button disappears once the area has items).
async function addItemHere(page: Page, name: string) {
  await page.getByRole("button", { name: /^Add Item to / }).first().click();
  const captureDialog = page.getByRole("dialog", { name: "New Item" });
  await expect(captureDialog).toBeVisible();
  await captureDialog.getByRole("button", { name: "Skip" }).click();
  const addItemSheet = page.getByRole("dialog", { name: "Add Item" });
  await expect(addItemSheet).toBeVisible();
  await addItemSheet.getByPlaceholder("e.g. Wireless Charger").fill(name);
  await addItemSheet.getByRole("button", { name: "Add Item" }).click();
  await expect(addItemSheet).toBeHidden();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

async function openItem(page: Page, name: string) {
  await page.getByRole("button", { name: `Open ${name}` }).first().click();
  await expect(page).toHaveURL(/\/items\/[^/?#]+/);
}

test.describe("comprehensive interaction coverage", () => {
  test("item detail: edit, packed toggle, status, tags, and move all work", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "detail");
    await addSpace(page, "Detail Lab", "Shelf A, Shelf B");
    await gotoArea(page, "Detail Lab", "Shelf A");
    await addItemHere(page, "Tripod");
    await openItem(page, "Tripod");

    // Edit name/value/notes. (exact avoids the case-insensitive clash with the bottom "Edit Item".)
    await page.getByRole("button", { name: "Edit item", exact: true }).click();
    await page.getByPlaceholder("Item name").fill("Carbon Tripod");
    await page.getByPlaceholder("0").fill("250");
    await page.getByPlaceholder("Serial number, purchase info...").fill("SN-12345");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Item updated")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Carbon Tripod" })).toBeVisible();

    // Packed quick-toggle (top-right Package button).
    await page.getByRole("button", { name: "Mark item packed" }).click();
    await expect(page.getByText("Marked packed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark item at home" })).toBeVisible();

    // Status grid → repair.
    await page.getByTestId("status-repair").click();
    await expect(page.getByText("Marked in repair")).toBeVisible();
    await expect(page.getByTestId("status-repair")).toHaveAttribute("aria-pressed", "true");

    // Tags: create a new tag, then remove it.
    await page.getByRole("button", { name: "+ Add" }).click();
    await page.getByPlaceholder("New tag...").fill("fragile");
    await page.getByRole("button", { name: "+ Create" }).click();
    await expect(page.getByRole("button", { name: /fragile/ })).toBeVisible();
    await page.getByRole("button", { name: /fragile/ }).click(); // toggle off (remove)
    await page.getByRole("button", { name: "Done" }).click();

    // Move to Shelf B.
    await page.getByRole("button", { name: "Move to another space" }).click();
    await page.getByRole("button", { name: "Shelf B", exact: true }).click();
    await page.getByRole("button", { name: "Move here" }).click();
    await expect(page.getByText("Item moved")).toBeVisible();
    await expect(page.getByText("Shelf B", { exact: true })).toBeVisible();
  });

  test("deleting an item from its detail view shows 'Item deleted' and returns to the area", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "delete");
    await addSpace(page, "Delete Lab", "Bin");
    await gotoArea(page, "Delete Lab", "Bin");
    await addItemHere(page, "Spare Cable");
    await addItemHere(page, "Keeper Item");

    await openItem(page, "Spare Cable");
    const itemUrl = page.url();
    await page.getByRole("button", { name: "Delete item" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Delete item?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete" }).click();

    // Fix [5]: self-delete shows the friendly toast, NOT "That item was removed", and returns
    // to the area the user came from (not the bare Spaces root).
    await expect(page.getByText("Item deleted")).toBeVisible();
    await expect(page.getByText("That item was removed")).toHaveCount(0);
    await expect(page).not.toHaveURL(itemUrl);
    await expect(page).toHaveURL(/\/spaces\/[^/]+\/areas\/[^/]+$/);
    await expect(page.getByText("Keeper Item", { exact: true })).toBeVisible();
  });

  test("CSV export reflects packed status (status === 'packed' → Yes)", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "csv");
    await addSpace(page, "Export Bay", "Crate");
    await gotoArea(page, "Export Bay", "Crate");
    await addItemHere(page, "Camp Tent");

    // Mark it packed via the item detail quick-toggle.
    await openItem(page, "Camp Tent");
    await page.getByRole("button", { name: "Mark item packed" }).click();
    await expect(page.getByText("Marked packed")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Export inventory row is now a real button; clicking it downloads the CSV.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export inventory (CSV)" }).click();
    await expect(page.getByText("Inventory exported")).toBeVisible();
    const download = await downloadPromise;
    const csv = readFileSync(await download.path(), "utf8");

    expect(csv.split("\n")[0]).toBe("Name,Space,Area,Tags,Value,Priceless,Packed,Notes");
    const tentRow = csv.split("\n").find((line) => line.startsWith("Camp Tent,"));
    expect(tentRow).toBeTruthy();
    // Columns: Name,Space,Area,Tags,Value,Priceless,Packed,Notes → Packed must be "Yes".
    expect(tentRow).toBe("Camp Tent,Export Bay,Crate,,,No,Yes,");
  });

  test("packing: full list lifecycle, and re-adding a removed item is not pre-packed", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "packing");
    await addSpace(page, "Trip Gear", "Bag");
    await gotoArea(page, "Trip Gear", "Bag");
    await addItemHere(page, "Passport");
    await addItemHere(page, "Charger");

    await page.getByRole("button", { name: "Packing" }).click();
    await expect(page.getByRole("heading", { name: "Packing" })).toBeVisible();

    // Create a list.
    await page.getByRole("button", { name: "New List" }).click();
    await page.getByPlaceholder("e.g. Summer trip").fill("Weekend");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Packing list created")).toBeVisible();

    // Open it and add both items via the picker.
    await page.getByText("Weekend", { exact: true }).click();
    await page.getByRole("button", { name: "Add Items" }).click();
    const picker = page.getByRole("dialog", { name: "Select Items" });
    await expect(picker).toBeVisible();
    await picker.getByText("Passport", { exact: true }).click();
    await picker.getByText("Charger", { exact: true }).click();
    await picker.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Packing list updated")).toBeVisible();

    // Pack Passport, then clear all.
    await page.getByRole("button", { name: "Mark Passport packed" }).click();
    await expect(page.getByText("1/2")).toBeVisible();
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByText("Packed items cleared")).toBeVisible();

    // Pack Passport again, then remove it via the picker.
    await page.getByRole("button", { name: "Mark Passport packed" }).click();
    await page.getByRole("button", { name: "Add Items" }).click();
    await expect(picker).toBeVisible();
    await picker.getByText("Passport", { exact: true }).click(); // unselect/remove
    await picker.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "Mark Passport packed" })).toHaveCount(0);

    // Re-add Passport — fix [12]: it must come back UNPACKED, not pre-checked.
    await page.getByRole("button", { name: "Add Items" }).click();
    await expect(picker).toBeVisible();
    await picker.getByText("Passport", { exact: true }).click();
    await picker.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "Mark Passport packed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Passport unpacked" })).toHaveCount(0);

    // Rename + delete the list via its action menu.
    await page.getByRole("button", { name: "Lists" }).click();
    await page.getByRole("button", { name: "Weekend list actions" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Rename" }).click();
    await page.getByRole("textbox").first().fill("Weekend Trip");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Packing list renamed")).toBeVisible();
    await expect(page.getByText("Weekend Trip", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Weekend Trip list actions" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Packing list deleted")).toBeVisible();
    await expect(page.getByText("Weekend Trip", { exact: true })).toHaveCount(0);
  });

  test("search: list/grid toggle, clear, and recent searches all work", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "search");
    await addSpace(page, "Find Space", "Spot");
    await gotoArea(page, "Find Space", "Spot");
    await addItemHere(page, "Lantern");

    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/search/);
    const input = page.getByPlaceholder("Items, tags, or spaces...");

    // No-match empty state.
    await input.fill("zzzznomatch");
    await expect(page.getByText("No results")).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(input).toHaveValue("");

    // Real match + grid/list toggle.
    await input.fill("Lantern");
    await expect(page.getByRole("button", { name: "Open Lantern" })).toBeVisible();
    await page.getByRole("button", { name: "Show grid view" }).click();
    await expect(page.getByRole("button", { name: "Show list view" })).toBeVisible();
    await page.getByRole("button", { name: "Show list view" }).click();
    await expect(page.getByRole("button", { name: "Show grid view" })).toBeVisible();

    // The recent-search write is debounced ~450ms while the query stays put; wait it out so
    // clearing the box (which cancels the pending timer) doesn't race the write.
    await page.waitForTimeout(800);

    // Recent search chip is recorded and re-runs the query when tapped.
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page.getByText("Recent")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Lantern" }).first().click();
    await expect(input).toHaveValue("Lantern");
  });

  test("settings: rename household, AI config, invite, and sign out", async ({ page }) => {
    test.setTimeout(120_000);
    // The functions emulator isn't running in this harness, so mock the callable endpoints.
    const ok = (result: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify({ result }) });
    await page.route("**/saveHouseholdLlmConfig**", (route) => route.fulfill(ok({ ok: true })));
    await page.route("**/setHouseholdLlmSecret**", (route) => route.fulfill(ok({ ok: true })));
    await page.route("**/validateHouseholdLlmConfig**", (route) => route.fulfill(ok({ ok: true, message: "Connected (mock)" })));
    await page.route("**/createHouseholdInvite**", (route) =>
      route.fulfill(ok({ inviteId: "inv-1", inviteUrl: "https://stow.example/invite?token=abc", expiresAt: "2099-01-01T00:00:00Z" }))
    );

    await signIn(page, "settings");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Rename household. The household-name Field has no placeholder, so target the first textbox
    // (the household card is the top of the settings scroll area).
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox").first().fill("My Test Home");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Household renamed")).toBeVisible();
    await expect(page.getByText("My Test Home", { exact: true })).toBeVisible();

    // AI vision: enable, save, test connection.
    await page.getByRole("switch", { name: "Toggle AI Vision" }).click();
    await page.getByRole("button", { name: "Save AI settings" }).click();
    await expect(page.getByText("AI settings saved")).toBeVisible();
    await page.getByRole("button", { name: "Test connection" }).click();
    await expect(page.getByText("Connected (mock)")).toBeVisible();

    // Create an invite — fix [11]: success is reported even if clipboard is unavailable.
    await page.getByRole("button", { name: "Create invite" }).click();
    await expect(page.getByText(/Invite created/)).toBeVisible();
    await expect(page.getByText("Could not create invite")).toHaveCount(0);

    // Sign out via the (now keyboard-accessible) preference row.
    await page.getByRole("button", { name: "Sign out" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Sign out?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Email Me a Sign-In Link" })).toBeVisible({ timeout: 15_000 });
  });

  test("scan menu opens each capture overlay and 'Add manually'", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "scan");

    // Add manually → the Add Item sheet, then close it.
    await page.getByRole("button", { name: "Scan" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Add manually" }).click();
    const addSheet = page.getByRole("dialog", { name: "Add Item" });
    await expect(addSheet).toBeVisible();
    await addSheet.getByRole("button", { name: "Close" }).click();
    await expect(addSheet).toBeHidden();

    // AI Scan overlay.
    await page.getByRole("button", { name: "Scan" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "AI Scan" }).click();
    const scanDialog = page.getByRole("dialog", { name: "AI Scan" });
    await expect(scanDialog).toBeVisible();
    await scanDialog.getByRole("button", { name: "Close" }).click();
    await expect(scanDialog).toBeHidden();

    // QR scan overlay.
    await page.getByRole("button", { name: "Scan" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Scan QR label" }).click();
    const qrDialog = page.getByRole("dialog", { name: "Scan QR label" });
    await expect(qrDialog).toBeVisible();
    await qrDialog.getByRole("button", { name: "Close" }).click();
  });

  test("default-space preference is honored by the add-item flow (fix [10])", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "defaultspace");
    await addSpace(page, "Aaa First Space", "Zone A");
    await addSpace(page, "Bbb Second Space", "Zone B");

    // Choose the (alphabetically later) second space as the default.
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByLabel("Default space").selectOption({ label: "Bbb Second Space" });

    // From Search (no current space), Add manually should default to the chosen space, not spaces[0].
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("button", { name: "Scan" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Add manually" }).click();
    const addSheet = page.getByRole("dialog", { name: "Add Item" });
    await expect(addSheet).toBeVisible();
    await expect(addSheet.getByText("Area in Bbb Second Space")).toBeVisible();
  });

  test("auth finish page: confirmation form completes sign-in when no email is stored", async ({ page }) => {
    test.setTimeout(120_000);
    const email = `authfinish-${Date.now()}@example.com`;
    await page.goto("/spaces");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByRole("button", { name: "Email Me a Sign-In Link" }).click();
    await expect(page.getByText(`Sign-in link sent to ${email}`)).toBeVisible();
    const link = await waitForEmailLink(email);

    // Drop the stored pending email so the finish page must fall back to its confirmation form.
    await page.evaluate(() => localStorage.clear());
    await page.goto(link);

    // The email-confirmation form is reachable (showForm in the idle state), and submitting the
    // correct email completes sign-in and redirects into the app.
    const finishButton = page.getByRole("button", { name: "Finish Sign-In" });
    await expect(finishButton).toBeVisible();
    await page.getByPlaceholder("you@example.com").fill(email);
    await finishButton.click();
    await expect(page).toHaveURL(/\/spaces/);
    await expect(page.getByText("Your Spaces")).toBeVisible({ timeout: 20_000 });
  });

  test("a11y: item rows, area cards, and settings rows are keyboard-operable buttons", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, "a11y");
    await addSpace(page, "Access Space", "Drawer");
    await gotoArea(page, "Access Space", "Drawer");
    await addItemHere(page, "Widget");

    // Item row is a real button reachable & activatable by keyboard.
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByPlaceholder("Items, tags, or spaces...").fill("Widget");
    const itemButton = page.getByRole("button", { name: "Open Widget" });
    await expect(itemButton).toBeVisible();
    await itemButton.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/items\/[^/?#]+/);
    await page.getByRole("button", { name: "Back" }).click();

    // Area card is a real button.
    const space = await findSpace(page, "Access Space");
    await page.goto(`/spaces/${space.id}`);
    const areaButton = page.getByRole("button", { name: "Open Drawer" });
    await expect(areaButton).toBeVisible();
    await areaButton.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/spaces\/[^/]+\/areas\/[^/]+$/);

    // Settings action rows are real buttons.
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("button", { name: "Export inventory (CSV)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
});
