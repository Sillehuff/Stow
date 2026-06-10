import admin from "firebase-admin";

export interface StatusDoc {
  id: string;
  isPacked?: boolean;
  status?: string;
}

/**
 * Pure planner: derive `status` from `isPacked` (true -> "packed", else "home")
 * for docs that have no `status` yet. Idempotent.
 */
export function planStatus(docs: StatusDoc[]): Array<{ id: string; status: "packed" | "home" }> {
  const writes: Array<{ id: string; status: "packed" | "home" }> = [];
  for (const doc of docs) {
    if (typeof doc.status === "string" && doc.status.length > 0) continue;
    writes.push({ id: doc.id, status: doc.isPacked ? "packed" : "home" });
  }
  return writes;
}

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const BATCH_LIMIT = 450;

async function main(): Promise<void> {
  if (admin.apps.length === 0) admin.initializeApp();
  const db = admin.firestore();
  const dryRun = hasFlag("dry-run");
  const onlyHousehold = parseArg("household");

  const householdRefs = onlyHousehold
    ? [db.doc(`households/${onlyHousehold}`)]
    : (await db.collection("households").get()).docs.map((d) => d.ref);

  let itemWrites = 0;

  for (const householdRef of householdRefs) {
    const itemsSnap = await householdRef.collection("items").get();
    const docs: StatusDoc[] = itemsSnap.docs.map((d) => ({
      id: d.id,
      isPacked: d.get("isPacked") as boolean | undefined,
      status: d.get("status") as string | undefined,
    }));
    const plan = planStatus(docs);

    for (let i = 0; i < plan.length; i += BATCH_LIMIT) {
      const slice = plan.slice(i, i + BATCH_LIMIT);
      if (dryRun) {
        itemWrites += slice.length;
        continue;
      }
      const batch = db.batch();
      for (const { id, status } of slice) {
        batch.update(householdRef.collection("items").doc(id), {
          status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      itemWrites += slice.length;
    }
  }

  console.log(JSON.stringify({ dryRun, households: householdRefs.length, itemWrites }, null, 2));
}

const invokedDirectly = process.argv[1]?.includes("backfill-status");
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
