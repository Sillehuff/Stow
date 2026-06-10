import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { HouseholdInvite, HouseholdMember, Item, Role, SpaceWithAreas } from "@/types/domain";
import type { HouseholdLlmConfig, ProviderType } from "@/types/llm";
import { Bell, ChevronRight, Home, Sparkles, Users } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { RoleBadge } from "@/features/stow/ui/mobile/components/RoleBadge";
import { Confirm } from "@/features/stow/ui/mobile/shell/Confirm";
import { downloadInventoryCsv } from "@/features/stow/ui/mobile/screens/inventoryCsv";
import {
  createHouseholdInvite,
  removeHouseholdMember,
  revokeHouseholdInvite,
  saveHouseholdLlmConfig,
  setHouseholdLlmSecret,
  updateHouseholdMemberRole,
  validateHouseholdLlmConfig
} from "@/lib/firebase/functions";

const DEFAULT_SPACE_KEY = "stow:mobile:default-space";
const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"];
const PROVIDERS: ProviderType[] = ["gemini", "openai_compatible", "anthropic"];

export interface SettingsScreenProps {
  householdId: string;
  householdName: string;
  currentUserId: string | null;
  members: HouseholdMember[];
  invites: HouseholdInvite[];
  spaces: SpaceWithAreas[];
  items: Item[];
  llmConfig: HouseholdLlmConfig | null;
  online: boolean;
  onRenameHousehold: (name: string) => void;
  onSignOut: () => void;
  onFlash: (msg: string) => void;
}

type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  action: () => Promise<void>;
};

function readDefaultSpaceId() {
  try {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(DEFAULT_SPACE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDefaultSpaceId(spaceId: string) {
  try {
    window.localStorage.setItem(DEFAULT_SPACE_KEY, spaceId);
  } catch {
    // Storage can be unavailable in private mode; the in-session select value still works.
  }
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        color: "var(--stow-warm)",
        marginBottom: 10,
        marginLeft: 2
      }}
    >
      {children}
    </div>
  );
}

function initialsFor(member: HouseholdMember) {
  const source = (member.displayName || member.email || member.uid).trim();
  if (!source) return "?";
  if (source.includes("@")) return source.slice(0, 2).toUpperCase();
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function memberLabel(member: HouseholdMember) {
  return member.displayName || member.email || member.uid;
}

function selectStyle(extra?: CSSProperties): CSSProperties {
  return {
    borderRadius: "var(--stow-radius-input)",
    border: "1px solid var(--stow-border)",
    background: "var(--stow-canvas)",
    color: "var(--stow-ink)",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 700,
    padding: "9px 28px 9px 10px",
    outline: "none",
    ...extra
  };
}

function InlineButton({
  children,
  onClick,
  danger = false,
  disabled = false
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none",
        background: "transparent",
        color: danger ? "var(--stow-danger)" : "var(--stow-accent)",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 800,
        opacity: disabled ? 0.45 : 1,
        padding: "6px 0"
      }}
    >
      {children}
    </button>
  );
}

function PreferenceRow({
  label,
  value,
  danger = false,
  onClick,
  children
}: {
  label: string;
  value?: string;
  danger?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 18px",
        borderBottom: "1px solid var(--stow-border-l)",
        cursor: onClick ? "pointer" : "default"
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 700, color: danger ? "var(--stow-danger)" : "var(--stow-ink)" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--stow-warm)", minWidth: 0 }}>
        {children ?? (value ? <span style={{ fontSize: 14, fontWeight: 700 }}>{value}</span> : null)}
        {onClick ? <ChevronRight size={15} color="var(--stow-border)" /> : null}
      </div>
    </div>
  );
}

