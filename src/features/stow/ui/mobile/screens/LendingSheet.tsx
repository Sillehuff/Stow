import { useEffect, useMemo, useState } from "react";
import type { HouseholdMember } from "@/types/domain";
import { Check, Users } from "@/features/stow/ui/mobile/theme/icons";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";

export interface LendingSheetProps {
  open: boolean;
  members: HouseholdMember[];
  initial?: { to?: string; due?: string; note?: string };
  onCancel: () => void;
  onConfirm: (loan: { to: string; toUid?: string; dueMs?: number; note?: string }) => Promise<void> | void;
}

const SWATCHES = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A", "#2A6FDB", "#D6336C"];

function actorColor(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i += 1) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return SWATCHES[h % SWATCHES.length] ?? "var(--stow-accent)";
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((word) => word[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function memberName(member: HouseholdMember): string {
  return member.displayName ?? member.email ?? "Household member";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name.trim();
}

function parseDueMs(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

export function LendingSheet({ open, members, initial, onCancel, onConfirm }: LendingSheetProps) {
  const initialMember = useMemo(
    () => members.find((member) => initial?.to && (member.displayName === initial.to || member.email === initial.to)) ?? null,
    [initial?.to, members]
  );
  const [selectedUid, setSelectedUid] = useState<string | null>(initialMember?.uid ?? null);
  const [otherOpen, setOtherOpen] = useState(Boolean(initial?.to && !initialMember));
  const [otherName, setOtherName] = useState(initialMember ? "" : initial?.to ?? "");
  const [due, setDue] = useState(initial?.due ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextMember = members.find((member) => initial?.to && (member.displayName === initial.to || member.email === initial.to)) ?? null;
    setSelectedUid(nextMember?.uid ?? null);
    setOtherOpen(Boolean(initial?.to && !nextMember));
    setOtherName(nextMember ? "" : initial?.to ?? "");
    setDue(initial?.due ?? "");
    setNote(initial?.note ?? "");
    setSaving(false);
  }, [initial?.due, initial?.note, initial?.to, members, open]);

  const selectedMember = selectedUid ? members.find((member) => member.uid === selectedUid) ?? null : null;
  const borrower = selectedMember ? memberName(selectedMember) : otherName.trim();
  const canSave = Boolean(borrower) && !saving;

  async function confirm() {
    if (!canSave) return;
    setSaving(true);
    try {
      const dueMs = parseDueMs(due);
      await onConfirm({
        to: borrower,
        ...(selectedMember ? { toUid: selectedMember.uid } : {}),
        ...(dueMs ? { dueMs } : {}),
        ...(note.trim() ? { note: note.trim() } : {})
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onCancel} title="Loan details">
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--stow-warm)", marginBottom: 8 }}>
            Lent to
          </div>
          <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 2, margin: "0 -24px", paddingLeft: 24, paddingRight: 24 }}>
            {members.map((member) => {
              const name = memberName(member);
              const selected = selectedUid === member.uid;
              return (
                <button
                  key={member.uid}
                  type="button"
                  data-testid={`borrower-${member.uid}`}
                  onClick={() => {
                    setSelectedUid(member.uid);
                    setOtherOpen(false);
                    setOtherName("");
                  }}
                  style={{
                    minWidth: 116,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 16,
                    padding: "10px 12px",
                    border: selected ? "none" : "1px solid var(--stow-border-l)",
                    background: selected ? "var(--stow-accent-soft)" : "var(--stow-canvas)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "var(--stow-ink)"
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 99,
                      display: "grid",
                      placeItems: "center",
                      background: actorColor(member.uid),
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 900,
                      flexShrink: 0
                    }}
                  >
                    {initials(name)}
                  </span>
                  <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 800 }}>
                    {firstName(name)}
                  </span>
                  {selected ? <Check size={13} color="var(--stow-accent)" strokeWidth={3} /> : null}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setSelectedUid(null);
                setOtherOpen(true);
              }}
              style={{
                minWidth: 98,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                borderRadius: 16,
                padding: "10px 12px",
                border: otherOpen ? "none" : "1px dashed var(--stow-border)",
                background: otherOpen ? "var(--stow-accent-soft)" : "var(--stow-canvas)",
                color: otherOpen ? "var(--stow-accent)" : "var(--stow-ink-soft)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 800
              }}
            >
              <Users size={14} /> Other
            </button>
          </div>
        </div>

        {otherOpen ? <Field label="Borrower" value={otherName} onChange={setOtherName} placeholder="Name" /> : null}
        <Field label="Due date" type="date" value={due} onChange={setDue} />
        <Field label="Note" multiline value={note} onChange={setNote} placeholder="Condition, reminders, or context..." />

        <button
          type="button"
          data-testid="loan-save"
          disabled={!canSave}
          onClick={() => void confirm()}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: "var(--stow-radius-button)",
            fontWeight: 700,
            fontSize: 15,
            cursor: canSave ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: canSave ? 1 : 0.55,
            fontFamily: "inherit",
            background: "var(--stow-accent)",
            color: "#fff",
            border: "none"
          }}
        >
          {saving ? "Saving..." : borrower ? `Save · Lent to ${firstName(borrower)}` : "Save loan"}
        </button>
      </div>
    </Sheet>
  );
}
