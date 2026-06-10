import { useMemo } from "react";
import type { HouseholdMember, Item } from "@/types/domain";
import { Box, ChevronRight } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { STATUS_META } from "@/features/stow/ui/mobile/screens/StatusVocab";
import { formatRelativeTime, selectAwayItems } from "@/features/stow/ui/mobile/screens/activitySelectors";

export interface AwayStripProps {
  items: Item[];
  members: HouseholdMember[];
  onOpenItem: (itemId: string) => void;
}

function toMillis(value: unknown): number | null {
  if (!value || typeof (value as { toMillis?: unknown }).toMillis !== "function") return null;
  const ms = (value as { toMillis: () => number }).toMillis();
  return Number.isFinite(ms) ? ms : null;
}

function isOverdue(item: Item, now = Date.now()): boolean {
  const due = toMillis(item.loan?.due);
  return due != null && due < now;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name.trim();
}

function loanDisplay(item: Item, memberNameByUid: Map<string, string>): string {
  if (item.status !== "lent" || !item.loan) return "";
  const borrower = item.loan.to || (item.loan.toUid ? memberNameByUid.get(item.loan.toUid) ?? "" : "");
  const since = formatRelativeTime(item.loan.since);
  return [borrower ? firstName(borrower) : "", since].filter(Boolean).join(" · ");
}

function StatusPill({ item }: { item: Item }) {
  const meta = STATUS_META[item.status ?? "home"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        minWidth: 0,
        padding: "4px 8px",
        borderRadius: 99,
        background: meta.soft,
        color: meta.color,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap"
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 99, background: meta.color, flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}

export function AwayStrip({ items, members, onOpenItem }: AwayStripProps) {
  const away = useMemo(() => selectAwayItems(items), [items]);
  const memberNameByUid = useMemo(
    () => new Map(members.map((member) => [member.uid, member.displayName ?? member.email ?? "Household member"])),
    [members]
  );

  if (away.length === 0) return null;

  return (
    <section data-testid="away-strip" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 2px 10px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            color: "var(--stow-accent)"
          }}
        >
          Away from home
        </div>
        <span
          aria-label={`${away.length} away from home`}
          style={{
            minWidth: 22,
            height: 22,
            padding: "0 7px",
            borderRadius: 99,
            display: "grid",
            placeItems: "center",
            background: "var(--stow-accent-soft)",
            color: "var(--stow-accent)",
            fontSize: 11,
            fontWeight: 900
          }}
        >
          {away.length}
        </span>
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        {away.map((item, index) => {
          const loanMeta = loanDisplay(item, memberNameByUid);
          const overdue = isOverdue(item);
          return (
            <button
              key={item.id}
              type="button"
              data-testid="away-item"
              onClick={() => onOpenItem(item.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 13px",
                border: "none",
                borderBottom: index === away.length - 1 ? "none" : "1px solid var(--stow-border-l)",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit"
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  borderRadius: 14,
                  overflow: "hidden",
                  display: "grid",
                  placeItems: "center",
                  background: "var(--stow-canvas)",
                  border: "1px solid var(--stow-border-l)"
                }}
              >
                {item.image?.downloadUrl ? (
                  <img src={item.image.downloadUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Box size={20} color="var(--stow-border)" />
                )}
              </span>

              <span style={{ minWidth: 0, flex: 1, display: "grid", gap: 5 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "var(--stow-ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {item.name}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <StatusPill item={item} />
                  {loanMeta ? (
                    <span
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                        fontWeight: 700,
                        color: overdue ? "var(--stow-danger)" : "var(--stow-warm)"
                      }}
                    >
                      {loanMeta}
                    </span>
                  ) : null}
                </span>
              </span>

              <ChevronRight size={17} color="var(--stow-ink-muted)" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
