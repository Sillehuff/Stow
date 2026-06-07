import { useState } from "react";
import { Plus } from "@/features/stow/ui/mobile/theme/icons";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";

export interface AddAreaSheetProps {
  open: boolean;
  areaCount: number;
  onClose: () => void;
  onCreate: (input: { name: string; position: number }) => void;
}

export function AddAreaSheet(props: AddAreaSheetProps) {
  const { open, areaCount, onClose, onCreate } = props;
  const [name, setName] = useState("");

  function submit() {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), position: areaCount });
    setName("");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add Area">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Area name" value={name} onChange={setName} placeholder="e.g. Top Shelf" />
        <Button variant="primary" disabled={!name.trim()} onClick={submit}>
          <Plus size={16} color="#fff" /> Add Area
        </Button>
      </div>
    </Sheet>
  );
}
