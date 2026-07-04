import { useMemo } from "react";
import type { ActivityEntry, HouseholdMember } from "@/types/domain";
import { Bell, ChevronLeft, ChevronRight } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { formatRelativeTime } from "@/features/stow/ui/mobile/screens/activitySelectors";
import { actorColor, initials } from "@/features/stow/ui/mobile/screens/avatar";

export interface ActivityScreenProps {
  activity: ActivityEntry[];
  members: HouseholdMember[];
  onBack: () => void;
  onOpenItem: (itemId: string) => void;
  onOpenSpace: (spaceId: string) => void;
}

function deepLink(entry: ActivityEntry, onOpenItem: (itemId: string) => void, onOpenSpace: (spaceId: string) => void) {
  if (entry.itemId) return () => onOpenItem(entry.itemId as string);
  if (entry.spaceId) return () => onOpenSpace(entry.spaceId as string);
  return undefined;
}

export function ActivityScreen(props: ActivityScreenProps) {
  const { activity, members, onBack, onOpenItem, onOpenSpace } = props;
  const membersByUid = useMemo(() => new Map(members.map((member) => [member.uid, member])), [members]);

  return (
    <section
      aria-label="Activity"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 25,
        display: "flex",
        flexDirection: "column",
        background: "var(--stow-canvas)"
      }}
    >
      <div
        style={{
          padding: "calc(env(safe-area-inset-top) + 24px) 14px 12px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
          alignItems: "center",
          gap: 8,
          background: "color-mix(in srgb, var(--stow-surface) 90%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--stow-border-l)",
          position: "sticky",
          top: 0,
          zIndex: 20
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            minWidth: 0,
            justifySelf: "start",
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--stow-accent)",
            fontWeight: 700,
            fontSize: 15,
            padding: "8px 4px",
            fontFamily: "inherit"
          }}
        >
          <ChevronLeft size={20} strokeWidth={2.5} color="var(--stow-accent)" />
          <span>Back</span>
        </button>

        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 900,
            color: "var(--stow-ink)",
            fontFamily: "var(--stow-display)",
            textAlign: "center"
          }}
        >
          Activity
        </h1>

        <div aria-hidden="true" />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px calc(env(safe-area-inset-bottom, 0px) + 88px)" }}>
        {activity.length === 0 ? (
          <div
            style={{
              minHeight: "52vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: "var(--stow-warm)",
              padding: "28px 20px"
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                display: "grid",
                placeItems: "center",
                background: "var(--stow-surface)",
                border: "1px solid var(--stow-border-l)",
                boxShadow: "var(--stow-shadow-soft)",
                marginBottom: 14
              }}
            >
              <Bell size={24} color="var(--stow-border)" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--stow-ink)" }}>No activity yet</div>
            <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, lineHeight: 1.45, maxWidth: 250 }}>
              Adds, moves, and status changes will show up here.
            </p>
          </div>
        ) : (
          <div
            style={{
              ...cardStyle,
              overflow: "hidden",
              borderRadius: "var(--stow-radius-card)"
            }}
          >
            {activity.map((entry, index) => {
              const member = membersByUid.get(entry.actorUid);
              const actorName = entry.actorName || member?.displayName || member?.email || "Someone";
              const onRow = deepLink(entry, onOpenItem, onOpenSpace);
              const RowTag = onRow ? "button" : "div";
              return (
                <RowTag
                  key={entry.id}
                  data-testid="activity-row"
                  type={onRow ? "button" : undefined}
                  onClick={onRow}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 14px",
                    background: "transparent",
                    border: "none",
                    borderBottom: index === activity.length - 1 ? "none" : "1px solid var(--stow-border-l)",
                    textAlign: "left",
                    fontFamily: "inherit",
                    cursor: onRow ? "pointer" : "default"
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      borderRadius: 99,
                      display: "grid",
                      placeItems: "center",
                      background: actorColor(entry.actorUid || actorName),
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900
                    }}
                  >
                    {initials(actorName)}
                  </span>
                  <span style={{ minWidth: 0, flex: 1, display: "grid", gap: 3 }}>
                    <span
                      style={{
                        fontSize: 14,
                        lineHeight: 1.32,
                        fontWeight: 700,
                        color: "var(--stow-ink)"
                      }}
                    >
                      {entry.summary}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 650, color: "var(--stow-warm)" }}>
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                  </span>
                  {onRow ? <ChevronRight size={17} color="var(--stow-ink-muted)" /> : null}
                </RowTag>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
