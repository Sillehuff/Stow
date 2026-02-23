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
  List,
  X,
  Trash2,
  Edit,
  CheckCircle,
  Tag,
  MapPin,
  ArrowRight,
  Save,
  Inbox,
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
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={14} />
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
        <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
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
  const [fabOpen, setFabOpen] = useState(false);
  const [gridView, setGridView] = useState(false);
  const [editing, setEditing] = useState(false);
  const [delConfirm, setDelConfirm] = useState<string | null>(null);
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
    } else if (!routeSpaceId && selectedSpaceId) {
      setSelectedSpaceId(null);
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
        <div className="screen" style={{ padding: 0 }}>
          <div style={{ padding: "24px 24px 16px", background: P.canvas, borderBottom: `1px solid ${P.borderL}`, position: "sticky", top: 0, zIndex: 20 }}>
            <h1 style={{ margin: "0 0 16px", fontSize: 28, fontWeight: 900, color: P.ink }}>Search</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="search-input-wrap">
                <Search size={16} />
                <input
                  autoFocus
                  className="input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Items, tags, or spaces…"
                  style={{ borderColor: searchQuery ? P.accent : undefined }}
                />
                {searchQuery ? (
                  <button className="search-clear" onClick={() => setSearchQuery("")}>
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <button className="view-toggle" onClick={() => setGridView(!gridView)}>
                {gridView ? <List size={16} /> : <Grid size={16} />}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
            {!searchQuery ? (
              <div>
                <div className="section-label">Popular Tags</div>
                <div className="search-tags">
                  {allTags.map((t) => (
                    <button key={t} className="search-tag-btn" onClick={() => setSearchQuery(t)}>#{t}</button>
                  ))}
                </div>
                <div className="section-label">All Items ({items.length})</div>
                <div className="list">
                  {items.map((item) => (
                    <button key={item.id} className="list-row" onClick={() => setSelectedItemId(item.id)}>
                      <div className="thumb">
                        {item.image?.downloadUrl ? <img src={item.image.downloadUrl} alt="" /> : <Inbox size={16} color={P.border} />}
                      </div>
                      <div className="grow">
                        <div className="row-title">{item.name}</div>
                        <div className="row-sub">{spaceNameById[item.spaceId]} · {item.areaNameSnapshot}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : searchedItems.length === 0 ? (
              <div className="empty-state">
                <Search size={32} color={P.border} className="empty-icon" />
                <div className="empty-title">No results</div>
                <div className="empty-sub">Nothing matches &ldquo;{searchQuery}&rdquo;</div>
              </div>
            ) : !gridView ? (
              <div className="list">
                {searchedItems.map((item) => (
                  <button key={item.id} className="list-row" onClick={() => setSelectedItemId(item.id)}>
                    <div className="thumb">
                      {item.image?.downloadUrl ? <img src={item.image.downloadUrl} alt="" /> : <Inbox size={16} color={P.border} />}
                    </div>
                    <div className="grow">
                      <div className="row-title">{item.name}</div>
                      <div className="row-sub">{spaceNameById[item.spaceId]} · {item.areaNameSnapshot}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="search-grid">
                {searchedItems.map((item) => (
                  <div key={item.id} className="search-grid-item" onClick={() => setSelectedItemId(item.id)}>
                    <div className="grid-thumb">
                      {item.image?.downloadUrl ? <img src={item.image.downloadUrl} alt="" /> : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Inbox size={24} color={P.border} /></div>
                      )}
                      {item.isPacked ? (
                        <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 999, background: P.success, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Package size={10} color="#fff" />
                        </div>
                      ) : null}
                    </div>
                    <div className="grid-info">
                      <div className="row-title">{item.name}</div>
                      <div className="row-sub">{spaceNameById[item.spaceId]}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (tab === "packing") {
      return (
        <div className="screen" style={{ padding: 0 }}>
          <div style={{ padding: "24px 24px 16px", background: P.canvas, borderBottom: `1px solid ${P.borderL}` }}>
            <h1 style={{ margin: "0 0 16px", fontSize: 28, fontWeight: 900, color: P.ink }}>Packing</h1>
            <div className="packing-pills">
              <button className="packing-pill inactive">
                All Packed <span className="count">{packedItems.length}</span>
              </button>
              <button className="packing-pill active">Weekend Trip</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
            <div className="progress-card">
              <div className="progress-label">
                <span>Pack Progress</span>
                <span>{packedItems.length} of {items.length}</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${items.length ? Math.min((packedItems.length / items.length) * 100, 100) : 0}%` }} />
              </div>
            </div>
            <div className="list">
              {items.map((item) => (
                <div key={item.id} className="packing-item">
                  <button
                    className={`pack-check ${item.isPacked ? "checked" : ""}`}
                    onClick={() => {
                      if (!workspace.userId) return;
                      void workspace.actions
                        .togglePacked({
                          householdId,
                          itemId: item.id,
                          userId: workspace.userId,
                          nextValue: !item.isPacked
                        })
                        .then(() => flash(item.isPacked ? "Unpacked" : "Packed!"))
                        .catch((error) => flash(error instanceof Error ? error.message : "Failed"));
                    }}
                  >
                    {item.isPacked ? <CheckCircle size={22} strokeWidth={2.5} /> : <div className="pack-check-circle" />}
                  </button>
                  <div className="grow clickable" style={{ opacity: item.isPacked ? 0.35 : 1, transition: "opacity 0.3s" }} onClick={() => setSelectedItemId(item.id)}>
                    <div className="row-title" style={{ textDecoration: item.isPacked ? "line-through" : "none" }}>{item.name}</div>
                    <div className="row-sub">{spaceNameById[item.spaceId]} · {item.areaNameSnapshot}</div>
                  </div>
                  {item.image?.downloadUrl ? (
                    <img src={item.image.downloadUrl} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", marginRight: 4, opacity: item.isPacked ? 0.25 : 1, filter: item.isPacked ? "grayscale(1)" : "none" }} />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (tab === "settings") {
      const isAdmin = members.some((m) => m.uid === user.uid && (m.role === "OWNER" || m.role === "ADMIN"));
      return (
        <div className="screen" style={{ padding: 0, overflowY: "auto", paddingBottom: 120 }}>
          <div style={{ padding: "24px 24px 8px" }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: P.ink }}>Settings</h1>
          </div>
          <div style={{ padding: "20px 20px 0" }}>

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

          <div className="section-label" style={{ marginTop: 20 }}>About</div>
          <div className="panel about-card">
            <div className="about-title">Stow<span className="dot">.</span></div>
            <div className="about-version">Version 3.0</div>
          </div>
          </div>
        </div>
      );
    }

    // Spaces tab (home)
    if (!selectedSpaceId) {
      return (
        <div className="screen" style={{ padding: 0 }}>
          <div className="home-header">
            <h1>Stow<span className="dot">.</span></h1>
            <p className="subtitle">{items.length} items across {spaces.length} spaces</p>
          </div>
          {workspace.error ? <div className="banner error" style={{ margin: "0 24px" }}>{workspace.error}</div> : null}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 120px" }}>
            <div style={{ height: 16 }} />
            <div className="section-label">Your Spaces</div>
            <div className="space-list-card">
              {spaces.map((space, idx) => {
                const count = itemsBySpace.get(space.id)?.length ?? 0;
                const Icon = iconForSpace(space.icon);
                return (
                  <button
                    key={space.id}
                    className="space-list-row"
                    onClick={() => {
                      setSelectedSpaceId(space.id);
                      setSelectedAreaId(null);
                      navigate(`/spaces/${space.id}`);
                    }}
                  >
                    <div className="row-info">
                      {space.image?.downloadUrl ? (
                        <img src={space.image.downloadUrl} alt="" style={{ width: 42, height: 42, borderRadius: 14, objectFit: "cover", border: `1px solid ${P.borderL}` }} />
                      ) : (
                        <div style={{ width: 42, height: 42, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: `${space.color}14`, color: space.color }}>
                          <Icon size={20} strokeWidth={1.8} />
                        </div>
                      )}
                      <div>
                        <div className="row-title lg">{space.name}</div>
                        <div className="row-sub">{space.areas.length} areas · {count} item{count !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color={P.border} />
                  </button>
                );
              })}
              <button className="space-list-add" onClick={() => setShowAddSpace(true)}>
                <Plus size={16} strokeWidth={2.5} /> Add Space
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="screen" style={{ padding: "0 0 120px" }}>
        <div className="screen-header">
          <button
            className="back-btn"
            onClick={() => {
              if (selectedAreaId) {
                setSelectedAreaId(null);
              } else {
                setSelectedSpaceId(null);
                navigate("/spaces");
              }
            }}
          >
            <ChevronLeft size={20} strokeWidth={2.5} /> {selectedAreaId ? currentSpace?.name : "Spaces"}
          </button>
          <h2>{selectedAreaId ? currentArea?.name ?? "Area" : currentSpace?.name ?? "Space"}</h2>
          <div className="row gap-sm">
            {!selectedAreaId ? (
              <>
                <button className="icon-btn" style={{ border: "none", background: "none" }} onClick={() => setShowQrForSpaceId(selectedSpaceId)}>
                  <Grid size={18} color={P.inkMuted} />
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div style={{ padding: "16px 16px 0" }}>
        {!selectedAreaId ? (
          <>
            {currentSpace?.image?.downloadUrl ? (
              <div style={{ marginBottom: 16, borderRadius: 20, overflow: "hidden", height: 120, position: "relative" }}>
                <img src={currentSpace.image.downloadUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.3), transparent)" }} />
              </div>
            ) : null}
            <div className="section-label">{currentSpace?.areas.length ?? 0} Area{(currentSpace?.areas.length ?? 0) !== 1 ? "s" : ""}</div>
            <div className="grid-areas">
              {currentSpace?.areas.map((area) => {
                const areaCount = spaceItems.filter((item) => item.areaId === area.id).length;
                return (
                  <button key={area.id} className="area-card" onClick={() => setSelectedAreaId(area.id)}>
                    <div className="area-card-body">
                      <div className="area-card-head" style={{ background: `${currentSpace.color}12` }}>
                        {area.image?.downloadUrl ? <img src={area.image.downloadUrl} alt="" /> : <Box size={18} color={currentSpace.color} strokeWidth={1.8} />}
                      </div>
                      <div>
                        <div className="row-title" style={{ lineHeight: 1.3 }}>{area.name}</div>
                        <div className="row-sub">{areaCount} item{areaCount !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
              <button className="area-card dashed" onClick={() => setShowAddArea(true)}>
                <Plus size={20} strokeWidth={2.5} color={P.accent} />
                <span style={{ fontSize: 13, fontWeight: 700, color: P.accent }}>Add Area</span>
              </button>
            </div>
            <div className="section-header">All Items in {currentSpace?.name} ({spaceItems.length})</div>
          </>
        ) : null}
        </div>

        <div className="list" style={{ padding: "0 16px" }}>
          {filteredSpaceItems.map((item) => (
            <button key={item.id} className="list-row" onClick={() => setSelectedItemId(item.id)} style={selectedAreaId ? { borderRadius: 18, padding: 12, gap: 14 } : undefined}>
              <div className={selectedAreaId ? "thumb lg" : "thumb"}>
                {item.image?.downloadUrl ? <img src={item.image.downloadUrl} alt="" /> : item.kind === "folder" ? <Folder size={selectedAreaId ? 20 : 18} color={P.border} /> : <Inbox size={selectedAreaId ? 20 : 18} color={P.border} />}
              </div>
              <div className="grow">
                <div className="row-title" style={selectedAreaId ? { fontSize: 15 } : undefined}>{item.name}</div>
                {!selectedAreaId ? <div className="row-sub">{item.areaNameSnapshot}</div> : null}
              </div>
              {item.isPacked ? (
                <div style={{ width: selectedAreaId ? 24 : 22, height: selectedAreaId ? 24 : 22, borderRadius: 999, background: P.successSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Package size={selectedAreaId ? 11 : 10} color={P.success} />
                </div>
              ) : null}
              <ChevronRight size={14} color={P.border} />
            </button>
          ))}
          {filteredSpaceItems.length === 0 ? (
            <div className="empty-state">
              <Box size={36} color={P.border} className="empty-icon" />
              <div className="empty-title">Nothing {selectedAreaId ? `in ${currentArea?.name}` : "here yet"}</div>
              <div className="empty-sub">Add your first item{selectedAreaId ? " to this area" : ""}</div>
              <button className="btn primary" onClick={() => setShowAddItem(true)}>Add Item</button>
            </div>
          ) : null}
          {selectedAreaId && filteredSpaceItems.length > 0 ? (
            <button
              onClick={() => setShowAddItem(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 0", marginTop: 12, borderRadius: 18, border: `2px dashed ${P.border}`, color: P.warm, fontWeight: 700, fontSize: 14, cursor: "pointer", background: "none", width: "100%" }}
            >
              <Plus size={16} strokeWidth={2.5} /> Add Item to {currentArea?.name}
            </button>
          ) : null}
        </div>

        {/* Expandable FAB */}
        <div className="fab-wrap">
          {fabOpen ? (
            <div className="fab-menu">
              <button className="fab-menu-item" onClick={() => { setFabOpen(false); setShowScanner(true); }}>
                <Camera size={16} /> Scan Item
              </button>
              <button className="fab-menu-item" onClick={() => { setFabOpen(false); setShowAddItem(true); }}>
                <Edit size={16} /> Add Manually
              </button>
            </div>
          ) : null}
          <button className={`fab ${fabOpen ? "rotated" : ""}`} onClick={() => setFabOpen(!fabOpen)} aria-label="Add">
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <div className="phone-frame">
        {activeScreen()}

        {!selectedItemId ? (
          <nav className="bottom-nav">
            <NavButton
              active={tab === "spaces"}
              label="Spaces"
              icon={Home}
              onClick={() => { setTab("spaces"); setSelectedSpaceId(null); setSelectedAreaId(null); navigate("/spaces"); }}
            />
            <NavButton active={tab === "search"} label="Search" icon={Search} onClick={() => setTab("search")} />
            <NavButton active={tab === "packing"} label="Packing" icon={Package} badge={packedItems.length || undefined} onClick={() => setTab("packing")} />
            <NavButton active={tab === "settings"} label="Settings" icon={Settings} onClick={() => setTab("settings")} />
          </nav>
        ) : null}

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

        {/* ── Item Detail (Full-Screen Overlay) ── */}
        {selectedItem && editItemForm ? (
          <div className="item-detail">
            {/* Hero image area */}
            <div className={`item-detail-hero ${selectedItem.image?.downloadUrl ? "has-image" : "no-image"}`}>
              {selectedItem.image?.downloadUrl ? (
                <img src={editing ? (editItemForm.imageUrl || selectedItem.image.downloadUrl) : selectedItem.image.downloadUrl} alt="" />
              ) : (
                <div className="placeholder">
                  {selectedItem.kind === "folder" ? <Folder size={48} color={P.border} strokeWidth={1} /> : <Inbox size={48} color={P.border} strokeWidth={1} />}
                </div>
              )}
              <div className="hero-controls">
                <button className={`hero-btn ${selectedItem.image?.downloadUrl ? "on-image" : "on-plain"}`} onClick={() => { setSelectedItemId(null); setEditing(false); }}>
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  {!editing ? (
                    <button className={`hero-btn ${selectedItem.image?.downloadUrl ? "on-image" : "on-plain"}`} onClick={() => setEditing(true)}>
                      <Edit size={16} />
                    </button>
                  ) : null}
                  <button className={`hero-btn ${selectedItem.image?.downloadUrl ? "on-image" : "on-plain"}`} onClick={() => setDelConfirm(selectedItem.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Content panel */}
            <div className="item-detail-content">
              {editing ? (
                /* ── EDIT MODE ── */
                <div className="stack">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: P.ink }}>Edit Item</h2>
                    <button onClick={() => setEditing(false)} style={{ fontSize: 14, fontWeight: 700, color: P.warm, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                  </div>
                  <Field label="Name *">
                    <TextInput value={editItemForm.name} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                  </Field>
                  <ImagePicker label="Photo" imageUrl={editItemForm.imageUrl} onImageUrlChange={(v) => setEditItemForm((prev) => prev ? { ...prev, imageUrl: v } : prev)} onFileChange={(f) => setEditItemForm((prev) => prev ? { ...prev, imageFile: f } : prev)} />
                  <div className="row two-col">
                    <Field label="Space">
                      <Select value={editItemForm.spaceId} onChange={(e) => { const sid = e.target.value; const aid = spaces.find((s) => s.id === sid)?.areas[0]?.id ?? ""; setEditItemForm((prev) => prev ? { ...prev, spaceId: sid, areaId: aid } : prev); }}>
                        {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Area">
                      <Select value={editItemForm.areaId} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, areaId: e.target.value } : prev)}>
                        {(spaces.find((s) => s.id === editItemForm.spaceId)?.areas ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <div className="row two-col">
                    <Field label="Value ($)">
                      <TextInput type="number" value={editItemForm.value} disabled={editItemForm.isPriceless} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, value: e.target.value } : prev)} placeholder="0" />
                    </Field>
                    <label className="check-row align-end">
                      <input type="checkbox" checked={editItemForm.isPriceless} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, isPriceless: e.target.checked } : prev)} />
                      Priceless
                    </label>
                  </div>
                  <Field label="Tags">
                    <TextInput value={editItemForm.tags} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, tags: e.target.value } : prev)} />
                  </Field>
                  <Field label="Notes">
                    <TextArea rows={3} value={editItemForm.notes} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, notes: e.target.value } : prev)} placeholder="Serial number, purchase info..." />
                  </Field>
                  <button className="btn primary full" disabled={saving || !editItemForm.name.trim()} onClick={() => void saveEditedItem()}>
                    <Save size={16} /> {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div style={{ flex: 1, marginRight: 12 }}>
                      <h1 className="item-detail-title">{selectedItem.name}</h1>
                      {(selectedItem.value || selectedItem.isPriceless) ? (
                        <div className="item-detail-value">{formatCurrency(selectedItem.value, selectedItem.isPriceless)}</div>
                      ) : null}
                    </div>
                    <button
                      className={`pack-toggle ${selectedItem.isPacked ? "packed" : "unpacked"}`}
                      onClick={() => {
                        if (!workspace.userId) return;
                        void workspace.actions.togglePacked({ householdId, itemId: selectedItem.id, userId: workspace.userId, nextValue: !selectedItem.isPacked })
                          .then(() => flash(selectedItem.isPacked ? "Removed from bag" : "Added to bag!"))
                          .catch((error) => flash(error instanceof Error ? error.message : "Failed to update"));
                      }}
                    >
                      <Package size={20} strokeWidth={2} />
                    </button>
                  </div>

                  <div className="location-card">
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: P.warm, marginBottom: 6 }}>Location</div>
                    <div className="location-row">
                      <MapPin size={15} color={P.accent} />
                      <span>{spaceNameById[selectedItem.spaceId]}</span>
                      <ChevronRight size={12} color={P.border} />
                      <span style={{ color: P.inkMuted }}>{selectedItem.areaNameSnapshot}</span>
                    </div>
                  </div>

                  {selectedItem.notes ? (
                    <div className="notes-card">
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: P.warm, marginBottom: 6 }}>Notes</div>
                      <p>{selectedItem.notes}</p>
                    </div>
                  ) : null}

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: P.warm, marginBottom: 6 }}>Tags</div>
                    <div className="tag-list">
                      {selectedItem.tags.map((t) => (
                        <span key={t} className="tag-chip"><Tag size={11} /> {t}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    <button className="btn full" style={{ background: P.accentSoft, color: P.accent, border: `1px solid rgba(232,101,43,0.15)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setEditing(true)}>
                      <Edit size={15} /> Edit Item
                    </button>
                    <button className="btn full" style={{ background: P.canvas, color: P.ink, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => {
                      // Quick-move: open scanner or could open a move modal
                      flash("Use Edit to change space/area");
                    }}>
                      <ArrowRight size={15} /> Move to another space
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* ── Delete Confirm ── */}
        {delConfirm ? (
          <div className="delete-confirm">
            <div className="delete-confirm-backdrop" onClick={() => setDelConfirm(null)} />
            <div className="delete-confirm-card">
              <div className="delete-confirm-icon"><Trash2 size={22} /></div>
              <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: P.ink }}>Delete this item?</h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: P.warm }}>This can&apos;t be undone.</p>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setDelConfirm(null)}>Cancel</button>
                <button className="btn primary" style={{ flex: 1, background: P.danger }} onClick={() => {
                  void workspace.actions
                    .deleteItem({ householdId, itemId: delConfirm })
                    .then(() => { setDelConfirm(null); setSelectedItemId(null); setEditing(false); flash("Item deleted"); })
                    .catch((error) => flash(error instanceof Error ? error.message : "Failed to delete item"));
                }}>Delete</button>
              </div>
            </div>
          </div>
        ) : null}

        {toast ? <div className="toast"><div className="toast-inner">{toast}</div></div> : null}
      </div>
    </div>
  );
}
