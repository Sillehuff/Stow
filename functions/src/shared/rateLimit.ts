import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths } from "./firestore.js";

const DEFAULT_DAILY_LIMIT = 200;

/**
 * Transactional per-household daily counter for vision calls. The usage doc lives under
 * settings/*, which firestore.rules denies to ALL clients — only functions read/write it.
 * The tx.get arms the version check so concurrent scans can't skip past the cap.
 *
 * The day boundary is UTC (toISOString slice), shared by every household regardless of
 * local timezone — acceptable for a coarse spend cap. The counter increments on a
 * successful reservation; if the later provider call fails the slot is still consumed,
 * which is the safe direction for a budget guard (it never over-spends).
 */
export async function consumeVisionQuota(householdId: string): Promise<void> {
  // Guard the override: Number("abc") is NaN (used >= NaN is always false, disabling the
  // cap) and Number("") is 0 (blocks every scan). Fall back to the default unless the env
  // parses to a finite positive number.
  const parsed = Number(process.env.VISION_DAILY_LIMIT);
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc(paths.visionUsage(householdId));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const sameDay = snap.exists && snap.get("day") === day;
    const used = sameDay ? Number(snap.get("count") ?? 0) : 0;
    if (used >= limit) {
      throw new HttpsError(
        "resource-exhausted",
        "Daily AI scan limit reached for this household. Try again tomorrow."
      );
    }
    tx.set(ref, { day, count: used + 1, updatedAt: FieldValue.serverTimestamp() });
  });
}
