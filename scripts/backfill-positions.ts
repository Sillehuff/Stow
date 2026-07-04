import admin from "firebase-admin";

export interface PositionDoc {
  id: string;
  name: string;
  position?: number;
}

/**
 * Pure planner: 0-based positions by case-insensitive name order (ties broken
 * by id for determinism). Only emits writes for docs missing `position`.
 */
export function planPositions(docs: PositionDoc[]): Array<{ id: string; position: number }> {
  const ordered = docs
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id));
  const writes: Array<{ id: string; position: number }> = [];
  ordered.forEach((doc, index) => {
    if (typeof doc.position !== "number") writes.push({ id: doc.id, position: index });
  });
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

async function commitBatched(
  refsWithData: Array<{ ref: FirebaseFirestore.DocumentReference; position: number }>,
  dryRun: boolean
): Promise<number> {
  let written = 0;
  for (let i = 0; i < refsWithData.length; i += BATCH_LIMIT) {
    const slice = refsWithData.slice(i, i + BATCH_LIMIT);
    if (dryRun) {
      written += slice.length;
      continue;
    }
    const batch = admin.firestore().batch();
    for (const { ref, position } of slice) {
      batch.update(ref, { position, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    await batch.commit();
    written += slice.length;
  }
  return written;
}

async function main(): Promise<void> {
  if (admin.apps.length === 0) admin.initializeApp();
  const db = admin.firestore();
  // Live writes require an explicit --apply; anything else is a dry run. Without a
  // --household filter this script touches every household in the project, so a
  // fat-fingered invocation must not default to mutating production.
  const dryRun = !hasFlag("apply");
  if (dryRun && !hasFlag("dry-run")) {
    console.log("No --apply flag: running as a dry run. Pass --apply to write.");
  }
  const onlyHousehold = parseArg("household");

  const householdRefs = onlyHousehold
    ? [db.doc(`households/${onlyHousehold}`)]
    : (await db.collection("households").get()).docs.map((d) => d.ref);
  if (!dryRun) {
    console.log(`Applying position backfill to ${householdRefs.length} household(s)...`);
  }

  let spaceWrites = 0;
  let areaWrites = 0;

  for (const householdRef of householdRefs) {
    const spacesSnap = await householdRef.collection("spaces").get();
    const spaceDocs: PositionDoc[] = spacesSnap.docs.map((d) => ({
      id: d.id,
      name: (d.get("name") as string) ?? "",
      position: d.get("position") as number | undefined,
    }));
    const spacePlan = planPositions(spaceDocs);
    spaceWrites += await commitBatched(
      spacePlan.map((w) => ({ ref: householdRef.collection("spaces").doc(w.id), position: w.position })),
      dryRun
    );

    // Areas are positioned among siblings within each space.
    for (const spaceSnap of spacesSnap.docs) {
      const areasSnap = await spaceSnap.ref.collection("areas").get();
      const areaDocs: PositionDoc[] = areasSnap.docs.map((d) => ({
        id: d.id,
        name: (d.get("name") as string) ?? "",
        position: d.get("position") as number | undefined,
      }));
      const areaPlan = planPositions(areaDocs);
      areaWrites += await commitBatched(
        areaPlan.map((w) => ({ ref: spaceSnap.ref.collection("areas").doc(w.id), position: w.position })),
        dryRun
      );
    }
  }

  console.log(
    JSON.stringify(
      { dryRun, households: householdRefs.length, spaceWrites, areaWrites },
      null,
      2
    )
  );
}

// Only run the admin path when invoked as a script, not when imported by tests.
const invokedDirectly = process.argv[1]?.includes("backfill-positions");
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
