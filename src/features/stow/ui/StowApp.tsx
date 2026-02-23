import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  FormEvent,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import type { User } from "firebase/auth";
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  Users,
  KeyRound,
  LogOut,
  Sparkles,
  QrCode,
  Share2,
  Download,
  MoreHorizontal
} from "lucide-react";
import { useWorkspaceData } from "@/features/stow/hooks/useWorkspaceData";
import type { ImageRef, Item, Role, SpaceIcon } from "@/types/domain";
import type { HouseholdLlmConfig, VisionSuggestion } from "@/types/llm";
import { storagePaths } from "@/lib/firebase/paths";
import { toLoggedUserErrorMessage, toUserErrorMessage } from "@/lib/firebase/errors";
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
type PackingShow = "unpacked" | "packed" | "all";
type PackingSort = "location" | "recent" | "value";
type SearchPackedFilter = "all" | "yes" | "no";
type SearchKindFilter = "all" | "item" | "folder";
type SpaceContentView = "areas" | "items";
type SpaceItemsPackedFilter = "all" | "packed" | "unpacked";
type SpaceItemsSort = "recent" | "name" | "value";

type RouteUiState = {
  tab: TabKey;
  spaceId: string | null;
  areaId: string | null;
  itemId: string | null;
};

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

type FirebaseFunctionsModule = typeof import("@/lib/firebase/functions");
type QrCodeModule = typeof import("qrcode");

let firebaseFunctionsModulePromise: Promise<FirebaseFunctionsModule> | null = null;
let qrCodeModulePromise: Promise<QrCodeModule> | null = null;

function loadFirebaseFunctionsModule() {
  if (!firebaseFunctionsModulePromise) {
    firebaseFunctionsModulePromise = import("@/lib/firebase/functions");
  }
  return firebaseFunctionsModulePromise;
}

function loadQrCodeModule() {
  if (!qrCodeModulePromise) {
    qrCodeModulePromise = import("qrcode");
  }
  return qrCodeModulePromise;
}

function iconForSpace(icon: string) {
  switch (icon) {
    case "home":
      return Home;
    default:
      return Box;
  }
}

function parseRouteUiState(pathname: string, params: URLSearchParams): RouteUiState {
  const itemMatch = matchPath("/items/:itemId", pathname);
  if (itemMatch?.params.itemId) {
    const fromParam = params.get("from");
    const tab: TabKey =
      fromParam === "search" || fromParam === "packing" || fromParam === "settings" || fromParam === "spaces"
        ? fromParam
        : "spaces";
    return {
      tab,
      spaceId: params.get("spaceId"),
      areaId: params.get("areaId"),
      itemId: itemMatch.params.itemId
    };
  }

  const areaMatch = matchPath("/spaces/:spaceId/areas/:areaId", pathname);
  if (areaMatch?.params.spaceId && areaMatch.params.areaId) {
    return {
      tab: "spaces",
      spaceId: areaMatch.params.spaceId,
      areaId: areaMatch.params.areaId,
      itemId: null
    };
  }

  const spaceMatch = matchPath("/spaces/:spaceId", pathname);
  if (spaceMatch?.params.spaceId) {
    return {
      tab: "spaces",
      spaceId: spaceMatch.params.spaceId,
      areaId: null,
      itemId: null
    };
  }

  if (pathname === "/search") return { tab: "search", spaceId: null, areaId: null, itemId: null };
  if (pathname === "/packing") return { tab: "packing", spaceId: null, areaId: null, itemId: null };
  if (pathname === "/settings") return { tab: "settings", spaceId: null, areaId: null, itemId: null };
  return { tab: "spaces", spaceId: null, areaId: null, itemId: null };
}

function formatTimestamp(value: { toDate?: () => Date } | Date | null | undefined) {
  if (!value) return null;
  try {
    const date = value instanceof Date ? value : value.toDate?.();
    if (!date) return null;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  } catch {
    return null;
  }
}

