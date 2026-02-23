import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { User } from "firebase/auth";
import { useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode";
import {
  Home,
  Search,
  Package,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  Folder,
  Box,
  Camera,
  Grid,
  X,
  Trash2,
  Edit,
  CheckCircle,
  Tag,
  Upload,
  Users,
  KeyRound,
  LogOut,
  Sparkles
} from "lucide-react";
import { useWorkspaceData } from "@/features/stow/hooks/useWorkspaceData";
import type { ImageRef, Item, Role } from "@/types/domain";
import type { HouseholdLlmConfig, VisionSuggestion } from "@/types/llm";
import {
  createHouseholdInvite,
  saveHouseholdLlmConfig,
  setHouseholdLlmSecret,
  validateHouseholdLlmConfig,
  visionCategorizeItemImage
} from "@/lib/firebase/functions";
import { storagePaths } from "@/lib/firebase/paths";
import { imageRefFromUrl, uploadFileToStorage } from "@/lib/firebase/storage";

const P = {
  ink: "#1A1A2E",
  inkSoft: "#2D2D44",
  inkMuted: "#6B6B80",
  warm: "#9595A8",
  border: "#E8E8EE",
  borderL: "#F0F0F5",
  surface: "#FFFFFF",
  canvas: "#F7F7FA",
  accent: "#E8652B",
  accentSoft: "#FFF0EA",
  success: "#2D9F6F",
  successSoft: "#EAFAF2",
  danger: "#E04545",
  dangerSoft: "#FFF0F0"
} as const;

type TabKey = "spaces" | "search" | "packing" | "settings";

type AddItemForm = {
  name: string;
  kind: "item" | "folder";
  spaceId: string;
  areaId: string;
  value: string;
  isPriceless: boolean;
  tags: string;
  notes: string;
  imageUrl: string;
  imageFile: File | null;
};

type VisionDraft = {
  imageUrl?: string;
  imageFile: File | null;
  uploadRef?: ImageRef;
  suggestion: VisionSuggestion | null;
  spaceId: string;
  areaId: string;
  notes: string;
  tagsCsv: string;
  name: string;
};

function iconForSpace(icon: string) {
  switch (icon) {
    case "home":
      return Home;
    default:
      return Box;
  }
}

function Modal({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="overlay">
      <div className="overlay-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(
  props: InputHTMLAttributes<HTMLInputElement> & {
    className?: string;
  }
) {
  return <input {...props} className={["input", props.className].filter(Boolean).join(" ")} />;
}

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={["textarea", props.className].filter(Boolean).join(" ")} />;
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={["select", props.className].filter(Boolean).join(" ")} />;
}

function ImagePicker({
  label,
  imageUrl,
  onImageUrlChange,
  onFileChange
}: {
  label: string;
  imageUrl: string;
  onImageUrlChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <div className="stack-sm">
      <Field label={`${label} (URL fallback)`}>
        <TextInput value={imageUrl} onChange={(e) => onImageUrlChange(e.target.value)} placeholder="https://..." />
      </Field>
      <Field label={`${label} (camera / gallery)`}>
        <input
          className="input file-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </Field>
    </div>
  );
}

function StatusPill({
  color,
  children
}: {
  color: "default" | "success" | "warn";
  children: ReactNode;
}) {
  return <span className={`pill ${color}`}>{children}</span>;
}

function formatCurrency(value?: number, isPriceless?: boolean) {
  if (isPriceless) return "Priceless";
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function randomColor() {
  return `hsl(${Math.floor(Math.random() * 360)} 50% 45%)`;
}

function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const flash = (message: string) => {
    setToast(message);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  return { toast, flash };
}

async function resolveImageRef({
  householdId,
  target,
  targetId,
  file,
  url
}: {
  householdId: string;
  target: "item" | "space" | "area" | "draft";
  targetId: string;
  file: File | null;
  url: string;
}): Promise<ImageRef | undefined> {
  if (file) {
    const safeName = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const path =
      target === "item"
        ? storagePaths.itemImage(householdId, targetId, safeName)
        : target === "space"
          ? storagePaths.spaceCover(householdId, targetId, safeName)
          : target === "area"
            ? storagePaths.areaCover(householdId, targetId, safeName)
            : storagePaths.draftImage(householdId, targetId, safeName);
    return uploadFileToStorage(path, file, { contentType: file.type || undefined });
  }

  if (url.trim()) return imageRefFromUrl(url);
  return undefined;
}

function NavButton({
  active,
  label,
  icon: Icon,
  onClick,
  badge
}: {
  active: boolean;
  label: string;
  icon: typeof Home;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button className={`nav-btn ${active ? "active" : ""}`} onClick={onClick}>
      <div className="nav-icon-wrap">
        <Icon size={20} />
        {badge ? <span className="badge">{badge}</span> : null}
      </div>
      <span>{label}</span>
    </button>
  );
}

export function StowApp({
  householdId,
  user,
  onSignOut,
  online
}: {
  householdId: string;
  user: User;
  onSignOut: () => void;
  online: boolean;
}) {
  const navigate = useNavigate();
  const params = useParams();
  const { toast, flash } = useToast();
  const workspace = useWorkspaceData(householdId, user);

  const [tab, setTab] = useState<TabKey>("spaces");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(params.spaceId ?? null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [showAddArea, setShowAddArea] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showQrForSpaceId, setShowQrForSpaceId] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [visionWorking, setVisionWorking] = useState(false);
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteWorking, setInviteWorking] = useState(false);
  const [llmSecretInput, setLlmSecretInput] = useState("");
  const [llmSaveWorking, setLlmSaveWorking] = useState(false);
  const [llmValidateWorking, setLlmValidateWorking] = useState(false);

  const [llmForm, setLlmForm] = useState<HouseholdLlmConfig>({
    enabled: false,
    providerType: "openai_compatible",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    promptProfile: "default_inventory",
    temperature: 0.2,
    maxTokens: 400
  });

  const [addSpaceForm, setAddSpaceForm] = useState({
    name: "",
    icon: "box" as const,
    color: randomColor(),
    areaNames: "",
    imageUrl: "",
    imageFile: null as File | null
  });

  const [addAreaForm, setAddAreaForm] = useState({
    name: "",
    imageUrl: "",
    imageFile: null as File | null
  });

  const [addItemForm, setAddItemForm] = useState<AddItemForm>({
    name: "",
    kind: "item",
    spaceId: "",
    areaId: "",
    value: "",
    isPriceless: false,
    tags: "",
    notes: "",
    imageUrl: "",
    imageFile: null
  });

  const [editItemForm, setEditItemForm] = useState<AddItemForm | null>(null);

  const [visionDraft, setVisionDraft] = useState<VisionDraft>({
    imageFile: null,
    imageUrl: "",
    suggestion: null,
    spaceId: "",
    areaId: "",
    notes: "",
    tagsCsv: "",
    name: ""
  });

  useEffect(() => {
    if (workspace.llmConfig) {
      setLlmForm((prev) => ({ ...prev, ...workspace.llmConfig }));
    }
  }, [workspace.llmConfig]);

  useEffect(() => {
    const routeSpaceId = params.spaceId ?? null;
    if (routeSpaceId && routeSpaceId !== selectedSpaceId) {
      setTab("spaces");
      setSelectedSpaceId(routeSpaceId);
      setSelectedAreaId(null);
    }
  }, [params.spaceId, selectedSpaceId]);

  const spaces = workspace.spaces;
  const items = workspace.items;
  const members = workspace.members;
  const currentSpace = spaces.find((space) => space.id === selectedSpaceId) ?? null;
  const currentArea = currentSpace?.areas.find((area) => area.id === selectedAreaId) ?? null;
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  const itemsBySpace = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const list = map.get(item.spaceId);
      if (list) list.push(item);
      else map.set(item.spaceId, [item]);
    }
    return map;
  }, [items]);

  const spaceItems = selectedSpaceId ? items.filter((item) => item.spaceId === selectedSpaceId) : [];
  const filteredSpaceItems = selectedAreaId ? spaceItems.filter((item) => item.areaId === selectedAreaId) : spaceItems;
  const packedItems = items.filter((item) => item.isPacked);
  const allTags = [...new Set(items.flatMap((item) => item.tags ?? []))].sort((a, b) => a.localeCompare(b));
  const searchedItems = searchQuery
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase();
        const inName = item.name.toLowerCase().includes(q);
        const inTags = item.tags.some((tag) => tag.toLowerCase().includes(q));
        const inArea = item.areaNameSnapshot.toLowerCase().includes(q);
        const inSpace = spaces.find((space) => space.id === item.spaceId)?.name.toLowerCase().includes(q) ?? false;
        return inName || inTags || inArea || inSpace;
      })
    : items;

  useEffect(() => {
    if (!showQrForSpaceId) {
      setQrImageUrl(null);
      return;
    }
    const url = `${window.location.origin}/spaces/${showQrForSpaceId}`;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#1A1A2E", light: "#FFFFFF" } })
      .then(setQrImageUrl)
      .catch(() => setQrImageUrl(null));
  }, [showQrForSpaceId]);

  useEffect(() => {
    if (!selectedItem) {
      setEditItemForm(null);
      return;
    }
    setEditItemForm({
      name: selectedItem.name,
      kind: selectedItem.kind,
      spaceId: selectedItem.spaceId,
      areaId: selectedItem.areaId,
      value: selectedItem.value ? String(selectedItem.value) : "",
      isPriceless: Boolean(selectedItem.isPriceless),
      tags: selectedItem.tags.join(", "),
      notes: selectedItem.notes ?? "",
      imageUrl: selectedItem.image?.downloadUrl ?? "",
      imageFile: null
    });
  }, [selectedItem]);

  useEffect(() => {
    if (showAddItem) {
      setAddItemForm((prev) => ({
        ...prev,
        spaceId: prev.spaceId || selectedSpaceId || spaces[0]?.id || "",
        areaId:
          prev.areaId ||
          selectedAreaId ||
          spaces.find((space) => space.id === (prev.spaceId || selectedSpaceId || spaces[0]?.id))?.areas[0]?.id ||
          ""
      }));
    }
  }, [selectedAreaId, selectedSpaceId, showAddItem, spaces]);

  const currentSpaceForAddItem = spaces.find((space) => space.id === addItemForm.spaceId) ?? null;
  const currentAreaForAddItem = currentSpaceForAddItem?.areas.find((area) => area.id === addItemForm.areaId) ?? null;

  const syncText = workspace.sync.hasPendingWrites
    ? "Syncing changes…"
    : workspace.sync.fromCache && online
      ? "Using cached data"
      : online
        ? "Live"
        : "Offline";

  async function submitAddSpace(event: FormEvent) {
    event.preventDefault();
    if (!workspace.userId || !addSpaceForm.name.trim()) return;
    setSaving(true);
    try {
      const tempId = crypto.randomUUID();
      const image = await resolveImageRef({
        householdId,
        target: "space",
        targetId: tempId,
        file: addSpaceForm.imageFile,
        url: addSpaceForm.imageUrl
      });
      const areaNames = addSpaceForm.areaNames
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const newSpaceId = await workspace.actions.createSpace({
        householdId,
        userId: workspace.userId,
        name: addSpaceForm.name.trim(),
        icon: addSpaceForm.icon,
        color: addSpaceForm.color,
        image,
        areas: (areaNames.length ? areaNames : ["Main"]).map((name) => ({ name }))
      });
      setShowAddSpace(false);
      setAddSpaceForm({ name: "", icon: "box", color: randomColor(), areaNames: "", imageUrl: "", imageFile: null });
      setSelectedSpaceId(newSpaceId);
      navigate(`/spaces/${newSpaceId}`);
      flash("Space created");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed to create space");
    } finally {
      setSaving(false);
    }
  }

  async function submitAddArea(event: FormEvent) {
    event.preventDefault();
    if (!workspace.userId || !selectedSpaceId || !addAreaForm.name.trim()) return;
    setSaving(true);
    try {
      const image = await resolveImageRef({
        householdId,
        target: "area",
        targetId: crypto.randomUUID(),
        file: addAreaForm.imageFile,
        url: addAreaForm.imageUrl
      });
      const newAreaId = await workspace.actions.createArea({
        householdId,
        spaceId: selectedSpaceId,
        name: addAreaForm.name.trim(),
        image
      });
      setSelectedAreaId(newAreaId);
      setShowAddArea(false);
      setAddAreaForm({ name: "", imageUrl: "", imageFile: null });
      flash("Area created");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed to create area");
    } finally {
      setSaving(false);
    }
  }

  async function submitAddItem(event: FormEvent) {
    event.preventDefault();
    if (!workspace.userId || !addItemForm.name.trim()) return;
    const space = spaces.find((s) => s.id === addItemForm.spaceId);
    const area = space?.areas.find((a) => a.id === addItemForm.areaId);
    if (!space || !area) {
      flash("Select a space and area");
      return;
    }
    setSaving(true);
    try {
      const image = await resolveImageRef({
        householdId,
        target: "item",
        targetId: crypto.randomUUID(),
        file: addItemForm.imageFile,
        url: addItemForm.imageUrl
      });
      await workspace.actions.createItem({
        householdId,
        userId: workspace.userId,
        name: addItemForm.name.trim(),
        kind: addItemForm.kind,
        spaceId: space.id,
        areaId: area.id,
        areaNameSnapshot: area.name,
        image,
        value: addItemForm.isPriceless ? undefined : addItemForm.value ? Number(addItemForm.value) : undefined,
        isPriceless: addItemForm.isPriceless,
        tags: addItemForm.tags
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        notes: addItemForm.notes
      });
      setShowAddItem(false);
      setAddItemForm({
        name: "",
        kind: "item",
        spaceId: space.id,
        areaId: area.id,
        value: "",
        isPriceless: false,
        tags: "",
        notes: "",
        imageUrl: "",
        imageFile: null
      });
      flash("Item added");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed to add item");
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedItem() {
    if (!selectedItem || !editItemForm || !workspace.userId) return;
    const space = spaces.find((s) => s.id === editItemForm.spaceId);
    const area = space?.areas.find((a) => a.id === editItemForm.areaId);
    if (!space || !area) {
      flash("Select a valid space and area");
      return;
    }
    setSaving(true);
    try {
      const image = await resolveImageRef({
        householdId,
        target: "item",
        targetId: selectedItem.id,
        file: editItemForm.imageFile,
        url: editItemForm.imageUrl
      });
      const patchImage = image
        ? image
        : editItemForm.imageUrl.trim()
          ? imageRefFromUrl(editItemForm.imageUrl)
          : null;
      await workspace.actions.updateItem({
        householdId,
        itemId: selectedItem.id,
        userId: workspace.userId,
        patch: {
          name: editItemForm.name.trim(),
          kind: editItemForm.kind,
          notes: editItemForm.notes,
          value: editItemForm.isPriceless ? undefined : editItemForm.value ? Number(editItemForm.value) : undefined,
          isPriceless: editItemForm.isPriceless,
          image: patchImage,
          tags: editItemForm.tags
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          spaceId: space.id,
          areaId: area.id,
          areaNameSnapshot: area.name
        }
      });
      flash("Item updated");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed to update item");
    } finally {
      setSaving(false);
    }
  }

  async function runVisionCategorize() {
    if (!visionDraft.spaceId || !visionDraft.areaId) {
      flash("Select a space and area");
      return;
    }
    if (!visionDraft.imageFile && !visionDraft.imageUrl?.trim()) {
      flash("Add an image first");
      return;
    }
    if (!online) {
      flash("Vision requires an internet connection");
      return;
    }

    setVisionWorking(true);
    try {
      const draftId = crypto.randomUUID();
      const uploadRef = await resolveImageRef({
        householdId,
        target: "draft",
        targetId: draftId,
        file: visionDraft.imageFile,
        url: visionDraft.imageUrl ?? ""
      });
      let response: { suggestion: VisionSuggestion } | null = null;
      try {
        if (uploadRef?.storagePath || uploadRef?.downloadUrl) {
          response = await visionCategorizeItemImage({
            householdId,
            imageRef: uploadRef.storagePath
              ? { storagePath: uploadRef.storagePath, downloadUrl: uploadRef.downloadUrl }
              : { imageUrl: uploadRef.downloadUrl! },
            context: {
              spaceId: visionDraft.spaceId,
              areaId: visionDraft.areaId,
              areaName:
                spaces
                  .find((space) => space.id === visionDraft.spaceId)
                  ?.areas.find((area) => area.id === visionDraft.areaId)?.name ?? undefined
            }
          });
        }
      } catch (error) {
        // Fallback for early dev environments where functions/providers aren't configured.
        response = {
          suggestion: {
            suggestedName: "Uncategorized Item",
            tags: ["Review"],
            notes:
              error instanceof Error
                ? `Function unavailable or provider not configured. ${error.message}`
                : "Function unavailable or provider not configured.",
            confidence: 0.25,
            rationale: "Local fallback"
          }
        };
      }

      const suggestion = response?.suggestion;
      if (!suggestion) throw new Error("No suggestion returned");
      setVisionDraft((prev) => ({
        ...prev,
        uploadRef,
        suggestion,
        name: suggestion.suggestedName,
        tagsCsv: suggestion.tags.join(", "),
        notes: suggestion.notes ?? ""
      }));
      flash("Review the AI draft before saving");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Vision categorization failed");
    } finally {
      setVisionWorking(false);
    }
  }

  async function saveVisionDraftAsItem() {
    if (!workspace.userId || !visionDraft.suggestion) return;
    const space = spaces.find((s) => s.id === visionDraft.spaceId);
    const area = space?.areas.find((a) => a.id === visionDraft.areaId);
    if (!space || !area || !visionDraft.name.trim()) {
      flash("Complete the draft fields first");
      return;
    }
    setSaving(true);
    try {
      await workspace.actions.createItem({
        householdId,
        userId: workspace.userId,
        name: visionDraft.name.trim(),
        spaceId: space.id,
        areaId: area.id,
        areaNameSnapshot: area.name,
        image: visionDraft.uploadRef,
        tags: visionDraft.tagsCsv
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        notes: visionDraft.notes,
        vision: {
          confidence: visionDraft.suggestion.confidence
        }
      });
      setShowScanner(false);
      setVisionDraft({
        imageFile: null,
        imageUrl: "",
        suggestion: null,
        spaceId: selectedSpaceId || spaces[0]?.id || "",
        areaId: selectedAreaId || spaces[0]?.areas[0]?.id || "",
        notes: "",
        tagsCsv: "",
        name: ""
      });
      flash("Vision draft saved as item");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed to save vision draft");
    } finally {
      setSaving(false);
    }
  }

  async function createInvite() {
    setInviteWorking(true);
    try {
      const result = await createHouseholdInvite({ householdId, role: inviteRole, expiresInHours: 72 });
      setInviteLink(result.inviteUrl);
      flash("Invite link created");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed to create invite");
    } finally {
      setInviteWorking(false);
    }
  }

  async function saveLlmSettings() {
    setLlmSaveWorking(true);
    try {
      await saveHouseholdLlmConfig({ householdId, config: llmForm });
      if (llmSecretInput.trim()) {
        await setHouseholdLlmSecret({ householdId, apiKey: llmSecretInput.trim() });
        setLlmSecretInput("");
      }
      flash("LLM settings saved");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed to save LLM settings");
    } finally {
      setLlmSaveWorking(false);
    }
  }

  async function validateLlmSettings() {
    setLlmValidateWorking(true);
    try {
      const result = await validateHouseholdLlmConfig({ householdId });
      flash(result.message || (result.ok ? "LLM config validated" : "LLM validation failed"));
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed to validate LLM settings");
    } finally {
      setLlmValidateWorking(false);
    }
  }

  const spaceNameById = useMemo(() => Object.fromEntries(spaces.map((space) => [space.id, space.name])), [spaces]);

  const activeScreen = () => {
    if (tab === "search") {
      return (
        <div className="screen">
          <div className="screen-header">
            <h2>Search</h2>
            <TextInput
              placeholder="Items, tags, spaces, areas…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="list">
            {searchedItems.map((item) => (
              <button key={item.id} className="list-row" onClick={() => setSelectedItemId(item.id)}>
                <div className="thumb">
                  {item.image?.downloadUrl ? <img src={item.image.downloadUrl} alt="" /> : item.kind === "folder" ? <Folder size={16} /> : <Box size={16} />}
                </div>
                <div className="grow">
                  <div className="row-title">{item.name}</div>
                  <div className="row-sub">{spaceNameById[item.spaceId]} · {item.areaNameSnapshot}</div>
                </div>
                {item.isPacked ? <CheckCircle size={16} color={P.success} /> : null}
              </button>
            ))}
            {searchedItems.length === 0 ? <div className="empty-state">No results</div> : null}
          </div>
        </div>
      );
    }

    if (tab === "packing") {
      return (
        <div className="screen">
          <div className="screen-header">
            <h2>Packing</h2>
            <div className="muted">{packedItems.length} packed of {items.length}</div>
          </div>
          <div className="progress-card">
            <div className="progress-label">
              <span>Pack Progress</span>
              <span>{packedItems.length}/{items.length}</span>
            </div>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${items.length ? (packedItems.length / items.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="list">
            {items.map((item) => (
              <div key={item.id} className="list-row">
                <button
                  className="icon-btn"
                  onClick={() => {
                    if (!workspace.userId) return;
                    void workspace.actions
                      .togglePacked({
                        householdId,
                        itemId: item.id,
                        userId: workspace.userId,
                        nextValue: !item.isPacked
                      })
                      .then(() => flash(item.isPacked ? "Unpacked" : "Packed"))
                      .catch((error) => flash(error instanceof Error ? error.message : "Failed"));
                  }}
                >
                  {item.isPacked ? <CheckCircle size={18} color={P.success} /> : <Box size={18} color={P.warm} />}
                </button>
                <div className="grow clickable" onClick={() => setSelectedItemId(item.id)}>
                  <div className={`row-title ${item.isPacked ? "line-through" : ""}`}>{item.name}</div>
                  <div className="row-sub">{spaceNameById[item.spaceId]} · {item.areaNameSnapshot}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (tab === "settings") {
      const isAdmin = members.some((m) => m.uid === user.uid && (m.role === "OWNER" || m.role === "ADMIN"));
      return (
        <div className="screen">
          <div className="screen-header">
            <h2>Settings</h2>
            <StatusPill color={workspace.sync.hasPendingWrites ? "warn" : "success"}>{syncText}</StatusPill>
          </div>

          <section className="panel section">
            <div className="section-title"><Users size={16} /> Household Members</div>
            <div className="stack-sm">
              {members.map((member) => (
                <div key={member.uid} className="row">
                  <div className="grow">
                    <div className="row-title">{member.displayName || member.email || member.uid}</div>
                    <div className="row-sub">{member.email || "No email"}</div>
                  </div>
                  <StatusPill color="default">{member.role}</StatusPill>
                </div>
              ))}
              {isAdmin ? (
                <>
                  <Field label="Invite role">
                    <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </Select>
                  </Field>
                  <button className="btn" onClick={() => void createInvite()} disabled={inviteWorking}>
                    {inviteWorking ? "Creating invite…" : "Create Invite Link"}
                  </button>
                  {inviteLink ? (
                    <div className="stack-sm">
                      <TextInput readOnly value={inviteLink} />
                      <button
                        className="btn"
                        onClick={async () => {
                          await navigator.clipboard.writeText(inviteLink);
                          flash("Invite link copied");
                        }}
                      >
                        Copy Invite Link
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="muted">Only owners/admins can create invites.</div>
              )}
            </div>
          </section>

          <section className="panel section">
            <div className="section-title"><KeyRound size={16} /> Vision LLM Provider</div>
            <div className="stack">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={llmForm.enabled}
                  onChange={(e) => setLlmForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                Enable vision categorization
              </label>
              <Field label="Provider">
                <Select
                  value={llmForm.providerType}
                  onChange={(e) =>
                    setLlmForm((prev) => ({
                      ...prev,
                      providerType: e.target.value as HouseholdLlmConfig["providerType"]
                    }))
                  }
                >
                  <option value="openai_compatible">OpenAI-compatible</option>
                  <option value="gemini">Gemini</option>
                  <option value="anthropic">Anthropic</option>
                </Select>
              </Field>
              <Field label="Model">
                <TextInput value={llmForm.model} onChange={(e) => setLlmForm((prev) => ({ ...prev, model: e.target.value }))} />
              </Field>
              {llmForm.providerType === "openai_compatible" ? (
                <Field label="Base URL">
                  <TextInput
                    value={llmForm.baseUrl || ""}
                    onChange={(e) => setLlmForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="https://api.openai.com/v1"
                  />
                </Field>
              ) : null}
              <div className="row two-col">
                <Field label="Temperature">
                  <TextInput
                    type="number"
                    step="0.1"
                    value={String(llmForm.temperature ?? 0.2)}
                    onChange={(e) => setLlmForm((prev) => ({ ...prev, temperature: Number(e.target.value) }))}
                  />
                </Field>
                <Field label="Max Tokens">
                  <TextInput
                    type="number"
                    value={String(llmForm.maxTokens ?? 400)}
                    onChange={(e) => setLlmForm((prev) => ({ ...prev, maxTokens: Number(e.target.value) }))}
                  />
                </Field>
              </div>
              <Field label="API Key (stored encrypted)">
                <TextInput
                  type="password"
                  value={llmSecretInput}
                  onChange={(e) => setLlmSecretInput(e.target.value)}
                  placeholder="Leave blank to keep current key"
                />
              </Field>
              <div className="row">
                <button className="btn primary" disabled={llmSaveWorking} onClick={() => void saveLlmSettings()}>
                  {llmSaveWorking ? "Saving…" : "Save LLM Settings"}
                </button>
                <button className="btn" disabled={llmValidateWorking} onClick={() => void validateLlmSettings()}>
                  {llmValidateWorking ? "Validating…" : "Test Connection"}
                </button>
              </div>
            </div>
          </section>

          <section className="panel section">
            <div className="section-title"><LogOut size={16} /> Session</div>
            <div className="row">
              <div className="grow">
                <div className="row-title">{user.displayName || user.email || user.uid}</div>
                <div className="row-sub">Household: {workspace.household?.name || householdId}</div>
              </div>
              <button className="btn" onClick={onSignOut}>Sign Out</button>
            </div>
          </section>
        </div>
      );
    }

    // Spaces tab
    if (!selectedSpaceId) {
      return (
        <div className="screen">
          <div className="screen-header">
            <h2>Spaces</h2>
            <div className="row gap-sm">
              <StatusPill color={workspace.sync.hasPendingWrites ? "warn" : "success"}>{syncText}</StatusPill>
              <button className="icon-btn" onClick={() => setShowAddSpace(true)}>
                <Plus size={18} />
              </button>
            </div>
          </div>
          {workspace.error ? <div className="banner error">{workspace.error}</div> : null}
          <div className="list">
            {spaces.map((space) => {
              const count = itemsBySpace.get(space.id)?.length ?? 0;
              const Icon = iconForSpace(space.icon);
              return (
                <button
                  key={space.id}
                  className="list-row"
                  onClick={() => {
                    setSelectedSpaceId(space.id);
                    setSelectedAreaId(null);
                    navigate(`/spaces/${space.id}`);
                  }}
                >
                  <div className="thumb color" style={{ background: `${space.color}18`, color: space.color }}>
                    {space.image?.downloadUrl ? <img src={space.image.downloadUrl} alt="" /> : <Icon size={18} />}
                  </div>
                  <div className="grow">
                    <div className="row-title">{space.name}</div>
                    <div className="row-sub">{space.areas.length} areas · {count} items</div>
                  </div>
                  <ChevronRight size={16} color={P.warm} />
                </button>
              );
            })}
          </div>
          <button className="fab" onClick={() => setShowAddSpace(true)} aria-label="Add space">
            <Plus size={24} />
          </button>
        </div>
      );
    }

    return (
      <div className="screen">
        <div className="screen-header">
          <div className="row gap-sm">
            <button
              className="icon-btn"
              onClick={() => {
                if (selectedAreaId) {
                  setSelectedAreaId(null);
                } else {
                  setSelectedSpaceId(null);
                  navigate("/spaces");
                }
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <h2>{selectedAreaId ? currentArea?.name ?? "Area" : currentSpace?.name ?? "Space"}</h2>
          </div>
          <div className="row gap-sm">
            {!selectedAreaId ? (
              <>
                <button className="icon-btn" onClick={() => setShowQrForSpaceId(selectedSpaceId)}>
                  <Grid size={18} />
                </button>
                <button className="icon-btn" onClick={() => setShowAddArea(true)}>
                  <Plus size={18} />
                </button>
              </>
            ) : null}
            <button className="icon-btn" onClick={() => setShowAddItem(true)}>
              <Plus size={18} />
            </button>
          </div>
        </div>

        {!selectedAreaId ? (
          <>
            <div className="grid-areas">
              {currentSpace?.areas.map((area) => {
                const areaCount = spaceItems.filter((item) => item.areaId === area.id).length;
                return (
                  <button key={area.id} className="area-card" onClick={() => setSelectedAreaId(area.id)}>
                    <div className="area-card-head">
                      {area.image?.downloadUrl ? <img src={area.image.downloadUrl} alt="" /> : <Box size={16} color={currentSpace.color} />}
                    </div>
                    <div className="row-title">{area.name}</div>
                    <div className="row-sub">{areaCount} items</div>
                  </button>
                );
              })}
              <button className="area-card dashed" onClick={() => setShowAddArea(true)}>
                <Plus size={18} />
                <div className="row-title">Add Area</div>
              </button>
            </div>
            <div className="section-header">All Items in {currentSpace?.name}</div>
          </>
        ) : (
          <div className="section-header">{currentArea?.name} Items</div>
        )}

        <div className="list">
          {filteredSpaceItems.map((item) => (
            <button key={item.id} className="list-row" onClick={() => setSelectedItemId(item.id)}>
              <div className="thumb">
                {item.image?.downloadUrl ? <img src={item.image.downloadUrl} alt="" /> : item.kind === "folder" ? <Folder size={16} /> : <Box size={16} />}
              </div>
              <div className="grow">
                <div className="row-title">{item.name}</div>
                <div className="row-sub">{item.areaNameSnapshot}</div>
              </div>
              {item.isPacked ? <CheckCircle size={16} color={P.success} /> : null}
              <ChevronRight size={16} color={P.warm} />
            </button>
          ))}
          {filteredSpaceItems.length === 0 ? <div className="empty-state">No items yet.</div> : null}
        </div>

        <div className="fab-stack">
          <button className="fab ghost" onClick={() => setShowScanner(true)} aria-label="Scan item">
            <Camera size={22} />
          </button>
          <button className="fab" onClick={() => setShowAddItem(true)} aria-label="Add item">
            <Plus size={24} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <div className="phone-frame">
        <header className="top-status">
          <span>9:41</span>
          <span>{workspace.sync.hasPendingWrites ? "Syncing" : online ? "Online" : "Offline"}</span>
        </header>

        {activeScreen()}

        <nav className="bottom-nav">
          <NavButton
            active={tab === "spaces"}
            label="Spaces"
            icon={Home}
            onClick={() => {
              setTab("spaces");
            }}
          />
          <NavButton active={tab === "search"} label="Search" icon={Search} onClick={() => setTab("search")} />
          <NavButton active={tab === "packing"} label="Packing" icon={Package} badge={packedItems.length || undefined} onClick={() => setTab("packing")} />
          <NavButton active={tab === "settings"} label="Settings" icon={Settings} onClick={() => setTab("settings")} />
        </nav>

        <Modal open={showAddSpace} title="New Space" onClose={() => setShowAddSpace(false)}>
          <form className="stack" onSubmit={(e) => void submitAddSpace(e)}>
            <Field label="Space name *">
              <TextInput value={addSpaceForm.name} onChange={(e) => setAddSpaceForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </Field>
            <Field label="Color">
              <div className="row">
                <TextInput value={addSpaceForm.color} onChange={(e) => setAddSpaceForm((prev) => ({ ...prev, color: e.target.value }))} />
                <button type="button" className="btn" onClick={() => setAddSpaceForm((prev) => ({ ...prev, color: randomColor() }))}>Random</button>
              </div>
            </Field>
            <Field label="Areas (comma-separated)">
              <TextInput value={addSpaceForm.areaNames} onChange={(e) => setAddSpaceForm((prev) => ({ ...prev, areaNames: e.target.value }))} placeholder="Shelf, Drawer, Closet" />
            </Field>
            <ImagePicker
              label="Space photo"
              imageUrl={addSpaceForm.imageUrl}
              onImageUrlChange={(value) => setAddSpaceForm((prev) => ({ ...prev, imageUrl: value }))}
              onFileChange={(file) => setAddSpaceForm((prev) => ({ ...prev, imageFile: file }))}
            />
            <button className="btn primary" disabled={saving || !addSpaceForm.name.trim()}>
              {saving ? "Creating…" : "Create Space"}
            </button>
          </form>
        </Modal>

        <Modal open={showAddArea} title="New Area" onClose={() => setShowAddArea(false)}>
          <form className="stack" onSubmit={(e) => void submitAddArea(e)}>
            <Field label="Area name *">
              <TextInput value={addAreaForm.name} onChange={(e) => setAddAreaForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </Field>
            <ImagePicker
              label="Area photo"
              imageUrl={addAreaForm.imageUrl}
              onImageUrlChange={(value) => setAddAreaForm((prev) => ({ ...prev, imageUrl: value }))}
              onFileChange={(file) => setAddAreaForm((prev) => ({ ...prev, imageFile: file }))}
            />
            <button className="btn primary" disabled={saving || !addAreaForm.name.trim() || !selectedSpaceId}>
              {saving ? "Adding…" : "Add Area"}
            </button>
          </form>
        </Modal>

        <Modal open={showAddItem} title="Add Item" onClose={() => setShowAddItem(false)}>
          <form className="stack" onSubmit={(e) => void submitAddItem(e)}>
            <Field label="Name *">
              <TextInput value={addItemForm.name} onChange={(e) => setAddItemForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </Field>
            <div className="row two-col">
              <Field label="Type">
                <Select value={addItemForm.kind} onChange={(e) => setAddItemForm((prev) => ({ ...prev, kind: e.target.value as "item" | "folder" }))}>
                  <option value="item">Item</option>
                  <option value="folder">Folder / Document</option>
                </Select>
              </Field>
              <Field label="Space">
                <Select
                  value={addItemForm.spaceId}
                  onChange={(e) => {
                    const nextSpaceId = e.target.value;
                    const nextAreaId = spaces.find((s) => s.id === nextSpaceId)?.areas[0]?.id ?? "";
                    setAddItemForm((prev) => ({ ...prev, spaceId: nextSpaceId, areaId: nextAreaId }));
                  }}
                >
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>{space.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Area">
              <Select value={addItemForm.areaId} onChange={(e) => setAddItemForm((prev) => ({ ...prev, areaId: e.target.value }))}>
                {(currentSpaceForAddItem?.areas ?? []).map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </Select>
            </Field>
            <div className="row two-col">
              <Field label="Value (USD)">
                <TextInput
                  type="number"
                  value={addItemForm.value}
                  disabled={addItemForm.isPriceless}
                  onChange={(e) => setAddItemForm((prev) => ({ ...prev, value: e.target.value }))}
                  placeholder="0"
                />
              </Field>
              <label className="check-row align-end">
                <input
                  type="checkbox"
                  checked={addItemForm.isPriceless}
                  onChange={(e) => setAddItemForm((prev) => ({ ...prev, isPriceless: e.target.checked }))}
                />
                Priceless
              </label>
            </div>
            <Field label="Tags (comma-separated)">
              <TextInput value={addItemForm.tags} onChange={(e) => setAddItemForm((prev) => ({ ...prev, tags: e.target.value }))} placeholder="Tech, Travel" />
            </Field>
            <Field label="Notes">
              <TextArea rows={3} value={addItemForm.notes} onChange={(e) => setAddItemForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </Field>
            <ImagePicker
              label="Photo"
              imageUrl={addItemForm.imageUrl}
              onImageUrlChange={(value) => setAddItemForm((prev) => ({ ...prev, imageUrl: value }))}
              onFileChange={(file) => setAddItemForm((prev) => ({ ...prev, imageFile: file }))}
            />
            <button className="btn primary" disabled={saving || !addItemForm.name.trim() || !currentAreaForAddItem}>
              {saving ? "Saving…" : "Add Item"}
            </button>
          </form>
        </Modal>

        <Modal open={showScanner} title="Vision Scan" onClose={() => setShowScanner(false)}>
          <div className="stack">
            <p className="muted">Capture or select a photo, then generate a draft suggestion. Review is always required before saving.</p>
            <div className="row two-col">
              <Field label="Space">
                <Select
                  value={visionDraft.spaceId || selectedSpaceId || spaces[0]?.id || ""}
                  onChange={(e) => {
                    const nextSpaceId = e.target.value;
                    const nextAreaId = spaces.find((s) => s.id === nextSpaceId)?.areas[0]?.id ?? "";
                    setVisionDraft((prev) => ({ ...prev, spaceId: nextSpaceId, areaId: nextAreaId }));
                  }}
                >
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>{space.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Area">
                <Select
                  value={visionDraft.areaId || selectedAreaId || ""}
                  onChange={(e) => setVisionDraft((prev) => ({ ...prev, areaId: e.target.value }))}
                >
                  {(spaces.find((s) => s.id === (visionDraft.spaceId || selectedSpaceId))?.areas ?? []).map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <ImagePicker
              label="Scan image"
              imageUrl={visionDraft.imageUrl || ""}
              onImageUrlChange={(value) => setVisionDraft((prev) => ({ ...prev, imageUrl: value }))}
              onFileChange={(file) => setVisionDraft((prev) => ({ ...prev, imageFile: file }))}
            />
            <button className="btn primary" disabled={visionWorking} onClick={() => void runVisionCategorize()}>
              <Sparkles size={16} />
              {visionWorking ? "Categorizing…" : "Categorize Image"}
            </button>

            {visionDraft.suggestion ? (
              <div className="panel section stack">
                <div className="section-title"><Tag size={16} /> Review Draft</div>
                <div className="row">
                  <StatusPill color={visionDraft.suggestion.confidence >= 0.7 ? "success" : "warn"}>
                    Confidence {Math.round(visionDraft.suggestion.confidence * 100)}%
                  </StatusPill>
                </div>
                <Field label="Suggested name">
                  <TextInput value={visionDraft.name} onChange={(e) => setVisionDraft((prev) => ({ ...prev, name: e.target.value }))} />
                </Field>
                <Field label="Tags">
                  <TextInput value={visionDraft.tagsCsv} onChange={(e) => setVisionDraft((prev) => ({ ...prev, tagsCsv: e.target.value }))} />
                </Field>
                <Field label="Notes">
                  <TextArea rows={3} value={visionDraft.notes} onChange={(e) => setVisionDraft((prev) => ({ ...prev, notes: e.target.value }))} />
                </Field>
                {visionDraft.suggestion.rationale ? <p className="muted">{visionDraft.suggestion.rationale}</p> : null}
                <button className="btn primary" disabled={saving || !visionDraft.name.trim()} onClick={() => void saveVisionDraftAsItem()}>
                  {saving ? "Saving…" : "Save Draft as Item"}
                </button>
              </div>
            ) : null}
          </div>
        </Modal>

        <Modal open={Boolean(showQrForSpaceId)} title="Space QR Label" onClose={() => setShowQrForSpaceId(null)}>
          <div className="stack center">
            <p className="muted">Scan to open this space in the web app.</p>
            {qrImageUrl ? <img src={qrImageUrl} alt="QR code" className="qr-image" /> : <div className="empty-state">Generating QR…</div>}
            <TextInput readOnly value={`${window.location.origin}/spaces/${showQrForSpaceId}`} />
            <button className="btn" onClick={() => window.print()}>Print Label</button>
          </div>
        </Modal>

        <Modal open={Boolean(selectedItem && editItemForm)} title={selectedItem ? selectedItem.name : "Item"} onClose={() => setSelectedItemId(null)}>
          {selectedItem && editItemForm ? (
            <div className="stack">
              {selectedItem.image?.downloadUrl ? <img src={selectedItem.image.downloadUrl} alt="" className="hero-image" /> : null}
              <div className="row">
                <StatusPill color="default">{spaceNameById[selectedItem.spaceId]} · {selectedItem.areaNameSnapshot}</StatusPill>
                {selectedItem.isPacked ? <StatusPill color="success">Packed</StatusPill> : null}
              </div>
              <div className="panel section stack">
                <div className="section-title"><Edit size={16} /> Edit Item</div>
                <Field label="Name">
                  <TextInput value={editItemForm.name} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                </Field>
                <div className="row two-col">
                  <Field label="Type">
                    <Select value={editItemForm.kind} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, kind: e.target.value as "item" | "folder" } : prev)}>
                      <option value="item">Item</option>
                      <option value="folder">Folder</option>
                    </Select>
                  </Field>
                  <Field label="Space">
                    <Select
                      value={editItemForm.spaceId}
                      onChange={(e) => {
                        const nextSpaceId = e.target.value;
                        const nextAreaId = spaces.find((space) => space.id === nextSpaceId)?.areas[0]?.id ?? "";
                        setEditItemForm((prev) => (prev ? { ...prev, spaceId: nextSpaceId, areaId: nextAreaId } : prev));
                      }}
                    >
                      {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Area">
                  <Select value={editItemForm.areaId} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, areaId: e.target.value } : prev)}>
                    {(spaces.find((space) => space.id === editItemForm.spaceId)?.areas ?? []).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </Select>
                </Field>
                <div className="row two-col">
                  <Field label="Value (USD)">
                    <TextInput
                      type="number"
                      value={editItemForm.value}
                      disabled={editItemForm.isPriceless}
                      onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, value: e.target.value } : prev)}
                    />
                  </Field>
                  <label className="check-row align-end">
                    <input
                      type="checkbox"
                      checked={editItemForm.isPriceless}
                      onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, isPriceless: e.target.checked } : prev)}
                    />
                    Priceless
                  </label>
                </div>
                <Field label="Tags">
                  <TextInput value={editItemForm.tags} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, tags: e.target.value } : prev)} />
                </Field>
                <Field label="Notes">
                  <TextArea rows={3} value={editItemForm.notes} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, notes: e.target.value } : prev)} />
                </Field>
                <ImagePicker
                  label="Photo"
                  imageUrl={editItemForm.imageUrl}
                  onImageUrlChange={(value) => setEditItemForm((prev) => (prev ? { ...prev, imageUrl: value } : prev))}
                  onFileChange={(file) => setEditItemForm((prev) => (prev ? { ...prev, imageFile: file } : prev))}
                />
                <div className="row">
                  <button
                    className="btn"
                    onClick={() => {
                      if (!workspace.userId) return;
                      void workspace.actions
                        .togglePacked({
                          householdId,
                          itemId: selectedItem.id,
                          userId: workspace.userId,
                          nextValue: !selectedItem.isPacked
                        })
                        .then(() => flash(selectedItem.isPacked ? "Removed from packing" : "Added to packing"))
                        .catch((error) => flash(error instanceof Error ? error.message : "Failed to update"));
                    }}
                  >
                    {selectedItem.isPacked ? "Unpack" : "Add to Packing"}
                  </button>
                  <button className="btn primary" disabled={saving} onClick={() => void saveEditedItem()}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
                <button
                  className="btn danger"
                  onClick={() => {
                    void workspace.actions
                      .deleteItem({ householdId, itemId: selectedItem.id })
                      .then(() => {
                        setSelectedItemId(null);
                        flash("Item deleted");
                      })
                      .catch((error) => flash(error instanceof Error ? error.message : "Failed to delete item"));
                  }}
                >
                  <Trash2 size={16} /> Delete Item
                </button>
              </div>
            </div>
          ) : null}
        </Modal>

        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}