export function SettingsScreen(props: SettingsScreenProps) {
  const {
    householdId,
    householdName,
    currentUserId,
    members,
    invites,
    spaces,
    items,
    llmConfig,
    online,
    onRenameHousehold,
    onSignOut,
    onFlash
  } = props;

  const currentMember = useMemo(() => members.find((member) => member.uid === currentUserId) ?? null, [members, currentUserId]);
  const canManage = currentMember?.role === "OWNER" || currentMember?.role === "ADMIN";
  const ownerCount = useMemo(() => members.filter((member) => member.role === "OWNER").length, [members]);
  const pendingInvites = useMemo(() => invites.filter((invite) => !invite.acceptedAt), [invites]);

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [runningConfirm, setRunningConfirm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(householdName);
  const [provider, setProvider] = useState<ProviderType>(llmConfig?.providerType ?? "gemini");
  const [model, setModel] = useState(llmConfig?.model ?? "");
  const [baseUrl, setBaseUrl] = useState(llmConfig?.baseUrl ?? "");
  const [temperature, setTemperature] = useState(String(llmConfig?.temperature ?? 0.2));
  const [maxTokens, setMaxTokens] = useState(String(llmConfig?.maxTokens ?? 400));
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(llmConfig?.enabled ?? false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [savingAi, setSavingAi] = useState(false);
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [inviteEmail, setInviteEmail] = useState("");
  const [defaultSpaceId, setDefaultSpaceId] = useState(readDefaultSpaceId);

  useEffect(() => {
    setNameDraft(householdName);
  }, [householdName]);

  useEffect(() => {
    setProvider(llmConfig?.providerType ?? "gemini");
    setModel(llmConfig?.model ?? "");
    setBaseUrl(llmConfig?.baseUrl ?? "");
    setTemperature(String(llmConfig?.temperature ?? 0.2));
    setMaxTokens(String(llmConfig?.maxTokens ?? 400));
    setEnabled(llmConfig?.enabled ?? false);
  }, [
    llmConfig?.baseUrl,
    llmConfig?.enabled,
    llmConfig?.maxTokens,
    llmConfig?.model,
    llmConfig?.providerType,
    llmConfig?.temperature
  ]);

  useEffect(() => {
    if (!defaultSpaceId && spaces[0]) {
      setDefaultSpaceId(spaces[0].id);
    }
  }, [defaultSpaceId, spaces]);

  async function runConfirm() {
    if (!confirm || runningConfirm) return;
    setRunningConfirm(true);
    try {
      await confirm.action();
      setConfirm(null);
    } catch (error) {
      onFlash(error instanceof Error ? error.message : "Action failed");
    } finally {
      setRunningConfirm(false);
    }
  }

  function saveHouseholdName() {
    const nextName = nameDraft.trim();
    if (!nextName) {
      onFlash("Household name is required");
      return;
    }
    onRenameHousehold(nextName);
    setEditingName(false);
    onFlash("Household renamed");
  }

  async function saveAiConfig() {
    if (!canManage || savingAi) return;
    setSavingAi(true);
    try {
      await saveHouseholdLlmConfig({
        householdId,
        config: {
          providerType: provider,
          model: model.trim(),
          baseUrl: provider === "openai_compatible" ? baseUrl.trim() || undefined : undefined,
          enabled,
          promptProfile: "default_inventory",
          temperature: Number.isFinite(Number.parseFloat(temperature)) ? Number.parseFloat(temperature) : 0.2,
          maxTokens: Number.isFinite(Number.parseInt(maxTokens, 10)) ? Number.parseInt(maxTokens, 10) : 400
        }
      });
      if (apiKey.trim()) {
        await setHouseholdLlmSecret({ householdId, apiKey: apiKey.trim() });
        setApiKey("");
      }
      onFlash("AI settings saved");
    } catch (error) {
      onFlash(error instanceof Error ? error.message : "Could not save AI settings");
    } finally {
      setSavingAi(false);
    }
  }

  async function testConnection() {
    if (!canManage) return;
    setTestResult("Testing\u2026");
    try {
      const result = await validateHouseholdLlmConfig({ householdId });
      setTestResult(result.message || (result.ok ? "Connected" : "Failed"));
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : "Connection test failed");
    }
  }

  function changeRole(member: HouseholdMember, role: Role) {
    if (!canManage || member.role === role) return;
    if (member.role === "OWNER" && role !== "OWNER" && ownerCount <= 1) {
      onFlash("Promote another owner first");
      return;
    }
    const label = memberLabel(member);
    setConfirm({
      title: `Change ${label}'s role?`,
      body: `${label} will change from ${member.role.toLowerCase()} to ${role.toLowerCase()}.`,
      confirmLabel: `Change to ${role.toLowerCase()}`,
      danger: false,
      action: async () => {
        await updateHouseholdMemberRole({ householdId, uid: member.uid, role });
        onFlash("Member role updated");
      }
    });
  }

  function removeMember(member: HouseholdMember) {
    if (!canManage || member.uid === currentUserId) return;
    if (member.role === "OWNER" && ownerCount <= 1) {
      onFlash("Promote another owner first");
      return;
    }
    const label = memberLabel(member);
    setConfirm({
      title: "Remove member?",
      body: `${label} will lose access to this household. Their personal account is not deleted.`,
      confirmLabel: "Remove member",
      danger: true,
      action: async () => {
        await removeHouseholdMember({ householdId, uid: member.uid });
        onFlash("Member removed");
      }
    });
  }

  async function createInvite() {
    if (!canManage) return;
    try {
      const invite = await createHouseholdInvite({
        householdId,
        role: inviteRole,
        email: inviteEmail.trim() || undefined
      });
      setInviteEmail("");
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invite.inviteUrl);
        onFlash("Invite created and copied");
      } else {
        onFlash("Invite created");
      }
    } catch (error) {
      onFlash(error instanceof Error ? error.message : "Could not create invite");
    }
  }

  function revokeInvite(invite: HouseholdInvite) {
    if (!canManage) return;
    setConfirm({
      title: "Revoke invite?",
      body: "This invite link will stop working immediately.",
      confirmLabel: "Revoke invite",
      danger: true,
      action: async () => {
        await revokeHouseholdInvite({ householdId, inviteId: invite.id });
        onFlash("Invite revoked");
      }
    });
  }

  function regenerateInvite(invite: HouseholdInvite) {
    if (!canManage) return;
    setConfirm({
      title: "Regenerate invite?",
      body: "The current link will stop working and a new invite with the same role will be created.",
      confirmLabel: "Regenerate invite",
      danger: false,
      action: async () => {
        await revokeHouseholdInvite({ householdId, inviteId: invite.id });
        const nextInvite = await createHouseholdInvite({ householdId, role: invite.role });
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(nextInvite.inviteUrl);
        }
        onFlash("Invite regenerated");
      }
    });
  }

  function exportCsv() {
    downloadInventoryCsv(items, spaces);
    onFlash("Inventory exported");
  }

  function requestSignOut() {
    setConfirm({
      title: "Sign out?",
      body: "This device will leave the current Stow session. Synced household data stays in the account.",
      confirmLabel: "Sign out",
      danger: false,
      action: async () => {
        onSignOut();
      }
    });
  }

  function updateDefaultSpace(spaceId: string) {
    setDefaultSpaceId(spaceId);
    writeDefaultSpaceId(spaceId);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--stow-canvas)" }}>
      <div style={{ padding: "56px 24px 8px" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "var(--stow-ink)", fontFamily: "var(--stow-display)" }}>
          Settings
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 150px" }}>
        <div style={{ ...cardStyle, padding: 18, marginBottom: 22, display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              background: "color-mix(in srgb, var(--stow-accent) 12%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <Home size={22} color="var(--stow-accent)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingName ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Field label="Household name" value={nameDraft} onChange={setNameDraft} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Button onClick={saveHouseholdName} style={{ padding: "11px 0", fontSize: 14 }}>
                    Save
                  </Button>
                  <Button
                    variant="neutral"
                    onClick={() => {
                      setNameDraft(householdName);
                      setEditingName(false);
                    }}
                    style={{ padding: "11px 0", fontSize: 14 }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: "var(--stow-ink)",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {householdName}
                  </div>
                  {canManage ? <InlineButton onClick={() => setEditingName(true)}>Edit</InlineButton> : null}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--stow-warm)", marginTop: 1 }}>
                  {members.length} member{members.length === 1 ? "" : "s"}
                </div>
              </>
            )}
          </div>
        </div>

        <Label>Members</Label>
        <div style={{ ...cardStyle, overflow: "hidden", marginBottom: 22 }}>
          {members.map((member, index) => {
            const isSelf = member.uid === currentUserId;
            const isLastOwner = member.role === "OWNER" && ownerCount <= 1;
            return (
              <div
                key={member.uid}
                style={{
                  display: "grid",
                  gridTemplateColumns: "38px minmax(0, 1fr)",
                  gap: 12,
                  padding: "13px 18px",
                  borderBottom: index < members.length - 1 || canManage ? "1px solid var(--stow-border-l)" : "none"
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 99,
                    background: "color-mix(in srgb, var(--stow-accent) 14%, transparent)",
                    color: "var(--stow-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 800
                  }}
                >
                  {initialsFor(member)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 15,
                        fontWeight: 800,
                        color: "var(--stow-ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {member.displayName || member.email || member.uid}
                    </div>
                    <RoleBadge role={member.role} />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--stow-warm)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {member.email || (isSelf ? "You" : "No email")}
                  </div>
                  {canManage ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                      <select value={member.role} onChange={(event) => changeRole(member, event.target.value as Role)} style={selectStyle()}>
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      {!isSelf ? (
                        <InlineButton danger disabled={isLastOwner} onClick={() => removeMember(member)}>
                          Remove
                        </InlineButton>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {canManage ? (
            <div style={{ borderTop: members.length ? "1px solid var(--stow-border-l)" : "none" }}>
              <div style={{ padding: "15px 18px 0" }}>
                <Field
                  label="Restrict to email (optional)"
                  value={inviteEmail}
                  onChange={setInviteEmail}
                  placeholder="name@example.com"
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "15px 18px",
                  color: "var(--stow-accent)",
                  fontWeight: 800,
                  fontSize: 14
                }}
              >
                <Users size={16} color="var(--stow-accent)" />
                <span style={{ flex: 1 }}>Invite Member</span>
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Role)} style={selectStyle({ flexShrink: 0 })}>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={createInvite}
                  style={{
                    border: "none",
                    borderRadius: "var(--stow-radius-input)",
                    background: "var(--stow-accent)",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 800,
                    padding: "10px 12px",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  Create invite
                </button>
              </div>

              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 18px",
                    borderTop: "1px solid var(--stow-border-l)"
                  }}
                >
                  <Bell size={15} color="var(--stow-warm)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--stow-ink)" }}>{invite.role} invite</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--stow-warm)" }}>Pending</div>
                  </div>
                  <InlineButton onClick={() => regenerateInvite(invite)}>Regenerate</InlineButton>
                  <InlineButton danger onClick={() => revokeInvite(invite)}>
                    Revoke
                  </InlineButton>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <Label>AI Vision</Label>
        <div style={{ ...cardStyle, padding: 18, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "color-mix(in srgb, var(--stow-accent) 10%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Sparkles size={18} color="var(--stow-accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--stow-ink)" }}>Scan & Categorize</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: enabled ? "var(--stow-success)" : "var(--stow-warm)" }}>
                {enabled ? "Enabled" : "Disabled"} - {provider}
              </div>
            </div>
            <button
              type="button"
              aria-label="Toggle AI Vision"
              onClick={() => canManage && setEnabled((value) => !value)}
              disabled={!canManage}
              style={{
                width: 44,
                height: 26,
                borderRadius: 99,
                border: "none",
                background: enabled ? "var(--stow-success)" : "var(--stow-border)",
                position: "relative",
                padding: 3,
                boxSizing: "border-box",
                cursor: canManage ? "pointer" : "default",
                opacity: canManage ? 1 : 0.55,
                flexShrink: 0
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 99,
                  background: "#fff",
                  position: "absolute",
                  right: enabled ? 3 : 21,
                  top: 3,
                  transition: "right 0.16s ease"
                }}
              />
            </button>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  color: "var(--stow-warm)",
                  marginBottom: 6
                }}
              >
                Provider
              </div>
              <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderType)} disabled={!canManage} style={selectStyle({ width: "100%" })}>
                {PROVIDERS.map((nextProvider) => (
                  <option key={nextProvider} value={nextProvider}>
                    {nextProvider}
                  </option>
                ))}
              </select>
            </div>

            <Field label="Model" value={model} onChange={setModel} placeholder="gemini-1.5-flash" />
            {provider === "openai_compatible" ? <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api.example.com/v1" /> : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Temperature" type="number" value={temperature} onChange={setTemperature} />
              <Field label="Max tokens" type="number" value={maxTokens} onChange={setMaxTokens} />
            </div>
            <Field label="API key" type="password" value={apiKey} onChange={setApiKey} placeholder="Paste to update" />

            {!canManage ? (
              <div style={{ fontSize: 13, lineHeight: 1.45, color: "var(--stow-warm)", fontWeight: 600 }}>
                AI is configured by an owner/admin.
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Button onClick={saveAiConfig} disabled={!canManage || savingAi}>
                {savingAi ? "Saving\u2026" : "Save AI settings"}
              </Button>
              <Button variant="neutral" onClick={testConnection} disabled={!canManage}>
                Test connection
              </Button>
            </div>
            {testResult ? <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stow-ink-muted)" }}>{testResult}</div> : null}
          </div>
        </div>

        <Label>Preferences</Label>
        <div style={{ ...cardStyle, overflow: "hidden", marginBottom: 22 }}>
          <PreferenceRow label="Offline mode" value={online ? "Online" : "Offline"} />
          <PreferenceRow label="Default space">
            <select value={defaultSpaceId} onChange={(event) => updateDefaultSpace(event.target.value)} style={selectStyle({ maxWidth: 180 })}>
              {spaces.length === 0 ? <option value="">No spaces</option> : null}
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </PreferenceRow>
          <PreferenceRow label="Export inventory (CSV)" onClick={exportCsv} />
          <PreferenceRow label="Sign out" danger onClick={requestSignOut} />
        </div>

        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--stow-warm)" }}>
          Stow v3.1 - Synced just now
        </div>
      </div>

      <Confirm
        open={confirm != null}
        title={confirm?.title ?? ""}
        body={runningConfirm ? "Working\u2026" : confirm?.body ?? ""}
        confirmLabel={runningConfirm ? "Working\u2026" : confirm?.confirmLabel ?? ""}
        danger={confirm?.danger}
        onConfirm={runConfirm}
        onCancel={() => {
          if (!runningConfirm) setConfirm(null);
        }}
      />
    </div>
  );
}