function csvToList(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function listToCsv(values: string[]) {
  return values.join(", ");
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
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
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const firstFocusable = focusableElements(sheet)[0];
      (firstFocusable ?? sheet).focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const sheet = sheetRef.current;
    if (!sheet) return;
    const items = focusableElements(sheet);
    if (items.length === 0) {
      event.preventDefault();
      sheet.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;
  return (
    <div className="overlay">
      <div className="overlay-backdrop" onClick={onClose} />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
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
  imageFile,
  onImageUrlChange,
  onFileChange,
  disabled,
  helperText
}: {
  label: string;
  imageUrl: string;
  imageFile: File | null;
  onImageUrlChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  helperText?: string;
}) {
  const objectUrlRef = useRef<string | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (!imageFile) {
      setFilePreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(imageFile);
    objectUrlRef.current = nextUrl;
    setFilePreviewUrl(nextUrl);
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [imageFile]);

  const previewUrl = filePreviewUrl || imageUrl.trim() || "";
  const hasPreview = Boolean(previewUrl);

  return (
    <div className="stack-sm">
      {hasPreview ? (
        <div className="image-picker-preview panel">
          <img src={previewUrl} alt={`${label} preview`} className="hero-image" />
          <div className="row gap-sm">
            {imageFile ? <StatusPill color="default">Uploaded file: {imageFile.name}</StatusPill> : null}
            {imageUrl.trim() && !imageFile ? <StatusPill color="default">URL image</StatusPill> : null}
            <button
              type="button"
              className="btn"
              onClick={() => {
                onFileChange(null);
                onImageUrlChange("");
              }}
            >
              Remove image
            </button>
          </div>
        </div>
      ) : null}
      <Field label={`${label} (URL fallback)`}>
        <TextInput
          value={imageUrl}
          onChange={(e) => onImageUrlChange(e.target.value)}
          placeholder="https://..."
          disabled={disabled}
        />
      </Field>
      <Field label={`${label} (camera / gallery)`}>
        <input
          className="input file-input"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </Field>
      {helperText ? <div className="field-help">{helperText}</div> : null}
    </div>
  );
}

function ChipInput({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const chips = useMemo(() => csvToList(value), [value]);

  const commitDraft = () => {
    const next = draft.trim().replace(/^#/, "");
    if (!next) return;
    if (!chips.some((chip) => chip.toLowerCase() === next.toLowerCase())) {
      onChange(listToCsv([...chips, next]));
    }
    setDraft("");
  };

  const removeChip = (chip: string) => {
    onChange(listToCsv(chips.filter((value) => value !== chip)));
  };

  return (
    <div className="stack-sm">
      {label ? <div className="field-help">{label}</div> : null}
      <div className="chip-input">
        {chips.map((chip) => (
          <button key={chip} type="button" className="chip-input-pill" onClick={() => removeChip(chip)}>
            #{chip} <X size={12} />
          </button>
        ))}
        <input
          className="chip-input-field"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitDraft();
            } else if (e.key === "Backspace" && !draft && chips.length) {
              e.preventDefault();
              const last = chips[chips.length - 1];
              removeChip(last);
            }
          }}
          onBlur={commitDraft}
        />
      </div>
      {suggestions.length ? (
        <div className="chip-suggestions">
          {suggestions
            .filter((candidate) => !chips.some((chip) => chip.toLowerCase() === candidate.toLowerCase()))
            .slice(0, 8)
            .map((candidate) => (
              <button
                key={candidate}
                type="button"
                className="search-tag-btn"
                onClick={() => onChange(listToCsv([...chips, candidate]))}
              >
                + #{candidate}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function StringListEditor({
  values,
  onChange,
  placeholder = "Name"
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="stack-sm">
      {values.map((value, index) => (
        <div className="row" key={`${index}-${value}`}>
          <TextInput
            value={value}
            onChange={(e) =>
              onChange(values.map((current, i) => (i === index ? e.target.value : current)))
            }
            placeholder={`${placeholder} ${index + 1}`}
          />
          <button
            type="button"
            className="btn"
            disabled={values.length <= 1}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...values, ""])}>
        <Plus size={14} /> Add another area
      </button>
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
    <button
      type="button"
      className={`nav-btn ${active ? "active" : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
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
  const location = useLocation();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const { toast, flash } = useToast();
  const workspace = useWorkspaceData(householdId, user);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [showAddArea, setShowAddArea] = useState(false);
  const [showEditSpace, setShowEditSpace] = useState(false);
  const [showEditArea, setShowEditArea] = useState(false);
  const [showDeleteArea, setShowDeleteArea] = useState(false);
  const [showDeleteSpace, setShowDeleteSpace] = useState(false);
  const [showMoveItem, setShowMoveItem] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [delConfirm, setDelConfirm] = useState<string | null>(null);
  const [showQrForSpaceId, setShowQrForSpaceId] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkPackingWorking, setBulkPackingWorking] = useState(false);
  const [visionWorking, setVisionWorking] = useState(false);
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteWorking, setInviteWorking] = useState(false);
  const [llmSecretInput, setLlmSecretInput] = useState("");
  const [llmSaveWorking, setLlmSaveWorking] = useState(false);
  const [llmValidateWorking, setLlmValidateWorking] = useState(false);
  const [householdNameInput, setHouseholdNameInput] = useState("");
  const [householdSaveWorking, setHouseholdSaveWorking] = useState(false);
  const [memberActionWorkingUid, setMemberActionWorkingUid] = useState<string | null>(null);
  const [inviteActionWorkingId, setInviteActionWorkingId] = useState<string | null>(null);

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
    icon: "box" as SpaceIcon,
    color: randomColor(),
    areaNames: ["Main"],
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
  const [editSpaceForm, setEditSpaceForm] = useState<{
    name: string;
    icon: SpaceIcon;
    color: string;
    imageUrl: string;
    imageFile: File | null;
  } | null>(null);
  const [editAreaForm, setEditAreaForm] = useState<{
    name: string;
    imageUrl: string;
    imageFile: File | null;
  } | null>(null);
  const [moveItemForm, setMoveItemForm] = useState<{
    spaceId: string;
    areaId: string;
    note: string;
  } | null>(null);
  const [deleteAreaForm, setDeleteAreaForm] = useState<{
    reassignSpaceId: string;
    reassignAreaId: string;
  } | null>(null);
  const [deleteSpaceForm, setDeleteSpaceForm] = useState<{
    reassignSpaceId: string;
    reassignAreaId: string;
  } | null>(null);

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

  const routeUi = useMemo(
    () => parseRouteUiState(location.pathname, urlSearchParams),
    [location.pathname, urlSearchParams]
  );
  const tab = routeUi.tab;
  const selectedSpaceId = routeUi.spaceId;
  const selectedAreaId = routeUi.areaId;
  const selectedItemId = routeUi.itemId;

  const searchViewParam = urlSearchParams.get("view");
  const persistedGridPreference =
    typeof window !== "undefined" ? window.localStorage.getItem(`stow:${householdId}:search-view`) : null;
  const gridView = (searchViewParam ?? persistedGridPreference ?? "list") === "grid";
  const searchQuery = urlSearchParams.get("q") ?? "";
  const searchPackedFilter = (urlSearchParams.get("packed") as SearchPackedFilter | null) ?? "all";
  const searchKindFilter = (urlSearchParams.get("kind") as SearchKindFilter | null) ?? "all";
  const searchSpaceFilter = urlSearchParams.get("spaceId") ?? "";
  const searchAreaFilter = urlSearchParams.get("areaId") ?? "";
  const searchHasPhoto = urlSearchParams.get("hasPhoto") === "1";
  const searchTagFilters = urlSearchParams.getAll("tag");
  const packingShow = (urlSearchParams.get("show") as PackingShow | null) ?? "unpacked";
  const packingSpaceFilter = urlSearchParams.get("spaceId") ?? "";
  const packingAreaFilter = urlSearchParams.get("areaId") ?? "";
  const packingKindFilter = (urlSearchParams.get("kind") as SearchKindFilter | null) ?? "all";
  const packingGroupBy = urlSearchParams.get("groupBy") === "none" ? "none" : "location";
  const packingSort = (urlSearchParams.get("sort") as PackingSort | null) ?? "location";
  const spacesContentView = (urlSearchParams.get("spaceView") as SpaceContentView | null) ?? "areas";
  const spaceItemsPackedFilter = (urlSearchParams.get("spacePacked") as SpaceItemsPackedFilter | null) ?? "all";
  const spaceItemsKindFilter = (urlSearchParams.get("spaceKind") as SearchKindFilter | null) ?? "all";
  const spaceItemsSort = (urlSearchParams.get("spaceSort") as SpaceItemsSort | null) ?? "recent";

  useEffect(() => {
    if (workspace.llmConfig) {
      setLlmForm((prev) => ({ ...prev, ...workspace.llmConfig }));
    }
  }, [workspace.llmConfig]);

  const spaces = workspace.spaces;
  const items = workspace.items;
  const members = workspace.members;
  const invites = workspace.invites ?? [];
  const currentSpace = spaces.find((space) => space.id === selectedSpaceId) ?? null;
  const currentArea = currentSpace?.areas.find((area) => area.id === selectedAreaId) ?? null;
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const currentUserMember = members.find((member) => member.uid === user.uid) ?? null;
  const isAdmin = Boolean(currentUserMember && (currentUserMember.role === "OWNER" || currentUserMember.role === "ADMIN"));
  const isOwner = currentUserMember?.role === "OWNER";
  const ownerCount = members.filter((member) => member.role === "OWNER").length;
  const memberNameByUid = useMemo(
    () =>
      Object.fromEntries(
        members.map((member) => [member.uid, member.displayName || member.email || member.uid])
      ),
    [members]
  );

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
  const currentAreaItemCount = selectedAreaId ? spaceItems.filter((item) => item.areaId === selectedAreaId).length : 0;
  const currentSpaceItemCount = spaceItems.length;
  const filteredSpaceItems = spaceItems
    .filter((item) => (selectedAreaId ? item.areaId === selectedAreaId : true))
    .filter((item) => (spaceItemsPackedFilter === "all" ? true : spaceItemsPackedFilter === "packed" ? item.isPacked : !item.isPacked))
    .filter((item) => (spaceItemsKindFilter === "all" ? true : item.kind === spaceItemsKindFilter))
    .sort((a, b) => {
      if (spaceItemsSort === "name") return a.name.localeCompare(b.name);
      if (spaceItemsSort === "value") return (b.value ?? 0) - (a.value ?? 0);
      const aDate = a.updatedAt?.toDate?.().getTime?.() ?? 0;
      const bDate = b.updatedAt?.toDate?.().getTime?.() ?? 0;
      return bDate - aDate;
    });
  const packedItems = items.filter((item) => item.isPacked);
  const activeInvites = invites
    .filter((invite) => !invite.acceptedAt)
    .filter((invite) => {
      try {
        return invite.expiresAt?.toDate?.().getTime?.() ? invite.expiresAt.toDate().getTime() > Date.now() : true;
      } catch {
        return true;
      }
    });
  const deleteAreaDestinations = useMemo(() => {
    const result: Array<{ spaceId: string; spaceName: string; areaId: string; areaName: string }> = [];
    for (const space of spaces) {
      for (const area of space.areas) {
        if (space.id === selectedSpaceId && area.id === selectedAreaId) continue;
        result.push({ spaceId: space.id, spaceName: space.name, areaId: area.id, areaName: area.name });
      }
    }
    return result;
  }, [selectedAreaId, selectedSpaceId, spaces]);
  const deleteSpaceDestinations = useMemo(() => {
    const result: Array<{ spaceId: string; spaceName: string; areaId: string; areaName: string }> = [];
    for (const space of spaces) {
      if (space.id === selectedSpaceId) continue;
      for (const area of space.areas) {
        result.push({ spaceId: space.id, spaceName: space.name, areaId: area.id, areaName: area.name });
      }
    }
    return result;
  }, [selectedSpaceId, spaces]);
  const allTags = [...new Set(items.flatMap((item) => item.tags ?? []))].sort((a, b) => a.localeCompare(b));
  const searchedItems = items.filter((item) => {
    if (searchSpaceFilter && item.spaceId !== searchSpaceFilter) return false;
    if (searchAreaFilter && item.areaId !== searchAreaFilter) return false;
    if (searchPackedFilter === "yes" && !item.isPacked) return false;
    if (searchPackedFilter === "no" && item.isPacked) return false;
    if (searchKindFilter !== "all" && item.kind !== searchKindFilter) return false;
    if (searchHasPhoto && !item.image?.downloadUrl) return false;
    if (searchTagFilters.length) {
      const itemTags = item.tags.map((tag) => tag.toLowerCase());
      const requiredTags = searchTagFilters.map((tag) => tag.toLowerCase());
      if (!requiredTags.every((tag) => itemTags.includes(tag))) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const inName = item.name.toLowerCase().includes(q);
    const inTags = item.tags.some((tag) => tag.toLowerCase().includes(q));
    const inArea = item.areaNameSnapshot.toLowerCase().includes(q);
    const inSpace = spaces.find((space) => space.id === item.spaceId)?.name.toLowerCase().includes(q) ?? false;
    return inName || inTags || inArea || inSpace;
  });
  const hasSearchFilters =
    Boolean(searchQuery.trim()) ||
    searchPackedFilter !== "all" ||
    searchKindFilter !== "all" ||
    searchSpaceFilter !== "" ||
    searchAreaFilter !== "" ||
    searchHasPhoto ||
    searchTagFilters.length > 0;
  const recentSearches = useMemo(() => {
    if (typeof window === "undefined") return [] as string[];
    try {
      const raw = window.localStorage.getItem(`stow:${householdId}:recent-searches`);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return parsed.filter(Boolean).slice(0, 6);
    } catch {
      return [] as string[];
    }
  }, [householdId, searchQuery]);

  const packingItems = items.filter((item) => {
    if (packingShow === "packed" && !item.isPacked) return false;
    if (packingShow === "unpacked" && item.isPacked) return false;
    if (packingSpaceFilter && item.spaceId !== packingSpaceFilter) return false;
    if (packingAreaFilter && item.areaId !== packingAreaFilter) return false;
    if (packingKindFilter !== "all" && item.kind !== packingKindFilter) return false;
    return true;
  });
  const sortedPackingItems = useMemo(() => {
    const next = [...packingItems];
    next.sort((a, b) => {
      if (packingSort === "recent") {
        const aDate = a.updatedAt?.toDate?.().getTime?.() ?? 0;
        const bDate = b.updatedAt?.toDate?.().getTime?.() ?? 0;
        return bDate - aDate;
      }
      if (packingSort === "value") {
        return (b.value ?? 0) - (a.value ?? 0);
      }
      const aSpaceName = spaces.find((space) => space.id === a.spaceId)?.name ?? "";
      const bSpaceName = spaces.find((space) => space.id === b.spaceId)?.name ?? "";
      const aLabel = `${aSpaceName} ${a.areaNameSnapshot} ${a.name}`;
      const bLabel = `${bSpaceName} ${b.areaNameSnapshot} ${b.name}`;
      return aLabel.localeCompare(bLabel);
    });
    return next;
  }, [packingItems, packingSort, spaces]);
  const packingGroups = useMemo(() => {
    if (packingGroupBy === "none") return [{ key: "all", label: "All items", items: sortedPackingItems }] as const;
    const map = new Map<string, Item[]>();
    for (const item of sortedPackingItems) {
      const key = `${item.spaceId}::${item.areaId}`;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].map(([key, value]) => {
      const [spaceId, areaId] = key.split("::");
      const space = spaces.find((s) => s.id === spaceId);
      const area = space?.areas.find((a) => a.id === areaId);
      return {
        key,
        label: `${space?.name ?? "Unknown"} · ${area?.name ?? value[0]?.areaNameSnapshot ?? "Unknown"}`,
        items: value
      };
    });
  }, [packingGroupBy, sortedPackingItems, spaces]);

  useEffect(() => {
    if (!showQrForSpaceId) {
      setQrImageUrl(null);
      return;
    }
    let cancelled = false;
    const url = `${window.location.origin}/spaces/${showQrForSpaceId}`;
    void loadQrCodeModule()
      .then((module) =>
        module.toDataURL(url, { margin: 1, width: 220, color: { dark: "#1A1A2E", light: "#FFFFFF" } })
      )
      .then((value) => {
        if (!cancelled) setQrImageUrl(value);
      })
      .catch(() => {
        if (!cancelled) setQrImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showQrForSpaceId]);

  useEffect(() => {
    if (!selectedItem) {
      setEditItemForm(null);
      setMoveItemForm(null);
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
    setMoveItemForm({
      spaceId: selectedItem.spaceId,
      areaId: selectedItem.areaId,
      note: ""
    });
  }, [selectedItem]);

  useEffect(() => {
    if (!currentSpace) {
      setEditSpaceForm(null);
      return;
    }
    setEditSpaceForm({
      name: currentSpace.name,
      icon: currentSpace.icon,
      color: currentSpace.color,
      imageUrl: currentSpace.image?.downloadUrl ?? "",
      imageFile: null
    });
  }, [currentSpace]);

  useEffect(() => {
    if (!currentArea) {
      setEditAreaForm(null);
      setDeleteAreaForm(null);
      return;
    }
    setEditAreaForm({
      name: currentArea.name,
      imageUrl: currentArea.image?.downloadUrl ?? "",
      imageFile: null
    });
    const firstDestination = deleteAreaDestinations[0];
    setDeleteAreaForm(
      firstDestination
        ? { reassignSpaceId: firstDestination.spaceId, reassignAreaId: firstDestination.areaId }
        : { reassignSpaceId: "", reassignAreaId: "" }
    );
  }, [currentArea, deleteAreaDestinations]);

  useEffect(() => {
    if (!currentSpace) {
      setDeleteSpaceForm(null);
      return;
    }
    const firstDestination = deleteSpaceDestinations[0];
    setDeleteSpaceForm(
      firstDestination
        ? { reassignSpaceId: firstDestination.spaceId, reassignAreaId: firstDestination.areaId }
        : { reassignSpaceId: "", reassignAreaId: "" }
    );
  }, [currentSpace, deleteSpaceDestinations]);

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

  useEffect(() => {
    if (tab !== "search") return;
    const q = searchQuery.trim();
    if (q.length < 2 || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      try {
        const key = `stow:${householdId}:recent-searches`;
        const current = (() => {
          const raw = window.localStorage.getItem(key);
          return raw ? (JSON.parse(raw) as string[]) : [];
        })();
        const next = [q, ...current.filter((entry) => entry.toLowerCase() !== q.toLowerCase())].slice(0, 8);
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Ignore storage failures.
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [tab, searchQuery, householdId]);

  const currentSpaceForAddItem = spaces.find((space) => space.id === addItemForm.spaceId) ?? null;
  const currentAreaForAddItem = currentSpaceForAddItem?.areas.find((area) => area.id === addItemForm.areaId) ?? null;

  const syncText = workspace.sync.hasPendingWrites
    ? "Syncing changes…"
    : workspace.sync.fromCache && online
      ? "Using cached data"
      : online
        ? "Live"
        : "Offline";
  const normalizedWorkspaceError = workspace.error
    ? toUserErrorMessage(workspace.error, "We couldn’t load household data.")
    : null;
  const showCollectionLoadWarning = Boolean(normalizedWorkspaceError && items.length === 0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`stow:${householdId}:search-view`, gridView ? "grid" : "list");
  }, [gridView, householdId]);

  useEffect(() => {
    if (workspace.household?.name) {
      setHouseholdNameInput(workspace.household.name);
    }
  }, [workspace.household?.name]);

  function updateCurrentQuery(
    changes: Record<string, string | null | undefined | string[]>,
    options?: { replace?: boolean }
  ) {
    const next = new URLSearchParams(urlSearchParams);
    for (const [key, raw] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(raw)) {
        for (const value of raw.filter(Boolean)) next.append(key, value);
        continue;
      }
      if (raw == null || raw === "") continue;
      next.set(key, raw);
    }
    setUrlSearchParams(next, { replace: options?.replace ?? false });
  }

  function navigateToSpaces(spaceId?: string | null, areaId?: string | null, query?: URLSearchParams | null) {
    const base = areaId && spaceId ? `/spaces/${spaceId}/areas/${areaId}` : spaceId ? `/spaces/${spaceId}` : "/spaces";
    const search = query?.toString();
    navigate(search ? `${base}?${search}` : base);
  }

  function navigateToTab(nextTab: TabKey) {
    const next = new URLSearchParams();
    if (nextTab === "search") {
      if (searchQuery) next.set("q", searchQuery);
      if (gridView) next.set("view", "grid");
      if (searchPackedFilter !== "all") next.set("packed", searchPackedFilter);
      if (searchKindFilter !== "all") next.set("kind", searchKindFilter);
      if (searchSpaceFilter) next.set("spaceId", searchSpaceFilter);
      if (searchAreaFilter) next.set("areaId", searchAreaFilter);
      if (searchHasPhoto) next.set("hasPhoto", "1");
      for (const tag of searchTagFilters) next.append("tag", tag);
    }
    if (nextTab === "packing") {
      if (packingShow !== "unpacked") next.set("show", packingShow);
      if (packingSpaceFilter) next.set("spaceId", packingSpaceFilter);
      if (packingAreaFilter) next.set("areaId", packingAreaFilter);
      if (packingKindFilter !== "all") next.set("kind", packingKindFilter);
      if (packingGroupBy !== "location") next.set("groupBy", packingGroupBy);
      if (packingSort !== "location") next.set("sort", packingSort);
    }
    const search = next.toString();
    navigate(`/${nextTab === "spaces" ? "spaces" : nextTab}${search ? `?${search}` : ""}`);
  }

  function navigateToItem(itemId: string) {
    const next = new URLSearchParams();
    next.set("from", tab);
    if (tab === "spaces") {
      if (selectedSpaceId) next.set("spaceId", selectedSpaceId);
      if (selectedAreaId) next.set("areaId", selectedAreaId);
      if (spacesContentView !== "areas") next.set("spaceView", spacesContentView);
      if (spaceItemsPackedFilter !== "all") next.set("spacePacked", spaceItemsPackedFilter);
      if (spaceItemsKindFilter !== "all") next.set("spaceKind", spaceItemsKindFilter);
      if (spaceItemsSort !== "recent") next.set("spaceSort", spaceItemsSort);
    } else if (tab === "search") {
      if (searchQuery) next.set("q", searchQuery);
      if (gridView) next.set("view", "grid");
      if (searchPackedFilter !== "all") next.set("packed", searchPackedFilter);
      if (searchKindFilter !== "all") next.set("kind", searchKindFilter);
      if (searchSpaceFilter) next.set("spaceId", searchSpaceFilter);
      if (searchAreaFilter) next.set("areaId", searchAreaFilter);
      if (searchHasPhoto) next.set("hasPhoto", "1");
      for (const tag of searchTagFilters) next.append("tag", tag);
    } else if (tab === "packing") {
      if (packingShow !== "unpacked") next.set("show", packingShow);
      if (packingSpaceFilter) next.set("spaceId", packingSpaceFilter);
      if (packingAreaFilter) next.set("areaId", packingAreaFilter);
      if (packingKindFilter !== "all") next.set("kind", packingKindFilter);
      if (packingGroupBy !== "location") next.set("groupBy", packingGroupBy);
      if (packingSort !== "location") next.set("sort", packingSort);
    }
    navigate(`/items/${itemId}?${next.toString()}`);
  }

  function closeItemDetail() {
    if (tab === "search") {
      const next = new URLSearchParams();
      if (searchQuery) next.set("q", searchQuery);
      if (gridView) next.set("view", "grid");
      if (searchPackedFilter !== "all") next.set("packed", searchPackedFilter);
      if (searchKindFilter !== "all") next.set("kind", searchKindFilter);
      if (searchSpaceFilter) next.set("spaceId", searchSpaceFilter);
      if (searchAreaFilter) next.set("areaId", searchAreaFilter);
      if (searchHasPhoto) next.set("hasPhoto", "1");
      for (const tag of searchTagFilters) next.append("tag", tag);
      navigate(`/search${next.toString() ? `?${next.toString()}` : ""}`);
      return;
    }
    if (tab === "packing") {
      const next = new URLSearchParams();
      if (packingShow !== "unpacked") next.set("show", packingShow);
      if (packingSpaceFilter) next.set("spaceId", packingSpaceFilter);
      if (packingAreaFilter) next.set("areaId", packingAreaFilter);
      if (packingKindFilter !== "all") next.set("kind", packingKindFilter);
      if (packingGroupBy !== "location") next.set("groupBy", packingGroupBy);
      if (packingSort !== "location") next.set("sort", packingSort);
      navigate(`/packing${next.toString() ? `?${next.toString()}` : ""}`);
      return;
    }
    if (tab === "settings") {
      navigate("/settings");
      return;
    }
    const next = new URLSearchParams();
    if (spacesContentView !== "areas") next.set("spaceView", spacesContentView);
    if (spaceItemsPackedFilter !== "all") next.set("spacePacked", spaceItemsPackedFilter);
    if (spaceItemsKindFilter !== "all") next.set("spaceKind", spaceItemsKindFilter);
    if (spaceItemsSort !== "recent") next.set("spaceSort", spaceItemsSort);
    navigateToSpaces(selectedSpaceId, selectedAreaId, next);
  }

  async function copyInviteLinkToClipboard() {
    if (!inviteLink) return;
    await copyText(inviteLink, "Invite link copied");
  }

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
      const areaNames = addSpaceForm.areaNames.map((value) => value.trim()).filter(Boolean);
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
      setAddSpaceForm({ name: "", icon: "box", color: randomColor(), areaNames: ["Main"], imageUrl: "", imageFile: null });
      navigateToSpaces(newSpaceId);
      flash("Space created");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to create space"));
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
      setShowAddArea(false);
      setAddAreaForm({ name: "", imageUrl: "", imageFile: null });
      navigateToSpaces(selectedSpaceId, newAreaId, new URLSearchParams([["spaceView", "items"]]));
      flash("Area created");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to create area"));
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
      flash(toLoggedUserErrorMessage(error, "Failed to add item"));
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedItem(options?: { closeAfterSave?: boolean }) {
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
      if (options?.closeAfterSave) {
        setEditing(false);
        closeItemDetail();
      }
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to update item"));
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
          const { visionCategorizeItemImage } = await loadFirebaseFunctionsModule();
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
      flash(toLoggedUserErrorMessage(error, "Vision categorization failed"));
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
      flash(toLoggedUserErrorMessage(error, "Failed to save vision draft"));
    } finally {
      setSaving(false);
    }
  }

  async function createInviteForRole(role: Role) {
    setInviteWorking(true);
    try {
      const { createHouseholdInvite } = await loadFirebaseFunctionsModule();
      const result = await createHouseholdInvite({ householdId, role, expiresInHours: 72 });
      const inviteUrl = new URL(result.inviteUrl, window.location.origin);
      inviteUrl.searchParams.set("role", role);
      inviteUrl.searchParams.set("expiresAt", result.expiresAt);
      if (workspace.household?.name) inviteUrl.searchParams.set("householdName", workspace.household.name);
      if (user.displayName || user.email) inviteUrl.searchParams.set("inviter", user.displayName || user.email || "");
      setInviteLink(inviteUrl.toString());
      flash("Invite link created");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to create invite"));
    } finally {
      setInviteWorking(false);
    }
  }

  async function createInvite() {
    await createInviteForRole(inviteRole);
  }

  async function saveHouseholdName() {
    if (!householdNameInput.trim()) {
      flash("Enter a household name");
      return;
    }
    setHouseholdSaveWorking(true);
    try {
      await workspace.actions.updateHousehold({
        householdId,
        patch: { name: householdNameInput.trim() }
      });
      flash("Household updated");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to update household"));
    } finally {
      setHouseholdSaveWorking(false);
    }
  }

  async function saveEditedSpace() {
    if (!currentSpace || !editSpaceForm || !editSpaceForm.name.trim()) return;
    setSaving(true);
    try {
      const image = await resolveImageRef({
        householdId,
        target: "space",
        targetId: currentSpace.id,
        file: editSpaceForm.imageFile,
        url: editSpaceForm.imageUrl
      });
      await workspace.actions.updateSpace({
        householdId,
        spaceId: currentSpace.id,
        patch: {
          name: editSpaceForm.name.trim(),
          icon: editSpaceForm.icon,
          color: editSpaceForm.color,
          image: image ?? (editSpaceForm.imageUrl.trim() ? imageRefFromUrl(editSpaceForm.imageUrl) : null)
        }
      });
      setShowEditSpace(false);
      flash("Space updated");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to update space"));
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedArea() {
    if (!currentSpace || !currentArea || !editAreaForm || !editAreaForm.name.trim()) return;
    setSaving(true);
    try {
      const image = await resolveImageRef({
        householdId,
        target: "area",
        targetId: currentArea.id,
        file: editAreaForm.imageFile,
        url: editAreaForm.imageUrl
      });
      await workspace.actions.updateArea({
        householdId,
        spaceId: currentSpace.id,
        areaId: currentArea.id,
        patch: {
          name: editAreaForm.name.trim(),
          image: image ?? (editAreaForm.imageUrl.trim() ? imageRefFromUrl(editAreaForm.imageUrl) : null)
        }
      });
      setShowEditArea(false);
      flash("Area updated");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to update area"));
    } finally {
      setSaving(false);
    }
  }

  async function saveMovedItem() {
    if (!selectedItem || !moveItemForm || !workspace.userId) return;
    const targetSpace = spaces.find((space) => space.id === moveItemForm.spaceId);
    const targetArea = targetSpace?.areas.find((area) => area.id === moveItemForm.areaId);
    if (!targetSpace || !targetArea) {
      flash("Select a destination space and area");
      return;
    }
    setSaving(true);
    try {
      await workspace.actions.updateItem({
        householdId,
        itemId: selectedItem.id,
        userId: workspace.userId,
        patch: {
          spaceId: targetSpace.id,
          areaId: targetArea.id,
          areaNameSnapshot: targetArea.name,
          notes: moveItemForm.note.trim()
            ? [selectedItem.notes ?? "", "", `Location updated: ${moveItemForm.note.trim()}`].filter(Boolean).join("\n")
            : selectedItem.notes
        }
      });
      setShowMoveItem(false);
      flash("Item moved");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to move item"));
    } finally {
      setSaving(false);
    }
  }

  async function copyText(text: string, successMessage: string) {
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      flash(successMessage);
    } catch (error) {
      flash("Couldn’t copy automatically");
      if (import.meta.env.DEV) console.error(error);
    }
  }

  function buildInviteUrlFromInvite(invite: { id: string; token?: string; role: Role; expiresAt?: { toDate?: () => Date } }) {
    if (!invite.token) return "";
    const url = new URL(`${window.location.origin}/invite`);
    url.searchParams.set("householdId", householdId);
    url.searchParams.set("token", invite.token);
    url.searchParams.set("role", invite.role);
    if (workspace.household?.name) url.searchParams.set("householdName", workspace.household.name);
    if (user.displayName || user.email) url.searchParams.set("inviter", user.displayName || user.email || "");
    const expiresAt = invite.expiresAt?.toDate?.();
    if (expiresAt) url.searchParams.set("expiresAt", expiresAt.toISOString());
    return url.toString();
  }

  async function copyInviteFromRow(inviteId: string) {
    const invite = activeInvites.find((candidate) => candidate.id === inviteId);
    if (!invite) return;
    if (!invite.token) {
      flash("Legacy invite links can’t be copied. Regenerate a new invite.");
      return;
    }
    await copyText(buildInviteUrlFromInvite(invite as { id: string; token?: string; role: Role; expiresAt?: { toDate?: () => Date } }), "Invite link copied");
  }

  async function revokeInviteRow(inviteId: string) {
    if (!window.confirm("Revoke this invite link? Existing unused links will stop working.")) return;
    setInviteActionWorkingId(inviteId);
    try {
      await workspace.actions.revokeInvite({ householdId, inviteId });
      flash("Invite revoked");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to revoke invite"));
    } finally {
      setInviteActionWorkingId(null);
    }
  }

  async function regenerateInvite(inviteId: string, role: Role) {
    if (!window.confirm("Regenerate this invite? The current invite link will be revoked.")) return;
    setInviteActionWorkingId(inviteId);
    try {
      await createInviteForRole(role);
      await workspace.actions.revokeInvite({ householdId, inviteId });
      flash("Invite regenerated");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to regenerate invite"));
    } finally {
      setInviteActionWorkingId(null);
    }
  }

  async function updateMemberRoleAction(uid: string, role: Role) {
    setMemberActionWorkingUid(uid);
    try {
      await workspace.actions.updateMemberRole({ householdId, uid, role });
      flash("Member role updated");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to update member role"));
    } finally {
      setMemberActionWorkingUid(null);
    }
  }

  async function removeMemberAction(uid: string) {
    const memberLabel = memberNameByUid[uid] || uid;
    if (!window.confirm(`Remove ${memberLabel} from this household?`)) return;
    setMemberActionWorkingUid(uid);
    try {
      await workspace.actions.removeMember({ householdId, uid });
      flash("Member removed");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to remove member"));
    } finally {
      setMemberActionWorkingUid(null);
    }
  }

  async function confirmDeleteArea() {
    if (!currentSpace || !currentArea || !workspace.userId) return;
    const needsReassign = currentAreaItemCount > 0;
    const target = needsReassign
      ? deleteAreaDestinations.find(
          (candidate) =>
            candidate.spaceId === deleteAreaForm?.reassignSpaceId && candidate.areaId === deleteAreaForm?.reassignAreaId
        )
      : undefined;
    if (needsReassign && !target) {
      flash("Select a destination area before deleting");
      return;
    }
    if (
      !window.confirm(
        needsReassign
          ? `Delete "${currentArea.name}" and move its items to "${target?.areaName}"?`
          : `Delete "${currentArea.name}"?`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await workspace.actions.deleteArea({
        householdId,
        spaceId: currentSpace.id,
        areaId: currentArea.id,
        userId: workspace.userId,
        reassignTo: target
          ? { spaceId: target.spaceId, areaId: target.areaId, areaNameSnapshot: target.areaName }
          : undefined
      });
      setShowDeleteArea(false);
      setShowEditArea(false);
      navigateToSpaces(currentSpace.id);
      flash("Area deleted");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to delete area"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteSpace() {
    if (!currentSpace || !workspace.userId) return;
    const needsReassign = currentSpaceItemCount > 0;
    const target = needsReassign
      ? deleteSpaceDestinations.find(
          (candidate) =>
            candidate.spaceId === deleteSpaceForm?.reassignSpaceId && candidate.areaId === deleteSpaceForm?.reassignAreaId
        )
      : undefined;
    if (needsReassign && !target) {
      flash("Select a destination space and area before deleting");
      return;
    }
    if (
      !window.confirm(
        needsReassign
          ? `Delete "${currentSpace.name}" and move its items to "${target?.spaceName} / ${target?.areaName}"?`
          : `Delete "${currentSpace.name}"?`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await workspace.actions.deleteSpace({
        householdId,
        spaceId: currentSpace.id,
        userId: workspace.userId,
        reassignTo: target
          ? { spaceId: target.spaceId, areaId: target.areaId, areaNameSnapshot: target.areaName }
          : undefined
      });
      setShowDeleteSpace(false);
      setShowEditSpace(false);
      navigateToSpaces();
      flash("Space deleted");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to delete space"));
    } finally {
      setSaving(false);
    }
  }

  async function shareQrLink() {
    if (!showQrForSpaceId) return;
    const url = `${window.location.origin}/spaces/${showQrForSpaceId}`;
    try {
      if (!navigator.share) {
        await copyText(url, "Space link copied");
        return;
      }
      await navigator.share({ title: "Stow space link", url });
    } catch {
      // User cancel/no-op.
    }
  }

  function downloadQrPng() {
    if (!qrImageUrl || !showQrForSpaceId) return;
    const anchor = document.createElement("a");
    anchor.href = qrImageUrl;
    anchor.download = `stow-space-${showQrForSpaceId}.png`;
    anchor.click();
  }

  function printQrLabel() {
    if (!qrImageUrl || !showQrForSpaceId) return;
    const space = spaces.find((candidate) => candidate.id === showQrForSpaceId);
    const url = `${window.location.origin}/spaces/${showQrForSpaceId}`;
    const popup = window.open("", "_blank", "noopener,noreferrer,width=420,height=560");
    if (!popup) {
      flash("Allow pop-ups to print the label");
      return;
    }
    popup.document.write(`<!doctype html>
<html>
  <head>
    <title>Stow Space Label</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; color: #111; }
      .card { border: 2px solid #111; border-radius: 16px; padding: 20px; text-align: center; }
      h1 { margin: 0 0 10px; font-size: 22px; }
      p { margin: 8px 0 0; font-size: 12px; word-break: break-word; }
      img { width: 240px; height: 240px; display: block; margin: 12px auto; }
      @media print { body { padding: 0; } .card { border-radius: 0; min-height: 100vh; box-sizing: border-box; } }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${(space?.name || "Stow Space").replace(/[<>&]/g, "")}</h1>
      <img alt="QR code" src="${qrImageUrl}" />
      <p>${url.replace(/[<>&]/g, "")}</p>
    </div>
    <script>window.onload = () => setTimeout(() => window.print(), 100);</script>
  </body>
</html>`);
    popup.document.close();
  }

  async function applyBulkPacking(nextValue: boolean, targetItems = packingItems) {
    if (!workspace.userId) return;
    if (!targetItems.length) {
      flash("No visible items");
      return;
    }
    setBulkPackingWorking(true);
    try {
      await Promise.all(
        targetItems.map((item) =>
          workspace.actions.togglePacked({
            householdId,
            itemId: item.id,
            userId: workspace.userId!,
            nextValue
          })
        )
      );
      flash(nextValue ? "Marked visible items packed" : "Marked visible items unpacked");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed bulk update"));
    } finally {
      setBulkPackingWorking(false);
    }
  }

  function toggleSearchTag(tag: string) {
    const exists = searchTagFilters.some((value) => value.toLowerCase() === tag.toLowerCase());
    const next = exists
      ? searchTagFilters.filter((value) => value.toLowerCase() !== tag.toLowerCase())
      : [...searchTagFilters, tag];
    updateCurrentQuery({ tag: next }, { replace: true });
  }

  async function saveLlmSettings() {
    setLlmSaveWorking(true);
    try {
      const { saveHouseholdLlmConfig, setHouseholdLlmSecret } = await loadFirebaseFunctionsModule();
      await saveHouseholdLlmConfig({ householdId, config: llmForm });
      if (llmSecretInput.trim()) {
        await setHouseholdLlmSecret({ householdId, apiKey: llmSecretInput.trim() });
        setLlmSecretInput("");
      }
      flash("LLM settings saved");
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to save LLM settings"));
    } finally {
      setLlmSaveWorking(false);
    }
  }

  async function validateLlmSettings() {
    setLlmValidateWorking(true);
    try {
      const { validateHouseholdLlmConfig } = await loadFirebaseFunctionsModule();
      const result = await validateHouseholdLlmConfig({ householdId });
      flash(result.message || (result.ok ? "LLM config validated" : "LLM validation failed"));
    } catch (error) {
      flash(toLoggedUserErrorMessage(error, "Failed to validate LLM settings"));
    } finally {
      setLlmValidateWorking(false);
    }
  }

  const spaceNameById = useMemo(() => Object.fromEntries(spaces.map((space) => [space.id, space.name])), [spaces]);

  const activeScreen = () => {
    if (tab === "search") {
      const searchAreaOptions = searchSpaceFilter
        ? spaces.find((space) => space.id === searchSpaceFilter)?.areas ?? []
        : [];
      const emptyStateItems = items.slice(0, 10);
      return (
        <div className="screen" style={{ padding: 0 }}>
          <div className="tab-header tab-header-sticky">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: P.ink }}>Search</h1>
              <StatusPill color={syncText === "Live" ? "success" : syncText === "Offline" ? "warn" : "default"}>
                {syncText}
              </StatusPill>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="search-input-wrap">
                <Search size={16} />
                <input
                  className="input"
                  value={searchQuery}
                  onChange={(e) => updateCurrentQuery({ q: e.target.value }, { replace: true })}
                  placeholder="Items, tags, or spaces…"
                  style={{ borderColor: searchQuery ? P.accent : undefined }}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => updateCurrentQuery({ q: null }, { replace: true })}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className="view-toggle"
                onClick={() => updateCurrentQuery({ view: gridView ? "list" : "grid" }, { replace: true })}
                aria-label={gridView ? "Switch to list view" : "Switch to grid view"}
                aria-pressed={gridView}
              >
                {gridView ? <List size={16} /> : <Grid size={16} />}
              </button>
            </div>
            <div className="search-filter-row">
              <Select
                value={searchSpaceFilter}
                onChange={(e) =>
                  updateCurrentQuery({ spaceId: e.target.value || null, areaId: null }, { replace: true })
                }
              >
                <option value="">All spaces</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </Select>
              <Select
                value={searchAreaFilter}
                onChange={(e) => updateCurrentQuery({ areaId: e.target.value || null }, { replace: true })}
                disabled={!searchSpaceFilter}
              >
                <option value="">All areas</option>
                {searchAreaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="search-filter-row compact">
              <Select
                value={searchPackedFilter}
                onChange={(e) => updateCurrentQuery({ packed: e.target.value === "all" ? null : e.target.value }, { replace: true })}
              >
                <option value="all">Packed: All</option>
                <option value="no">Packed: No</option>
                <option value="yes">Packed: Yes</option>
              </Select>
              <Select
                value={searchKindFilter}
                onChange={(e) => updateCurrentQuery({ kind: e.target.value === "all" ? null : e.target.value }, { replace: true })}
              >
                <option value="all">Type: All</option>
                <option value="item">Items</option>
                <option value="folder">Folders</option>
              </Select>
              <button
                type="button"
                className={`packing-pill ${searchHasPhoto ? "active" : "inactive"}`}
                onClick={() => updateCurrentQuery({ hasPhoto: searchHasPhoto ? null : "1" }, { replace: true })}
              >
                Has Photo
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
            {showCollectionLoadWarning ? <div className="banner error inline-error">{normalizedWorkspaceError}</div> : null}
            {hasSearchFilters ? (
              <div className="stack-sm" style={{ marginBottom: 16 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="section-label" style={{ margin: 0 }}>
                    Results ({searchedItems.length})
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setUrlSearchParams(new URLSearchParams(gridView ? [["view", "grid"]] : []), { replace: true });
                    }}
                  >
                    Clear all
                  </button>
                </div>
                {(searchTagFilters.length || searchSpaceFilter || searchAreaFilter || searchPackedFilter !== "all" || searchKindFilter !== "all" || searchHasPhoto) ? (
                  <div className="search-tags">
                    {searchTagFilters.map((tag) => (
                      <button key={tag} className="search-tag-btn" onClick={() => toggleSearchTag(tag)}>
                        #{tag} <X size={12} />
                      </button>
                    ))}
                    {searchSpaceFilter ? (
                      <button className="search-tag-btn" onClick={() => updateCurrentQuery({ spaceId: null, areaId: null }, { replace: true })}>
                        {spaceNameById[searchSpaceFilter]} <X size={12} />
                      </button>
                    ) : null}
                    {searchAreaFilter ? (
                      <button className="search-tag-btn" onClick={() => updateCurrentQuery({ areaId: null }, { replace: true })}>
                        Area filter <X size={12} />
                      </button>
                    ) : null}
                    {searchHasPhoto ? (
                      <button className="search-tag-btn" onClick={() => updateCurrentQuery({ hasPhoto: null }, { replace: true })}>
                        Has photo <X size={12} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {!hasSearchFilters ? (
              <div>
                {recentSearches.length ? (
                  <>
                    <div className="section-label">Recent Searches</div>
                    <div className="search-tags">
                      {recentSearches.map((value) => (
                        <button key={value} className="search-tag-btn" onClick={() => updateCurrentQuery({ q: value }, { replace: true })}>
                          {value}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                <div className="section-label">Quick Filters</div>
                <div className="search-tags">
                  <button className="search-tag-btn" onClick={() => updateCurrentQuery({ packed: "no" }, { replace: true })}>Unpacked</button>
                  <button className="search-tag-btn" onClick={() => updateCurrentQuery({ hasPhoto: "1" }, { replace: true })}>Has Photo</button>
                  <button className="search-tag-btn" onClick={() => updateCurrentQuery({ kind: "folder" }, { replace: true })}>Folders</button>
                </div>
                <div className="section-label">Popular Tags</div>
                <div className="search-tags">
                  {allTags.map((t) => (
                    <button key={t} className="search-tag-btn" onClick={() => toggleSearchTag(t)}>#{t}</button>
                  ))}
                </div>
                <div className="section-label">Recent Items ({emptyStateItems.length})</div>
                <div className="list">
                  {emptyStateItems.map((item) => (
                    <button key={item.id} className="list-row" onClick={() => navigateToItem(item.id)}>
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
                <div className="empty-sub">Try clearing one or more filters</div>
              </div>
            ) : !gridView ? (
              <div className="list">
                {searchedItems.map((item) => (
                  <div key={item.id} className="list-row">
                    <div className="thumb">
                      {item.image?.downloadUrl ? <img src={item.image.downloadUrl} alt="" /> : <Inbox size={16} color={P.border} />}
                    </div>
                    <button className="pack-item-open grow" onClick={() => navigateToItem(item.id)}>
                      <div className="row-title">{item.name}</div>
                      <div className="row-sub">{spaceNameById[item.spaceId]} · {item.areaNameSnapshot}</div>
                    </button>
                    <button
                      type="button"
                      className={`pack-check ${item.isPacked ? "checked" : ""}`}
                      onClick={() => {
                        if (!workspace.userId) return;
                        void workspace.actions
                          .togglePacked({ householdId, itemId: item.id, userId: workspace.userId, nextValue: !item.isPacked })
                          .catch((error) => flash(toLoggedUserErrorMessage(error, "Failed to update item")));
                      }}
                      aria-label={`${item.isPacked ? "Unpack" : "Pack"} ${item.name}`}
                    >
                      {item.isPacked ? <CheckCircle size={18} strokeWidth={2.2} /> : <div className="pack-check-circle" style={{ width: 18, height: 18 }} />}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="search-grid">
                {searchedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="search-grid-item"
                    onClick={() => navigateToItem(item.id)}
                    aria-label={`Open item ${item.name}`}
                  >
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
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (tab === "packing") {
      const packingAreaOptions = packingSpaceFilter
        ? spaces.find((space) => space.id === packingSpaceFilter)?.areas ?? []
        : [];
      return (
        <div className="screen" style={{ padding: 0 }}>
          <div className="tab-header" style={{ borderBottom: `1px solid ${P.borderL}` }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: P.ink }}>Packing</h1>
              <StatusPill color={syncText === "Live" ? "success" : syncText === "Offline" ? "warn" : "default"}>
                {syncText}
              </StatusPill>
            </div>
            <div className="packing-pills">
              <button
                type="button"
                className={`packing-pill ${packingShow === "unpacked" ? "active" : "inactive"}`}
                onClick={() => updateCurrentQuery({ show: null }, { replace: true })}
              >
                Unpacked
              </button>
              <button
                type="button"
                className={`packing-pill ${packingShow === "packed" ? "active" : "inactive"}`}
                onClick={() => updateCurrentQuery({ show: "packed" }, { replace: true })}
              >
                Packed <span className="count">{packedItems.length}</span>
              </button>
              <button
                type="button"
                className={`packing-pill ${packingShow === "all" ? "active" : "inactive"}`}
                onClick={() => updateCurrentQuery({ show: "all" }, { replace: true })}
              >
                All
              </button>
            </div>
            <div className="search-filter-row">
              <Select
                value={packingSpaceFilter}
                onChange={(e) => updateCurrentQuery({ spaceId: e.target.value || null, areaId: null }, { replace: true })}
              >
                <option value="">All spaces</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>{space.name}</option>
                ))}
              </Select>
              <Select
                value={packingAreaFilter}
                disabled={!packingSpaceFilter}
                onChange={(e) => updateCurrentQuery({ areaId: e.target.value || null }, { replace: true })}
              >
                <option value="">All areas</option>
                {packingAreaOptions.map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </Select>
            </div>
            <div className="search-filter-row compact">
              <Select
                value={packingKindFilter}
                onChange={(e) => updateCurrentQuery({ kind: e.target.value === "all" ? null : e.target.value }, { replace: true })}
              >
                <option value="all">Type: All</option>
                <option value="item">Items</option>
                <option value="folder">Folders</option>
              </Select>
              <Select
                value={packingGroupBy}
                onChange={(e) => updateCurrentQuery({ groupBy: e.target.value === "location" ? null : e.target.value }, { replace: true })}
              >
                <option value="location">Group: Location</option>
                <option value="none">Group: None</option>
              </Select>
              <Select
                value={packingSort}
                onChange={(e) => updateCurrentQuery({ sort: e.target.value === "location" ? null : e.target.value }, { replace: true })}
              >
                <option value="location">Sort: Location</option>
                <option value="recent">Sort: Recent</option>
                <option value="value">Sort: Value</option>
              </Select>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px" }}>
            {showCollectionLoadWarning ? <div className="banner error inline-error">{normalizedWorkspaceError}</div> : null}
            <div className="progress-card">
              <div className="progress-label">
                <span>Pack Progress</span>
                <span>{packedItems.length} of {items.length} total</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${items.length ? Math.min((packedItems.length / items.length) * 100, 100) : 0}%` }} />
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 12, fontSize: 12 }}>
                <span>{packingItems.length} visible item{packingItems.length !== 1 ? "s" : ""}</span>
                <span>{packingItems.filter((item) => item.isPacked).length} packed in view</span>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button className="btn" disabled={bulkPackingWorking || !packingItems.length} onClick={() => void applyBulkPacking(true)}>
                Mark visible packed
              </button>
              <button className="btn" disabled={bulkPackingWorking || !packingItems.length} onClick={() => void applyBulkPacking(false)}>
                Mark visible unpacked
              </button>
              <button
                className="btn"
                disabled={
                  bulkPackingWorking ||
                  !items.some(
                    (item) =>
                      item.isPacked &&
                      (!packingSpaceFilter || item.spaceId === packingSpaceFilter) &&
                      (!packingAreaFilter || item.areaId === packingAreaFilter) &&
                      (packingKindFilter === "all" || item.kind === packingKindFilter)
                  )
                }
                onClick={() => {
                  updateCurrentQuery({ show: "packed" }, { replace: true });
                  void applyBulkPacking(
                    false,
                    items.filter(
                      (item) =>
                        item.isPacked &&
                        (!packingSpaceFilter || item.spaceId === packingSpaceFilter) &&
                        (!packingAreaFilter || item.areaId === packingAreaFilter) &&
                        (packingKindFilter === "all" || item.kind === packingKindFilter)
                    )
                  );
                }}
              >
                Clear packed
              </button>
            </div>
            {packingItems.length > 0 && packingItems.every((item) => item.isPacked) ? (
              <div className="banner ok inline-error">Done packing this view.</div>
            ) : null}
            {packingItems.length === 0 ? (
              <div className="empty-state">
                <Package size={32} color={P.border} className="empty-icon" />
                <div className="empty-title">No items in this view</div>
                <div className="empty-sub">Adjust filters or packing status to see items.</div>
              </div>
            ) : (
              <div className="stack">
                {packingGroups.map((group) => (
                  <div key={group.key} className="stack-sm">
                    {packingGroupBy === "location" ? <div className="section-label" style={{ marginBottom: 2 }}>{group.label}</div> : null}
                    <div className="list">
                      {group.items.map((item) => (
                        <div key={item.id} className="packing-item">
                          <button
                            type="button"
                            className={`pack-check ${item.isPacked ? "checked" : ""}`}
                            aria-pressed={item.isPacked}
                            aria-label={`${item.isPacked ? "Unpack" : "Pack"} ${item.name}`}
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
                                .catch((error) => flash(toLoggedUserErrorMessage(error, "Failed to update packing status")));
                            }}
                          >
                            {item.isPacked ? <CheckCircle size={22} strokeWidth={2.5} /> : <div className="pack-check-circle" />}
                          </button>
                          <button
                            type="button"
                            className="pack-item-open grow"
                            style={{ opacity: item.isPacked ? 0.35 : 1, transition: "opacity 0.3s" }}
                            onClick={() => navigateToItem(item.id)}
                            aria-label={`Open item details for ${item.name}`}
                          >
                            <div className="row-title" style={{ textDecoration: item.isPacked ? "line-through" : "none" }}>{item.name}</div>
                            <div className="row-sub">{spaceNameById[item.spaceId]} · {item.areaNameSnapshot}</div>
                          </button>
                          {item.image?.downloadUrl ? (
                            <img src={item.image.downloadUrl} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", marginRight: 4, opacity: item.isPacked ? 0.25 : 1, filter: item.isPacked ? "grayscale(1)" : "none" }} />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (tab === "settings") {
      return (
        <div className="screen" style={{ padding: 0, overflowY: "auto", paddingBottom: 120 }}>
          <div className="tab-header">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: P.ink }}>Settings</h1>
              <StatusPill color={syncText === "Live" ? "success" : syncText === "Offline" ? "warn" : "default"}>
                {syncText}
              </StatusPill>
            </div>
          </div>
          <div style={{ padding: "20px 20px 0" }}>

          {isAdmin ? (
            <section className="panel section">
              <div className="section-title"><Home size={16} /> Household</div>
              <div className="stack-sm">
                <Field label="Household name">
                  <TextInput value={householdNameInput} onChange={(e) => setHouseholdNameInput(e.target.value)} />
                </Field>
                <button className="btn" disabled={householdSaveWorking || !householdNameInput.trim()} onClick={() => void saveHouseholdName()}>
                  {householdSaveWorking ? "Saving…" : "Save Household Name"}
                </button>
              </div>
            </section>
          ) : null}

          <section className="panel section">
            <div className="section-title"><Users size={16} /> Household Members</div>
            <div className="stack-sm">
              {members.map((member) => (
                <div key={member.uid} className="row" style={{ alignItems: "flex-start" }}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row-title">{member.displayName || member.email || member.uid}</div>
                    <div className="row-sub">{member.email || "No email"}</div>
                  </div>
                  {isAdmin ? (
                    <div className="stack-sm" style={{ alignItems: "flex-end", minWidth: 132 }}>
                      <Select
                        value={member.role}
                        disabled={
                          memberActionWorkingUid === member.uid ||
                          (!isOwner && member.role === "OWNER") ||
                          (member.uid === user.uid && member.role === "OWNER" && ownerCount <= 1)
                        }
                        onChange={(e) => void updateMemberRoleAction(member.uid, e.target.value as Role)}
                      >
                        {isOwner ? <option value="OWNER">Owner</option> : null}
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                      </Select>
                      <button
                        className="btn danger"
                        disabled={
                          memberActionWorkingUid === member.uid ||
                          member.uid === user.uid ||
                          (member.role === "OWNER" && ownerCount <= 1) ||
                          (!isOwner && member.role === "OWNER")
                        }
                        onClick={() => void removeMemberAction(member.uid)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <StatusPill color="default">{member.role}</StatusPill>
                  )}
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
                      <button className="btn" onClick={() => void copyInviteLinkToClipboard()}>
                        Copy Invite Link
                      </button>
                    </div>
                  ) : null}
                  <div className="section-label" style={{ marginTop: 4 }}>Active Invites ({activeInvites.length})</div>
                  {activeInvites.length ? (
                    <div className="stack-sm">
                      {activeInvites.map((invite) => {
                        const expiresLabel = formatTimestamp(invite.expiresAt) ?? "Unknown";
                        const createdByLabel = memberNameByUid[invite.createdBy] || invite.createdBy || "Unknown";
                        const busy = inviteActionWorkingId === invite.id;
                        return (
                          <div key={invite.id} className="panel section" style={{ padding: 10 }}>
                            <div className="row" style={{ alignItems: "flex-start" }}>
                              <div className="grow">
                                <div className="row-title">{invite.role} invite</div>
                                <div className="row-sub">Created by {createdByLabel} · Expires {expiresLabel}</div>
                                {!invite.token ? <div className="muted">Legacy invite: regenerate to copy a fresh link.</div> : null}
                              </div>
                              <StatusPill color="default">{invite.role}</StatusPill>
                            </div>
                            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              <button className="btn" disabled={busy || !invite.token} onClick={() => void copyInviteFromRow(invite.id)}>
                                Copy Link
                              </button>
                              <button className="btn" disabled={busy || inviteWorking} onClick={() => void regenerateInvite(invite.id, invite.role)}>
                                Regenerate
                              </button>
                              <button className="btn danger" disabled={busy} onClick={() => void revokeInviteRow(invite.id)}>
                                Revoke
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="muted">No active invites.</div>
                  )}
                </>
              ) : (
                <div className="muted">Only owners/admins can create invites.</div>
              )}
            </div>
          </section>

          {isAdmin ? (
          <section className="panel section">
            <div className="section-title"><KeyRound size={16} /> AI Item Recognition (Advanced)</div>
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
              <div className="row llm-actions">
                <button className="btn primary" disabled={llmSaveWorking} onClick={() => void saveLlmSettings()}>
                  {llmSaveWorking ? "Saving…" : "Save LLM Settings"}
                </button>
                <button className="btn" disabled={llmValidateWorking} onClick={() => void validateLlmSettings()}>
                  {llmValidateWorking ? "Validating…" : "Test Connection"}
                </button>
              </div>
            </div>
          </section>
          ) : null}

          <section className="panel section">
            <div className="section-title"><Settings size={16} /> Personal Preferences</div>
            <div className="stack-sm">
              <div className="row">
                <div className="grow">
                  <div className="row-title">Default Search View</div>
                  <div className="row-sub">Current preference is saved when you switch list/grid in Search.</div>
                </div>
                <StatusPill color="default">{gridView ? "Grid" : "List"}</StatusPill>
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
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1>Stow<span className="dot">.</span></h1>
                <p className="subtitle">{items.length} items across {spaces.length} spaces</p>
              </div>
              <div className="row gap-sm">
                <StatusPill color={syncText === "Live" ? "success" : syncText === "Offline" ? "warn" : "default"}>
                  {syncText}
                </StatusPill>
                <button className="btn" onClick={() => setShowAddSpace(true)}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>
          {normalizedWorkspaceError ? <div className="banner error" style={{ margin: "0 24px" }}>{normalizedWorkspaceError}</div> : null}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 120px" }}>
            <div style={{ height: 16 }} />
            <div className="section-label">Your Spaces</div>
            <div className="space-list-card">
              {spaces.map((space) => {
                const count = itemsBySpace.get(space.id)?.length ?? 0;
                const Icon = iconForSpace(space.icon);
                return (
                  <button
                    key={space.id}
                    className="space-list-row"
                    onClick={() => navigateToSpaces(space.id)}
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
                navigateToSpaces(selectedSpaceId, null, new URLSearchParams([["spaceView", "items"]]));
              } else {
                navigateToSpaces();
              }
            }}
          >
            <ChevronLeft size={20} strokeWidth={2.5} /> {selectedAreaId ? currentSpace?.name : "Spaces"}
          </button>
          <h2>{selectedAreaId ? currentArea?.name ?? "Area" : currentSpace?.name ?? "Space"}</h2>
          <div className="row gap-sm">
            <StatusPill color={syncText === "Live" ? "success" : syncText === "Offline" ? "warn" : "default"}>
              {syncText}
            </StatusPill>
            {!selectedAreaId ? (
              <>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowEditSpace(true)}
                  aria-label="Edit space"
                >
                  <Edit size={16} color={P.inkMuted} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowQrForSpaceId(selectedSpaceId)}
                  aria-label="Show QR code for this space"
                >
                  <QrCode size={18} color={P.inkMuted} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => updateCurrentQuery({ spaceView: spacesContentView === "areas" ? "items" : null }, { replace: true })}
                  aria-label={spacesContentView === "areas" ? "Show items list" : "Show areas grid"}
                  aria-pressed={spacesContentView !== "areas"}
                >
                  {spacesContentView === "areas" ? <List size={16} color={P.inkMuted} /> : <Grid size={16} color={P.inkMuted} />}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowEditArea(true)}
                aria-label="Edit area"
              >
                <MoreHorizontal size={16} color={P.inkMuted} />
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "16px 16px 0" }}>
        {!selectedAreaId && spacesContentView === "areas" ? (
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
                  <button key={area.id} className="area-card" onClick={() => navigateToSpaces(selectedSpaceId, area.id, new URLSearchParams([["spaceView", "items"]]))}>
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
        {!selectedAreaId && spacesContentView === "items" ? (
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="section-label" style={{ margin: 0 }}>Items in {currentSpace?.name}</div>
            <button className="btn" onClick={() => updateCurrentQuery({ spaceView: null }, { replace: true })}>
              View Areas
            </button>
          </div>
        ) : null}
        </div>

        {(selectedAreaId || spacesContentView === "items") ? (
          <div style={{ padding: "0 16px 10px" }}>
            <div className="search-filter-row compact">
              <Select
                value={spaceItemsPackedFilter}
                onChange={(e) => updateCurrentQuery({ spacePacked: e.target.value === "all" ? null : e.target.value }, { replace: true })}
              >
                <option value="all">Status: All</option>
                <option value="unpacked">Status: Unpacked</option>
                <option value="packed">Status: Packed</option>
              </Select>
              <Select
                value={spaceItemsKindFilter}
                onChange={(e) => updateCurrentQuery({ spaceKind: e.target.value === "all" ? null : e.target.value }, { replace: true })}
              >
                <option value="all">Type: All</option>
                <option value="item">Items</option>
                <option value="folder">Folders</option>
              </Select>
              <Select
                value={spaceItemsSort}
                onChange={(e) => updateCurrentQuery({ spaceSort: e.target.value === "recent" ? null : e.target.value }, { replace: true })}
              >
                <option value="recent">Sort: Recent</option>
                <option value="name">Sort: Name</option>
                <option value="value">Sort: Value</option>
              </Select>
              <button
                type="button"
                className="btn"
                onClick={() => updateCurrentQuery({ spacePacked: null, spaceKind: null, spaceSort: null }, { replace: true })}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {(selectedAreaId || spacesContentView === "items") ? (
        <div className="list" style={{ padding: "0 16px" }}>
          {filteredSpaceItems.map((item) => (
            <button key={item.id} className="list-row" onClick={() => navigateToItem(item.id)} style={selectedAreaId ? { borderRadius: 18, padding: 12, gap: 14 } : undefined}>
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
        ) : null}

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
          <button
            type="button"
            className={`fab ${fabOpen ? "rotated" : ""}`}
            onClick={() => setFabOpen(!fabOpen)}
            aria-label={fabOpen ? "Close add menu" : "Open add menu"}
            aria-expanded={fabOpen}
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <div className={`phone-frame ${selectedItemId ? "item-detail-open" : ""}`}>
        {activeScreen()}

        <nav className="bottom-nav">
          <NavButton
            active={tab === "spaces"}
            label="Spaces"
            icon={Home}
            onClick={() => navigateToTab("spaces")}
          />
          <NavButton active={tab === "search"} label="Search" icon={Search} onClick={() => navigateToTab("search")} />
          <NavButton active={tab === "packing"} label="Packing" icon={Package} badge={packedItems.length || undefined} onClick={() => navigateToTab("packing")} />
          <NavButton active={tab === "settings"} label="Settings" icon={Settings} onClick={() => navigateToTab("settings")} />
        </nav>

        <Modal open={showAddSpace} title="New Space" onClose={() => setShowAddSpace(false)}>
          <form className="stack" onSubmit={(e) => void submitAddSpace(e)}>
            <Field label="Space name *">
              <TextInput value={addSpaceForm.name} onChange={(e) => setAddSpaceForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </Field>
            <Field label="Icon">
              <Select
                value={addSpaceForm.icon}
                onChange={(e) => setAddSpaceForm((prev) => ({ ...prev, icon: e.target.value as SpaceIcon }))}
              >
                <option value="box">Box</option>
                <option value="home">Home</option>
                <option value="folder">Folder</option>
                <option value="briefcase">Briefcase</option>
                <option value="coffee">Coffee</option>
              </Select>
            </Field>
            <Field label="Color">
              <div className="row" style={{ alignItems: "stretch" }}>
                <input
                  type="color"
                  value={addSpaceForm.color}
                  onChange={(e) => setAddSpaceForm((prev) => ({ ...prev, color: e.target.value }))}
                  aria-label="Pick space color"
                  style={{ width: 52, borderRadius: 12, border: `1px solid ${P.border}`, background: "transparent" }}
                />
                <TextInput value={addSpaceForm.color} onChange={(e) => setAddSpaceForm((prev) => ({ ...prev, color: e.target.value }))} />
                <button type="button" className="btn" onClick={() => setAddSpaceForm((prev) => ({ ...prev, color: randomColor() }))}>Random</button>
              </div>
            </Field>
            <Field label="Areas">
              <StringListEditor
                values={addSpaceForm.areaNames}
                onChange={(areaNames) => setAddSpaceForm((prev) => ({ ...prev, areaNames }))}
                placeholder="Area"
              />
            </Field>
            <ImagePicker
              label="Space photo"
              imageUrl={addSpaceForm.imageUrl}
              imageFile={addSpaceForm.imageFile}
              onImageUrlChange={(value) => setAddSpaceForm((prev) => ({ ...prev, imageUrl: value }))}
              onFileChange={(file) => setAddSpaceForm((prev) => ({ ...prev, imageFile: file }))}
              disabled={!online}
              helperText={!online ? "Photo uploads require an internet connection. You can still create the space without a photo." : undefined}
            />
            <button className="btn primary sticky-submit" disabled={saving || !addSpaceForm.name.trim()}>
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
              imageFile={addAreaForm.imageFile}
              onImageUrlChange={(value) => setAddAreaForm((prev) => ({ ...prev, imageUrl: value }))}
              onFileChange={(file) => setAddAreaForm((prev) => ({ ...prev, imageFile: file }))}
              disabled={!online}
              helperText={!online ? "Photo uploads require internet. Add a photo later if needed." : undefined}
            />
            <button className="btn primary sticky-submit" disabled={saving || !addAreaForm.name.trim() || !selectedSpaceId}>
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
            <Field label="Tags">
              <ChipInput
                value={addItemForm.tags}
                onChange={(value) => setAddItemForm((prev) => ({ ...prev, tags: value }))}
                suggestions={allTags}
                placeholder="Type a tag and press Enter"
              />
            </Field>
            <Field label="Notes">
              <TextArea rows={3} value={addItemForm.notes} onChange={(e) => setAddItemForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </Field>
            <ImagePicker
              label="Photo"
              imageUrl={addItemForm.imageUrl}
              imageFile={addItemForm.imageFile}
              onImageUrlChange={(value) => setAddItemForm((prev) => ({ ...prev, imageUrl: value }))}
              onFileChange={(file) => setAddItemForm((prev) => ({ ...prev, imageFile: file }))}
              disabled={!online}
              helperText={!online ? "Photo uploads require internet. Save the item first and add a photo later." : undefined}
            />
            {!currentAreaForAddItem ? <div className="field-help">Select a valid space and area.</div> : null}
            <button className="btn primary sticky-submit" disabled={saving || !addItemForm.name.trim() || !currentAreaForAddItem}>
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
              imageFile={visionDraft.imageFile}
              onImageUrlChange={(value) => setVisionDraft((prev) => ({ ...prev, imageUrl: value }))}
              onFileChange={(file) => setVisionDraft((prev) => ({ ...prev, imageFile: file }))}
              disabled={!online}
              helperText={!online ? "Vision scan requires an internet connection." : undefined}
            />
            <button className="btn primary" disabled={visionWorking || !online} onClick={() => void runVisionCategorize()}>
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
                  <ChipInput value={visionDraft.tagsCsv} onChange={(value) => setVisionDraft((prev) => ({ ...prev, tagsCsv: value }))} suggestions={allTags} placeholder="Type tag and press Enter" />
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
            <div className="row" style={{ flexWrap: "wrap", justifyContent: "center" }}>
              <button className="btn" onClick={() => void copyText(`${window.location.origin}/spaces/${showQrForSpaceId}`, "Space link copied")}>
                Copy Link
              </button>
              <button className="btn" onClick={() => void shareQrLink()}>
                <Share2 size={14} /> Share
              </button>
              <button className="btn" disabled={!qrImageUrl} onClick={() => downloadQrPng()}>
                <Download size={14} /> Download PNG
              </button>
              <button className="btn" disabled={!qrImageUrl} onClick={() => printQrLabel()}>
                Print Label
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={showEditSpace && Boolean(currentSpace) && Boolean(editSpaceForm)} title="Edit Space" onClose={() => setShowEditSpace(false)}>
          {editSpaceForm ? (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); void saveEditedSpace(); }}>
              <Field label="Space name">
                <TextInput value={editSpaceForm.name} onChange={(e) => setEditSpaceForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
              </Field>
              <Field label="Icon">
                <Select value={editSpaceForm.icon} onChange={(e) => setEditSpaceForm((prev) => prev ? { ...prev, icon: e.target.value as SpaceIcon } : prev)}>
                  <option value="box">Box</option>
                  <option value="home">Home</option>
                  <option value="folder">Folder</option>
                  <option value="briefcase">Briefcase</option>
                  <option value="coffee">Coffee</option>
                </Select>
              </Field>
              <Field label="Color">
                <div className="row">
                  <input type="color" value={editSpaceForm.color} onChange={(e) => setEditSpaceForm((prev) => prev ? { ...prev, color: e.target.value } : prev)} />
                  <TextInput value={editSpaceForm.color} onChange={(e) => setEditSpaceForm((prev) => prev ? { ...prev, color: e.target.value } : prev)} />
                </div>
              </Field>
              <ImagePicker
                label="Space photo"
                imageUrl={editSpaceForm.imageUrl}
                imageFile={editSpaceForm.imageFile}
                onImageUrlChange={(value) => setEditSpaceForm((prev) => prev ? { ...prev, imageUrl: value } : prev)}
                onFileChange={(file) => setEditSpaceForm((prev) => prev ? { ...prev, imageFile: file } : prev)}
                disabled={!online}
                helperText={!online ? "Photo uploads require internet. Other space changes can still be saved." : undefined}
              />
              <button className="btn primary sticky-submit" disabled={saving || !editSpaceForm.name.trim()}>
                {saving ? "Saving…" : "Save Space"}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={spaces.length <= 1}
                onClick={() => setShowDeleteSpace(true)}
                title={spaces.length <= 1 ? "Create another space before deleting the last one" : undefined}
              >
                Delete Space
              </button>
            </form>
          ) : null}
        </Modal>

        <Modal open={showEditArea && Boolean(currentArea) && Boolean(editAreaForm)} title="Edit Area" onClose={() => setShowEditArea(false)}>
          {editAreaForm ? (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); void saveEditedArea(); }}>
              <Field label="Area name">
                <TextInput value={editAreaForm.name} onChange={(e) => setEditAreaForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
              </Field>
              <ImagePicker
                label="Area photo"
                imageUrl={editAreaForm.imageUrl}
                imageFile={editAreaForm.imageFile}
                onImageUrlChange={(value) => setEditAreaForm((prev) => prev ? { ...prev, imageUrl: value } : prev)}
                onFileChange={(file) => setEditAreaForm((prev) => prev ? { ...prev, imageFile: file } : prev)}
                disabled={!online}
                helperText={!online ? "Photo uploads require internet. Other area changes can still be saved." : undefined}
              />
              <button className="btn primary sticky-submit" disabled={saving || !editAreaForm.name.trim()}>
                {saving ? "Saving…" : "Save Area"}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={(currentSpace?.areas.length ?? 0) <= 1 && currentAreaItemCount > 0 && deleteAreaDestinations.length === 0}
                onClick={() => setShowDeleteArea(true)}
              >
                Delete Area
              </button>
            </form>
          ) : null}
        </Modal>

        <Modal open={showDeleteArea && Boolean(currentArea)} title="Delete Area" onClose={() => setShowDeleteArea(false)}>
          <div className="stack">
            <p className="muted">
              {currentAreaItemCount > 0
                ? `This area contains ${currentAreaItemCount} item${currentAreaItemCount === 1 ? "" : "s"}. Choose a destination before deleting.`
                : "This area is empty and can be deleted now."}
            </p>
            {currentAreaItemCount > 0 ? (
              <>
                {deleteAreaDestinations.length === 0 ? (
                  <div className="banner error inline-error">No destination area available. Create another area first.</div>
                ) : (
                  <>
                    <Field label="Move items to space">
                      <Select
                        value={deleteAreaForm?.reassignSpaceId || ""}
                        onChange={(e) => {
                          const nextSpaceId = e.target.value;
                          const nextArea = deleteAreaDestinations.find((d) => d.spaceId === nextSpaceId);
                          setDeleteAreaForm(nextArea ? { reassignSpaceId: nextSpaceId, reassignAreaId: nextArea.areaId } : { reassignSpaceId: nextSpaceId, reassignAreaId: "" });
                        }}
                      >
                        {[...new Set(deleteAreaDestinations.map((d) => d.spaceId))].map((spaceId) => (
                          <option key={spaceId} value={spaceId}>{spaceNameById[spaceId]}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Move items to area">
                      <Select
                        value={deleteAreaForm?.reassignAreaId || ""}
                        onChange={(e) => setDeleteAreaForm((prev) => prev ? { ...prev, reassignAreaId: e.target.value } : prev)}
                      >
                        {deleteAreaDestinations
                          .filter((d) => d.spaceId === (deleteAreaForm?.reassignSpaceId || deleteAreaDestinations[0]?.spaceId))
                          .map((d) => (
                            <option key={`${d.spaceId}:${d.areaId}`} value={d.areaId}>{d.areaName}</option>
                          ))}
                      </Select>
                    </Field>
                  </>
                )}
              </>
            ) : null}
            <div className="row">
              <button className="btn" onClick={() => setShowDeleteArea(false)}>Cancel</button>
              <button
                className="btn danger"
                disabled={saving || (currentAreaItemCount > 0 && deleteAreaDestinations.length === 0)}
                onClick={() => void confirmDeleteArea()}
              >
                {saving ? "Deleting…" : "Delete Area"}
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={showDeleteSpace && Boolean(currentSpace)} title="Delete Space" onClose={() => setShowDeleteSpace(false)}>
          <div className="stack">
            <p className="muted">
              {currentSpaceItemCount > 0
                ? `This space contains ${currentSpaceItemCount} item${currentSpaceItemCount === 1 ? "" : "s"}. Reassign items before deleting.`
                : "This space is empty and can be deleted now."}
            </p>
            {currentSpaceItemCount > 0 ? (
              <>
                {deleteSpaceDestinations.length === 0 ? (
                  <div className="banner error inline-error">No destination space/area available. Create another space with an area first.</div>
                ) : (
                  <>
                    <Field label="Move items to space">
                      <Select
                        value={deleteSpaceForm?.reassignSpaceId || ""}
                        onChange={(e) => {
                          const nextSpaceId = e.target.value;
                          const nextArea = deleteSpaceDestinations.find((d) => d.spaceId === nextSpaceId);
                          setDeleteSpaceForm(nextArea ? { reassignSpaceId: nextSpaceId, reassignAreaId: nextArea.areaId } : { reassignSpaceId: nextSpaceId, reassignAreaId: "" });
                        }}
                      >
                        {[...new Set(deleteSpaceDestinations.map((d) => d.spaceId))].map((spaceId) => (
                          <option key={spaceId} value={spaceId}>{spaceNameById[spaceId]}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Move items to area">
                      <Select
                        value={deleteSpaceForm?.reassignAreaId || ""}
                        onChange={(e) => setDeleteSpaceForm((prev) => prev ? { ...prev, reassignAreaId: e.target.value } : prev)}
                      >
                        {deleteSpaceDestinations
                          .filter((d) => d.spaceId === (deleteSpaceForm?.reassignSpaceId || deleteSpaceDestinations[0]?.spaceId))
                          .map((d) => (
                            <option key={`${d.spaceId}:${d.areaId}`} value={d.areaId}>{d.areaName}</option>
                          ))}
                      </Select>
                    </Field>
                  </>
                )}
              </>
            ) : null}
            <div className="row">
              <button className="btn" onClick={() => setShowDeleteSpace(false)}>Cancel</button>
              <button
                className="btn danger"
                disabled={saving || spaces.length <= 1 || (currentSpaceItemCount > 0 && deleteSpaceDestinations.length === 0)}
                onClick={() => void confirmDeleteSpace()}
              >
                {saving ? "Deleting…" : "Delete Space"}
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={showMoveItem && Boolean(selectedItem) && Boolean(moveItemForm)} title="Move Item" onClose={() => setShowMoveItem(false)}>
          {moveItemForm ? (
            <div className="stack">
              <p className="muted">Move this item to a different space or area. Review before saving.</p>
              <div className="row two-col">
                <Field label="Destination Space">
                  <Select
                    value={moveItemForm.spaceId}
                    onChange={(e) => {
                      const nextSpaceId = e.target.value;
                      const nextAreaId = spaces.find((space) => space.id === nextSpaceId)?.areas[0]?.id ?? "";
                      setMoveItemForm((prev) => prev ? { ...prev, spaceId: nextSpaceId, areaId: nextAreaId } : prev);
                    }}
                  >
                    {spaces.map((space) => (
                      <option key={space.id} value={space.id}>{space.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Destination Area">
                  <Select value={moveItemForm.areaId} onChange={(e) => setMoveItemForm((prev) => prev ? { ...prev, areaId: e.target.value } : prev)}>
                    {(spaces.find((space) => space.id === moveItemForm.spaceId)?.areas ?? []).map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Location update note (optional)">
                <TextArea rows={3} value={moveItemForm.note} onChange={(e) => setMoveItemForm((prev) => prev ? { ...prev, note: e.target.value } : prev)} placeholder="e.g., Moved before trip" />
              </Field>
              <button className="btn primary sticky-submit" disabled={saving} onClick={() => void saveMovedItem()}>
                {saving ? "Moving…" : "Move Item"}
              </button>
            </div>
          ) : null}
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
                <button
                  type="button"
                  className={`hero-btn ${selectedItem.image?.downloadUrl ? "on-image" : "on-plain"}`}
                  onClick={() => { setEditing(false); closeItemDetail(); }}
                  aria-label="Back to list"
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  {!editing ? (
                    <button
                      type="button"
                      className={`hero-btn ${selectedItem.image?.downloadUrl ? "on-image" : "on-plain"}`}
                      onClick={() => setEditing(true)}
                      aria-label="Edit item"
                    >
                      <Edit size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`hero-btn ${selectedItem.image?.downloadUrl ? "on-image" : "on-plain"}`}
                    onClick={() => setDelConfirm(selectedItem.id)}
                    aria-label="Delete item"
                  >
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
                  <ImagePicker
                    label="Photo"
                    imageUrl={editItemForm.imageUrl}
                    imageFile={editItemForm.imageFile}
                    onImageUrlChange={(v) => setEditItemForm((prev) => prev ? { ...prev, imageUrl: v } : prev)}
                    onFileChange={(f) => setEditItemForm((prev) => prev ? { ...prev, imageFile: f } : prev)}
                    disabled={!online}
                    helperText={!online ? "Photo uploads require internet. You can still edit text fields and location." : undefined}
                  />
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
                    <ChipInput
                      value={editItemForm.tags}
                      onChange={(value) => setEditItemForm((prev) => prev ? { ...prev, tags: value } : prev)}
                      suggestions={allTags}
                      placeholder="Type tag and press Enter"
                    />
                  </Field>
                  <Field label="Notes">
                    <TextArea rows={3} value={editItemForm.notes} onChange={(e) => setEditItemForm((prev) => prev ? { ...prev, notes: e.target.value } : prev)} placeholder="Serial number, purchase info..." />
                  </Field>
                  <div className="row" style={{ gap: 8, marginTop: "auto" }}>
                    <button className="btn full" style={{ flex: 1 }} disabled={saving || !editItemForm.name.trim()} onClick={() => void saveEditedItem()}>
                      <Save size={16} /> {saving ? "Saving…" : "Save"}
                    </button>
                    <button className="btn primary full" style={{ flex: 1 }} disabled={saving || !editItemForm.name.trim()} onClick={() => void saveEditedItem({ closeAfterSave: true })}>
                      {saving ? "Saving…" : "Save & Close"}
                    </button>
                  </div>
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
                      type="button"
                      className={`pack-toggle ${selectedItem.isPacked ? "packed" : "unpacked"}`}
                      aria-pressed={selectedItem.isPacked}
                      aria-label={selectedItem.isPacked ? "Remove item from packing list" : "Add item to packing list"}
                      onClick={() => {
                        if (!workspace.userId) return;
                        void workspace.actions.togglePacked({ householdId, itemId: selectedItem.id, userId: workspace.userId, nextValue: !selectedItem.isPacked })
                          .then(() => flash(selectedItem.isPacked ? "Removed from bag" : "Added to bag!"))
                          .catch((error) => flash(toLoggedUserErrorMessage(error, "Failed to update item")));
                      }}
                    >
                      <Package size={20} strokeWidth={2} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="location-card"
                    onClick={() => {
                      setEditing(false);
                      navigateToSpaces(selectedItem.spaceId, selectedItem.areaId, new URLSearchParams([["spaceView", "items"]]));
                    }}
                    style={{ textAlign: "left", cursor: "pointer", width: "100%", display: "block" }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: P.warm, marginBottom: 6 }}>Location</div>
                    <div className="location-row">
                      <MapPin size={15} color={P.accent} />
                      <span>{spaceNameById[selectedItem.spaceId]}</span>
                      <ChevronRight size={12} color={P.border} />
                      <span style={{ color: P.inkMuted }}>{selectedItem.areaNameSnapshot}</span>
                    </div>
                  </button>

                  {selectedItem.notes ? (
                    <div className="notes-card">
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: P.warm, marginBottom: 6 }}>Notes</div>
                      <p>{selectedItem.notes}</p>
                    </div>
                  ) : null}

                  {selectedItem.tags.length ? (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: P.warm, marginBottom: 6 }}>Tags</div>
                      <div className="tag-list">
                        {selectedItem.tags.map((t) => (
                          <span key={t} className="tag-chip"><Tag size={11} /> {t}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="notes-card">
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.2px", color: P.warm, marginBottom: 6 }}>Metadata</div>
                    <div className="stack-sm">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span className="muted">Created</span>
                        <span>{formatTimestamp(selectedItem.createdAt) ?? "Unknown"}</span>
                      </div>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span className="muted">Updated</span>
                        <span>{formatTimestamp(selectedItem.updatedAt) ?? "Unknown"}</span>
                      </div>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span className="muted">Added by</span>
                        <span>{selectedItem.createdBy}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    <button className="btn full" style={{ background: P.accentSoft, color: P.accent, border: `1px solid rgba(232,101,43,0.15)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setEditing(true)}>
                      <Edit size={15} /> Edit Item
                    </button>
                    <button className="btn full" style={{ background: P.canvas, color: P.ink, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setShowMoveItem(true)}>
                      <ArrowRight size={15} /> Move Item
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
                    .then(() => { setDelConfirm(null); setEditing(false); flash("Item deleted"); closeItemDetail(); })
                    .catch((error) => flash(toLoggedUserErrorMessage(error, "Failed to delete item")));
                }}>Delete</button>
              </div>
            </div>
          </div>
        ) : null}

        {toast ? <div className="toast" aria-live="polite"><div className="toast-inner">{toast}</div></div> : null}
      </div>
    </div>
  );
}
