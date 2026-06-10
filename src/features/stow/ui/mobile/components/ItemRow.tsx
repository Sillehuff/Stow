import type { ReactNode } from "react";
import type { Item } from "@/types/domain";
import { ChevronRight, Folder, Inbox, MapPin } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";

export function ItemRow({
  item,
  onClick,
  right,
  spaceName
}: {
  item: Item;
  onClick?: () => void;
  right?: ReactNode;
  spaceName?: string;
}) {
  const subtitle = [spaceName, item.areaNameSnapshot].filter(Boolean).join(" · ");

  return (
    <div
      onClick={onClick}
      style={{
        ...cardStyle,
        borderRadius: "var(--stow-radius-input)",
        padding: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: onClick ? "pointer" : "default"
      }}
    >
      {item.image?.downloadUrl ? (
        <img
          src={item.image.downloadUrl}
          alt=""
          style={{
            width: 46,
            height: 46,
            borderRadius: 11,
            objectFit: "cover",
            border: "1px solid var(--stow-border-l)",
            flexShrink: 0
          }}
        />
      ) : (
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 11,
            background: "var(--stow-canvas)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          {item.kind === "folder" ? <Folder size={18} color="var(--stow-warm)" /> : <Inbox size={18} color="var(--stow-warm)" />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--stow-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {item.name}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--stow-warm)",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            <MapPin size={10} color="var(--stow-warm)" style={{ verticalAlign: "-1px", marginRight: 3 }} />
            {subtitle}
          </div>
        ) : null}
      </div>
      {right ?? <ChevronRight size={15} color="var(--stow-border)" />}
    </div>
  );
}
