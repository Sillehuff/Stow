import { useEffect, useRef, useState } from "react";
import { Plus } from "@/features/stow/ui/mobile/theme/icons";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";

const SPACE_COLORS = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A"];

export interface AddSpaceSheetProps {
  open: boolean;
  spaceCount: number;
  onClose: () => void;
  onCreate: (input: { name: string; areas: Array<{ name: string }>; color: string; position: number }) => void;
}

export function AddSpaceSheet(props: AddSpaceSheetProps) {
  const { open, spaceCount, onClose, onCreate } = props;
  const [name, setName] = useState("");
  const [areas, setAreas] = useState("");
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setName("");
      setAreas("");
    }
    wasOpen.current = open;
  }, [open]);

  function submit() {
    if (!name.trim()) return;
    const areaList = areas
      ? areas
          .split(",")
          .map((area) => ({ name: area.trim() }))
          .filter((area) => area.name)
      : [{ name: "Main" }];
    onCreate({
      name: name.trim(),
      areas: areaList,
      color: SPACE_COLORS[spaceCount % SPACE_COLORS.length],
      position: spaceCount
    });
    setName("");
    setAreas("");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add Space">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Space name" value={name} onChange={setName} placeholder="e.g. Bedroom" />
        <Field label="Areas (comma separated)" value={areas} onChange={setAreas} placeholder="Closet, Nightstand, Dresser" />
        <Button variant="primary" disabled={!name.trim()} onClick={submit}>
          <Plus size={16} color="#fff" /> Create Space
        </Button>
      </div>
    </Sheet>
  );
}
