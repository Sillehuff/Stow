import { expect, test, type Locator, type Page } from "@playwright/test";

const PROJECT_ID = "demo-stow";
const APP_BASE_URL = "http://127.0.0.1:4273";

type OobCodeRecord = {
  email?: string;
  oobCode?: string;
  oobLink?: string;
  requestType?: string;
};

type FirestoreDoc = {
  name: string;
  fields?: Record<string, { stringValue?: string }>;
};

type AuthState = {
  uid: string;
  token: string;
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
  const email = `mobile-app-${Date.now()}@example.com`;

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

async function addSpace(page: Page, name: string, areas: string) {
  await page.getByRole("button", { name: "Add Space" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Space" });
  await dialog.getByPlaceholder("e.g. Bedroom").fill(name);
  await dialog.getByPlaceholder("Closet, Nightstand, Dresser").fill(areas);
  await dialog.getByRole("button", { name: "Create Space" }).click();
  await expect(page.getByText("Space created")).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

function spaceRow(page: Page, name: string): Locator {
  return page.getByText(name, { exact: true }).first().locator("xpath=ancestor::*[@data-reorder-row][1]");
}

async function openSpaceActions(page: Page, name: string) {
  const labelledButton = page.getByRole("button", { name: `${name} space actions` }).first();
  if (await labelledButton.isVisible()) {
    await labelledButton.click();
    return;
  }

  await spaceRow(page, name).getByRole("button").last().click();
}

async function clickAndExpectUrl(page: Page, target: Locator, expected: RegExp) {
  await target.click();
  try {
    await expect(page).toHaveURL(expected, { timeout: 4_000 });
    return;
  } catch {
    const box = await target.boundingBox();
    if (!box) throw new Error("Clickable target is not visible");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(expected);
  }
}

async function longPressDragAbove(page: Page, sourceName: string, targetName: string) {
  const sourceBox = await spaceRow(page, sourceName).boundingBox();
  const targetBox = await spaceRow(page, targetName).boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error(`Unable to find rows for ${sourceName} and ${targetName}`);
  }

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const targetY = targetBox.y + 4;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(400);
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(startX, startY + ((targetY - startY) * step) / 6);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
}

async function waitForValue<T>(label: string, resolve: () => Promise<T | null>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const value = await resolve();
    if (value) return value;
    await wait(250);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

function docId(doc: FirestoreDoc) {
  return doc.name.split("/").pop() ?? "";
}

function firestoreUrl(...segments: string[]) {
  return `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/${segments.map(encodeURIComponent).join("/")}`;
}

async function readBrowserAuthState(page: Page) {
  return waitForValue<AuthState>("browser auth state", async () =>
    page.evaluate(async () => {
      function authStateFromStorage(storage: Storage) {
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (!key?.startsWith("firebase:authUser:")) continue;
          const raw = storage.getItem(key);
          if (!raw) continue;
          try {
            const value = JSON.parse(raw) as { uid?: string; stsTokenManager?: { accessToken?: string } };
            if (value.uid && value.stsTokenManager?.accessToken) {
              return { uid: value.uid, token: value.stsTokenManager.accessToken };
            }
          } catch {
            // Keep scanning; Firebase controls the serialized shape.
          }
        }

        return null;
      }

      const storageState = authStateFromStorage(localStorage) ?? authStateFromStorage(sessionStorage);
      if (storageState) return storageState;

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("firebaseLocalStorageDb");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      try {
        const values = await new Promise<unknown[]>((resolve, reject) => {
          const tx = db.transaction("firebaseLocalStorage", "readonly");
          const request = tx.objectStore("firebaseLocalStorage").getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });

        for (const entry of values) {
          const candidate = entry as { value?: { uid?: string; stsTokenManager?: { accessToken?: string } } };
          const value = candidate.value ?? (entry as { uid?: string; stsTokenManager?: { accessToken?: string } });
          if (value.uid && value.stsTokenManager?.accessToken) {
            return { uid: value.uid, token: value.stsTokenManager.accessToken };
          }
        }

        return null;
      } finally {
        db.close();
      }
    })
  );
}

async function firestoreGet(page: Page, ...segments: string[]) {
  const authState = await readBrowserAuthState(page);
  const response = await fetch(firestoreUrl(...segments), {
    headers: { Authorization: `Bearer ${authState.token}` }
  });
  if (!response.ok) return null;
  return (await response.json()) as FirestoreDoc;
}

async function collectionDocs(page: Page, ...segments: string[]) {
  const authState = await readBrowserAuthState(page);
  const response = await fetch(firestoreUrl(...segments), {
    headers: { Authorization: `Bearer ${authState.token}` }
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { documents?: FirestoreDoc[] };
  return payload.documents ?? [];
}

async function householdIdForSignedInUser(page: Page) {
  const authState = await readBrowserAuthState(page);
  return waitForValue(`household for ${authState.uid}`, async () => {
    const userDoc = await firestoreGet(page, "users", authState.uid);
    return userDoc?.fields?.currentHouseholdId?.stringValue ?? null;
  });
}

async function findSpace(page: Page, name: string) {
  const householdId = await householdIdForSignedInUser(page);
  return waitForValue(`space ${name}`, async () => {
    const spaces = await collectionDocs(page, "households", householdId, "spaces");
    const match = spaces.find((space) => space.fields?.name?.stringValue === name);
    return match ? { householdId, id: docId(match) } : null;
  });
}

test.describe("mobile /app core parity", () => {
  test("add space, reorder, rename, delete; add no-photo item; search", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);

    await addSpace(page, "Garage", "Shelf A, Toolbox");
    await addSpace(page, "Office", "Desk, Cabinet");

    await longPressDragAbove(page, "Office", "Garage");
    await page.reload();
    await expect(page.getByText("Your Spaces")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Office", { exact: true })).toBeVisible();
    await expect(page.getByText("Garage", { exact: true })).toBeVisible();

    await openSpaceActions(page, "Office");
    await page.getByRole("menuitem", { name: "Edit space" }).click();
    const renameDialog = page.getByRole("dialog", { name: "Edit Space" });
    await renameDialog.getByPlaceholder("Space name").fill("Studio");
    await renameDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Space updated")).toBeVisible();
    await expect(page.getByText("Studio", { exact: true })).toBeVisible();

    const garage = await findSpace(page, "Garage");
    await page.goto(`/app/spaces/${garage.id}`);
    await expect(page.getByText("Shelf A", { exact: true })).toBeVisible();
    await clickAndExpectUrl(page, page.getByText("Shelf A", { exact: true }).first(), /\/app\/spaces\/[^/]+\/areas\/[^/]+$/);
    await expect(page.getByText("Shelf A", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add Item", exact: true }).click();
    const captureFirstDialog = page.getByRole("dialog", { name: "New Item" });
    await expect(captureFirstDialog.getByRole("button", { name: "Skip" })).toBeVisible();
    await captureFirstDialog.getByRole("button", { name: "Skip" }).click();
    const addItemDialog = page.getByRole("dialog", { name: "Add Item" });
    await addItemDialog.getByPlaceholder("e.g. Wireless Charger").fill("Cordless Drill");
    await addItemDialog.getByRole("button", { name: "Add Item" }).click();
    await expect(page.getByText("Item added")).toBeVisible();
    await expect(page.getByText("Cordless Drill")).toBeVisible();

    await page.getByRole("button", { name: "Search" }).click();
    await page.getByPlaceholder("Items, tags, or spaces...").fill("Cordless");
    await expect(page.getByText("Cordless Drill")).toBeVisible();

    await page.getByRole("button", { name: "Spaces" }).click();
    await openSpaceActions(page, "Studio");
    await page.getByRole("menuitem", { name: "Edit space" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit Space" });
    await editDialog.getByRole("button", { name: "Delete Space" }).first().click();
    const deletePanel = editDialog.getByText("Delete this space? This can't be undone.").locator("xpath=..");
    await expect(deletePanel).toBeVisible();
    const confirmDelete = deletePanel.getByRole("button", { name: "Delete Space" });
    await expect(confirmDelete).toBeEnabled();
    await confirmDelete.click({ force: true });
    await expect(page.getByText("Studio", { exact: true })).toHaveCount(0);
  });
});
