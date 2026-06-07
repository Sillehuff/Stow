import { useMemo, useState } from "react";
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";

export type MobileTab = "spaces" | "search" | "packing" | "settings";

export interface MobileRoute {
  tab: MobileTab;
  spaceId: string | null;
  areaId: string | null;
  itemId: string | null;
}

export type OverlayKind = "scan" | "photo" | "addItem" | "addSpace" | "addArea" | "editSpace";

export interface OverlayState {
  kind: OverlayKind | null;
  payload?: Record<string, unknown>;
}

function isTab(value: string | null): value is MobileTab {
  return value === "spaces" || value === "search" || value === "packing" || value === "settings";
}

function stripBase(pathname: string, basePath: string): string {
  if (!basePath || basePath === "/") return pathname || "/";
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || "/";
  return pathname;
}

export function parseMobileRoute(
  pathname: string,
  params: URLSearchParams,
  basePath = "/app"
): MobileRoute {
  const rel = stripBase(pathname, basePath);

  const item = matchPath("/items/:itemId", rel);
  if (item?.params.itemId) {
    const from = params.get("from");
    return {
      tab: isTab(from) ? from : "spaces",
      spaceId: params.get("spaceId"),
      areaId: params.get("areaId"),
      itemId: item.params.itemId
    };
  }

  const area = matchPath("/spaces/:spaceId/areas/:areaId", rel);
  if (area?.params.spaceId && area.params.areaId) {
    return { tab: "spaces", spaceId: area.params.spaceId, areaId: area.params.areaId, itemId: null };
  }

  const space = matchPath("/spaces/:spaceId", rel);
  if (space?.params.spaceId) {
    return { tab: "spaces", spaceId: space.params.spaceId, areaId: null, itemId: null };
  }

  if (rel === "/search") return { tab: "search", spaceId: null, areaId: null, itemId: null };
  if (rel === "/packing") return { tab: "packing", spaceId: null, areaId: null, itemId: null };
  if (rel === "/settings") return { tab: "settings", spaceId: null, areaId: null, itemId: null };
  return { tab: "spaces", spaceId: null, areaId: null, itemId: null };
}

export function buildMobilePath(
  basePath: string,
  route: {
    tab?: MobileTab;
    spaceId?: string | null;
    areaId?: string | null;
    itemId?: string | null;
  }
): string {
  const b = basePath === "/" ? "" : basePath;
  if (route.itemId) return `${b}/items/${route.itemId}`;
  if (route.spaceId && route.areaId) return `${b}/spaces/${route.spaceId}/areas/${route.areaId}`;
  if (route.spaceId) return `${b}/spaces/${route.spaceId}`;
  return `${b}/${route.tab ?? "spaces"}`;
}

export function useMobileNavigation(householdId: string, basePath = "/app") {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const route = useMemo(
    () => parseMobileRoute(location.pathname, params, basePath),
    [basePath, location.pathname, params]
  );
  const [overlay, setOverlay] = useState<OverlayState>({ kind: null });

  function navigateToTab(tab: MobileTab) {
    navigate(buildMobilePath(basePath, { tab }));
  }

  function openSpace(spaceId: string, areaId?: string | null) {
    navigate(buildMobilePath(basePath, { spaceId, areaId: areaId ?? null }));
  }

  function openItem(itemId: string) {
    const next = new URLSearchParams();
    next.set("from", route.tab);
    if (route.spaceId) next.set("spaceId", route.spaceId);
    if (route.areaId) next.set("areaId", route.areaId);
    navigate(`${buildMobilePath(basePath, { itemId })}?${next.toString()}`);
  }

  function back() {
    navigate(-1);
  }

  function openOverlay(kind: OverlayKind, payload?: Record<string, unknown>) {
    setOverlay({ kind, payload });
  }

  function closeOverlay() {
    setOverlay({ kind: null });
  }

  return {
    householdId,
    basePath,
    route,
    tab: route.tab,
    selectedSpaceId: route.spaceId,
    selectedAreaId: route.areaId,
    selectedItemId: route.itemId,
    overlay,
    navigateToTab,
    openSpace,
    openItem,
    back,
    openOverlay,
    closeOverlay
  };
}
