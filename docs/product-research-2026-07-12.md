# Stow product research and opportunity roadmap

**Research date:** July 12, 2026  
**Product reviewed:** the current Stow PWA in this repository  
**Scope:** product strategy, differentiated capabilities, competitive feature analysis, UI/UX audit, growth and monetization implications, and a prioritized roadmap

## Executive summary

Stow is already more than a home-inventory database. Its strongest product idea is a **shared household memory for where things belong, where they are now, and what a household needs for a trip**. The current product connects a location-first inventory with trustworthy AI capture, QR deep links, household roles, activity, lending, lifecycle status, reusable packing lists, and real offline writes.

That combination is valuable, but the market moved quickly. In 2026, AI photo recognition, multi-item shelf capture, QR labels, family sharing, and location search are no longer unique by themselves. Cratify, StowQR, StuffID, SnapFind, Storalla, Stuffbee, and several newer entrants all advertise some version of “photograph a shelf or box, let AI identify it, and find it later.” The strongest benchmark products now add auto-cropped item thumbnails, duplicate suppression, printable label templates, arbitrary nested locations, barcode/NFC support, bulk operations, imports, granular sharing, documents, reminders, and reports.

The central recommendations are:

1. **Resolve the naming risk before investing in launch marketing.** At least two active, directly overlapping products use “Stow” or “StowQR,” including an exact-name `usestow.app` product in the same category. This is a discoverability and user-confusion risk. A formal trademark/domain/app-store clearance is warranted; this report makes no legal conclusion.
2. **Position around household memory, not generic inventory or AI.** Lead with “Find anything at home” and the living household loop: capture, find, move, lend, pack, return. Treat AI as the speed layer, not the product thesis.
3. **Make the marquee AI work immediately.** A new user currently receives AI disabled and must supply a provider, model, API key, temperature, and token limit. Offer a managed default with a small free scan allowance, then place bring-your-own-provider controls under Advanced.
4. **Make bins/areas—not just rooms—the physical QR unit.** Add QR labels for areas/containers, human-readable label designs, batch printing, Avery/Dymo templates, and “scan to add here.” The current per-space QR is too coarse for the dominant storage use case.
5. **Turn shelf capture into a durable retrieval advantage.** Save per-item crops or contextual shelf imagery, retain bounding-box metadata, and later introduce “Refresh this area”: rescan a shelf or box, compare it with the previous state, and confirm additions/removals. This addresses the category’s hardest problem—inventory decay.
6. **Consolidate search and strengthen large-inventory management.** The Home search and Search tab duplicate each other while both rely on basic substring matching. Create one global search experience with typo tolerance, filters, status/borrower awareness, bulk actions, saved views, and useful quick actions.
7. **Finish the shared-household foundation.** Add household switching, read-only/guest roles, scoped share links, truthful sync state, undo/trash, notifications for overdue loans, and a more complete activity history.
8. **Expand selectively.** Receipts, warranties, manuals, maintenance, insurance PDFs, custom fields, quantities, barcodes, and NFC are proven demand, but building the full “home operating system” now would blur Stow’s focus. Add these progressively for important items and validated segments rather than placing every field in the default item form.

The recommended near-term roadmap is therefore: **brand/positioning → activation and managed AI → area/container labels and shelf imagery → search/import/trust → collaboration and retention → selective home-documentation features**.

## Research method and limits

This assessment combines:

- A repository-level product inventory across routes, data models, capture flows, sharing, packing, status, QR, offline behavior, tests, and design documentation.
- A UI/UX inspection of the current implementation, responsive layout rules, and browser-flow coverage in the repository.
- Current market research using official product sites, official help/pricing pages, and App Store listings for direct and adjacent products.
- A small amount of qualitative review evidence to understand what users praise or struggle with. Review comments are treated as anecdotes, not representative survey data.

The market review is current as of July 12, 2026. It does not replace user interviews, product analytics, trademark counsel, pricing tests, or an accessibility audit with assistive-technology users. Recommendations below should be treated as evidence-backed hypotheses and validated through the experiments in the final sections.

## 1. Product thesis and core jobs

The repository’s approved design direction is clear: Stow is for **homeowner organization, not insurance-first documentation**. Its current hierarchy is `Household → Space → Area → Item`, and its primary experience emphasizes retrieval and exact location over monetary value.

The best target segment is:

> Busy couples, families, and shared households with belongings spread across rooms, drawers, closets, garages, workshops, and storage units—especially households that also lend gear, travel, or move items frequently.

The core jobs-to-be-done are:

- “Where did we put this?”
- “Catalog this shelf, drawer, or box without typing every item.”
- “Let everyone in the household see the same answer.”
- “What is away, lent, packed, in repair, or missing?”
- “What do we need for this trip, and is any of it unavailable?”
- “I am standing at this box or storage area—show me what is here and let me update it.”

The most promising product loop is:

`Capture → Find → Move/Lend/Pack → Return/Reconcile → Find again`

That is strategically stronger than the common category loop of `Catalog once → rarely reopen`, because the latter produces episodic usage and stale inventories.

## 2. What Stow already has

### Retrieval and organization

- Retrieval-first Home with item/space counts, recently added items, away-from-home items, and live search across item names, tags, spaces, and areas.
- Dedicated Search with all-item browsing, recent terms, popular tags, and persistent list/grid view.
- A location-first `Space → Area → Item` organization model.
- Create, rename, customize, reorder, and safely delete spaces/areas, including reassignment of contents.
- Item photos, names, locations, value/priceless metadata, tags, notes, editing, moving, and deletion.

### Capture

- Camera-first manual entry with camera/library fallbacks and review before save.
- Single-item AI capture that suggests name, tags, and notes without overwriting what the user already entered.
- Whole-shelf capture from one still image with multiple detections, bounding boxes, confidence display, a low-confidence visual treatment, least-confident-first review, rename/confirm/skip, destination selection, and batch creation.

### Physical/digital bridge

- Per-space QR generation, copy/share, PNG download, and in-app QR scanning.
- Same-origin validation and fallback decoding/pasted-link paths.
- Deep links to locations and items.

### Household and retention

- Shared households with OWNER, ADMIN, and MEMBER roles; invites; role management; and last-owner protections.
- Activity feed with actors, relative times, and item/space deep links.
- Item lifecycle states: At home, Packed, Lent out, In repair, and Missing.
- Lending to a household member or external person, including due date and note.
- An Away from home strip that surfaces non-home items.
- Independent reusable packing lists with progress and checklist completion.

### Trust and infrastructure

- Installable PWA with an offline shell, update prompts, and iOS install guidance.
- Persistent multi-tab Firestore cache and optimistic inventory writes that continue offline.
- Provider-agnostic AI architecture across Gemini, Anthropic, and OpenAI-compatible endpoints.
- Owner-controlled provider credentials stored server-side with encryption and rate limiting.
- Household-scoped image processing, MIME/size/timeout enforcement, image downscaling, and server-authored vision job records.
- CSV export.

## 3. What is genuinely differentiated

“Unique” should be used carefully. Several competitors now claim capabilities that looked novel a year ago. The defensible answer is a mix of **rare individual details** and a **differentiated bundle**.

### Strongest differentiators

1. **Confidence-first whole-shelf review.** Stow does not blindly dump detections into the inventory. It shows spatial detections and reviews the least-certain results first. That is a more honest and trustworthy interaction than generic “AI did it” messaging.
2. **Three separate answers to three separate questions.** Stow distinguishes an item’s permanent home, its current lifecycle state, and whether it is checked off in a particular packing list. That supports “where it belongs,” “where it is now,” and “did we pack it?” without collapsing them into one boolean.
3. **Inventory-backed packing plus lifecycle awareness.** Packing lists reuse canonical household items rather than creating disconnected checklist text. When extended with availability warnings, this can become a meaningful moat.
4. **Household lending integrated into the home inventory.** Borrower, due date, status, Away strip, and activity are part of the same object model.
5. **Advanced user control of AI.** Multi-provider bring-your-own-key support, encrypted secret storage, provider testing, and explicit model settings are unusually capable for a consumer product. They are a technical differentiator, though the current UI turns that strength into first-run friction.
6. **Real offline writes in a cross-platform PWA.** The product is not merely installable; its core inventory mutations use persistent local state and later synchronization.

### The differentiated bundle

No benchmark reviewed presented exactly Stow’s combination of:

- trusted multi-item shelf review;
- exact household location;
- real-time roles and activity;
- offline writes;
- item status and lending;
- reusable packing lists tied to canonical items; and
- user-controlled AI providers.

Cratify is now the closest feature-shape competitor because it combines bulk AI, QR boxes, granular sharing, people/borrowing, collections that can become packing lists, and reports. This makes execution, trust, and product clarity more important than a feature-count claim.

### Valuable but no longer differentiating

The following are now table stakes or rapidly becoming table stakes:

- Item photos, tags, notes, location breadcrumbs, and cloud sync.
- Search across rooms/containers/items.
- QR codes and printable labels.
- Single-photo AI identification.
- Multi-item shelf/box recognition.
- Family or team sharing.
- CSV export.
- Offline access.

Stow should maintain these well, but should not build its marketing story around having them.

## 4. Competitive landscape

### Direct AI + storage/QR products

| Product | Positioning and notable patterns | What Stow should learn |
|---|---|---|
| **Cratify** | Locations → rooms → boxes → items; single and bulk AI; QR labels; lock-screen scans; people/borrowing; granular read/edit sharing; collections that export as packing lists; PDF/CSV insurance exports; free tier with 250 items and 50 AI scans/month. | Closest functional threat. Match container-level labels, granular sharing, bulk intake, and clean activation. Differentiate through trusted review, offline reliability, lifecycle readiness, and reconciliation. |
| **StowQR** | One-photo multi-item AI with automatic item thumbnails and duplicate suppression; highly customized QR labels; standard/Avery printing; places and totes; family sync; CSV; native iOS polish. $3.99/month, $29.99/year, or $99.99 lifetime. | Auto-crops, deduplication, label printing, human-readable label identity, and native-feeling performance are strong benchmarks. |
| **Stow (`usestow.app`)** | An exact-name competitor advertising homes, spaces, arbitrarily nested bins, QR scanning, offline access, shared households, batch label templates, bulk operations, custom fields, multi-format export, and insurance reports. $4.99/month Premium. | Creates an urgent naming/discoverability problem and establishes nested containers, bulk labels, import/export, and multiple homes as direct comparison points. |
| **StuffID** | AI detects one or many items from a shelf, drawer, or pile; categories; search; batch scanning; photo-library import; device-first privacy messaging. | Photo-library bulk intake and explicit privacy copy reduce setup and trust friction. |
| **SnapFind** | AI recognition, QR labels on containers, search by name/photo, values, tags, locations, and CSV. Its App Store listing shows meaningful rating volume. | Image-based lookup and focused container workflows can be more legible than an abstract room-first model. |
| **Storalla** | “GPS for your belongings”; photo/item/box capture; location and tags; QR codes; shared codes; quantity extraction; CSV/Excel import; $49.99/year. | Import is both an activation feature and a switching feature. “Give it a home” is clearer language than abstract inventory terminology. |
| **Stuffbee** | On-device shelf/room scanning, smart collections, insights, export, and explicit keep/sell/donate/recycle dispositions. | Decluttering actions can provide retention and an outcome beyond cataloging, but they should remain optional for Stow. |
| **SnapSort AI** | Background AI photo tagging; nested locations; QR-linked boxes; borrowing; family/team collaboration; offline scanning/viewing; a demo workspace before signup. Its model uses free item/AI allowances plus paid credits and optional physical labels rather than a required subscription. | Background processing, a generous demo, credit-based hosted AI, and label revenue are credible patterns. Reviews asking for clone/multi-select moves and better quantity handling reinforce the need for bulk operations. |

### Flexible inventory products

| Product | Positioning and notable patterns | What Stow should learn |
|---|---|---|
| **additem.to** | Nested locations; AI fills brand/model/category/custom fields; NFC, QR, and barcodes; quantities; filters; activity history; lending; PDF reports; CSV import/export; item templates; offline local mode; role-controlled cloud sharing. | This is the best benchmark for power features without forcing every user into an enterprise product. Add progressive metadata, imports, multiple scan types, templates, and full history. |
| **Sortly** | Deep folders, photos, custom fields, quantities, low-stock/date alerts, QR/barcode label generation, check-in/out, pick lists, roles, reports, integrations, imports, and offline access. Business pricing starts well above consumer apps. | Borrow patterns such as bulk operations, pick lists, alerts, and reports, but avoid its business-heavy complexity and pricing logic. |
| **Collection & Inventory Tracker** | Arbitrary collections, customizable field types, barcode/QR, offline-first optional sync, CSV/Excel import/export, bulk edit, and viewer/editor sharing. | Bulk edit and custom schemas matter to collectors, but Stow should gate them behind item templates or advanced views. |
| **ToteScan** | A dedicated physical-label ecosystem, fast retrieval, collaboration, PDF/CSV export, and Alexa support. | Physical label reliability and voice retrieval are product surfaces, not ancillary settings. |

### Home-management and documentation products

| Product | Positioning and notable patterns | What Stow should learn |
|---|---|---|
| **Itemtopia** | Items linked to receipts, warranties, manuals, serials, service history, reminders, reports, shareable web pages, and AI question-answering; offline and multi-platform. | Documentation becomes valuable when attached to the object. Add it progressively for appliances/valuables instead of making every item record heavy. |
| **Homer** | Photo recognition extracts model/serial and finds manuals/warranties; also adds maintenance, floor plans, timeline, tasks, expenses, contacts, and an AI home copilot. | There is demand for a “digital home binder,” but competing head-on would dilute Stow’s location/household wedge. |
| **HomeZada** | Inventory, maintenance schedules, remodel projects, and home finances in one suite. | A warning as much as a benchmark: breadth can feel heavy when the user only wants to find something. |
| **Under My Roof** | Voice quick entry, barcode/text/document/3D scanning, receipts and warranties, maintenance history, disposal, moving boxes, insurance, estate planning, custom fields, and iCloud-based privacy. | Voice entry, document capture, moving workflows, and data privacy are validated opportunities; the exhaustive field model is not a good default for Stow. |
| **NAIC Home Inventory** | Trusted free tool with room/category capture, photos, barcode scans, export, disaster preparation, and claims guidance. | Insurance functionality is easy to compare and hard to differentiate. Keep export/document readiness available without making it the main story. |

### The real substitutes

Stow also competes with Photos, Notes, Reminders, Calendar, Google Sheets, Drive, shared albums, a label maker, and memory. These are free, familiar, interoperable, and already installed. Their weakness is fragmentation; their strength is that they do not ask the user to maintain another system.

That means Stow must consistently save more effort than it creates. Fast capture alone is insufficient if location changes are hard to record or the inventory becomes stale.

## 5. Strategic market conclusions

### 5.1 AI shelf scanning is an activation tool, not a moat by itself

Multiple current products advertise single-photo multi-item recognition. Stow’s advantage must be the **quality of review, correction, and ongoing maintenance**. The important questions are not merely “Did AI detect objects?” but:

- Did it create useful names and images?
- Did the user understand uncertainty?
- Can the household correct it in seconds?
- Can Stow keep that record accurate after objects move?
- Does the captured record make later retrieval measurably faster?

### 5.2 Container labels are the category’s clearest physical behavior

Users understand “put a label on this box and scan it.” Current Stow QR codes point to an entire space, which is often a room. The dominant competitive pattern assigns codes to the smallest useful container: box, tote, drawer, shelf, cupboard, or individual asset.

### 5.3 Inventory decay is the unclaimed problem

Competitors optimize initial cataloging. The deeper problem is that a household moves, consumes, lends, packs, donates, and replaces things. Once the inventory is wrong, trust collapses. Stow’s statuses, activity, lending, and packing provide the beginnings of an answer. A “Refresh this area” reconciliation workflow could turn that foundation into a genuine product moat.

### 5.4 Recurring value must come from household events

Pure home inventory is episodic—often created for moving, insurance, or a one-time garage project. Stow should create recurring utility through:

- finding and returning items;
- lending and due reminders;
- trip/kit readiness;
- space refreshes;
- household change awareness; and
- quick “Do we already own this?” checks while shopping.

### 5.5 Privacy, portability, and offline behavior are product features

A home inventory reveals possessions, location, household members, travel kits, and potentially valuables. Users need plain-language answers about image processing, AI providers, retention, access removal, export, deletion, and offline behavior. CSV export is a start, but full backups and clear privacy controls will materially affect trust.

### 5.6 Consumer pricing has a visible anchor

Direct consumer products cluster around roughly **$3.99–$4.99/month or $30–$50/year**, often with a free allowance and sometimes a lifetime purchase. Stow should not promise unlimited managed AI in a lifetime plan because inference has an ongoing cost. A lifetime or one-time option is safer when heavy users bring their own key or receive a defined scan allowance.

## 6. Product integrity issues to fix before adding breadth

These are not speculative feature ideas. They are current product contradictions or broken expectations that can undermine trust.

| Priority | Issue | User impact | Recommendation |
|---|---|---|---|
| P0 | **Area renames leave item location snapshots stale.** Item detail, search, packing, and CSV can continue showing the old area name. | A “where is it?” product can give two answers for the same location. | Cascade area renames to affected items transactionally, or resolve display names from the live area record and retain the snapshot only as historical fallback. |
| P0 | **The invite UI offers OWNER while the backend rejects owner invites.** Admins can also see role choices they cannot grant. | A primary household-management action fails after confirmation. | Derive allowed roles from the current actor and validate in the UI before submitting. Add an explicit ownership-transfer workflow instead of owner invite links. |
| P0 | **Whole Shelf is visible for providers that do not support it.** Only the Gemini adapter currently implements shelf detection. | The marquee feature produces an “unsupported” error for valid configurations. | Add provider capability metadata, hide/disable unavailable modes with a clear explanation, and test the chosen provider during setup. |
| P0 | **Accepting an invite replaces the current household without a switcher.** | A user can effectively lose in-product access to a household they still own or belong to. | Model user memberships explicitly, add a household switcher and “leave household,” and make invite acceptance choose whether to switch now. |
| P0 | **Sync messaging is not truthful.** The data layer knows cache/pending state, while Settings always says “Synced just now.” | False reassurance is dangerous in an offline inventory product. | Display Saved on this device, Waiting to sync, Synced, and Needs attention based on real state. Store a real last-success timestamp. |
| P1 | **Whole-shelf items lose their imagery.** The source frame is deleted and committed items receive no crop/photo. | A visual capture workflow creates text-only records, weakening later recognition and search. | Crop each detected object on-device and save it as the item thumbnail; optionally retain one compressed context image with bounding-box metadata. |
| P1 | **Packing diverges from its intended design.** Import-from-list, per-row removal, URL-addressable lists, and no-badge behavior are missing; an aggregate unpacked badge remains. | Lists are harder to reuse/share, and the global badge lacks a clear meaning. | Complete the intended flows and make active list IDs deep-linkable. Only show a badge for a dated/active kit, if at all. |
| P1 | **“Packed” means two things.** An item can have lifecycle status Packed while separately being checked in one or more packing lists. | Users can reasonably assume a checklist action changed physical status. | Keep list state as “Ready” or “Checked,” and reserve lifecycle status for At home, Lent, Repair, or Missing. If Packed remains, explain it as “physically away” and offer an explicit trip-start transition. |
| P1 | **Loan due dates do not create an action loop.** | A date is collected but mostly becomes a subtle color change. | Show Due today/Overdue by N days, add Mark returned, and send opt-in push/email reminders. |
| P1 | **The installed PWA is portrait-locked.** | Shelf, room, and box capture often benefits from landscape, and tablets lose flexibility. | Remove the portrait lock unless camera testing proves it essential. Support both orientations in capture and review. |

Evidence locations include `src/features/stow/services/repository.ts`, `src/features/stow/ui/mobile/screens/SettingsScreen.tsx`, `functions/src/shared/schemas.ts`, `functions/src/invites.ts`, `src/features/stow/ui/mobile/capture/QuickCapture.tsx`, `src/features/stow/ui/mobile/screens/PackingScreen.tsx`, `src/features/stow/hooks/useWorkspaceData.ts`, and `public/manifest.webmanifest`.

## 7. Recommended product strategy

### Positioning statement

> For shared households that lose track of things across rooms, bins, trips, and borrowers, Stow is the household memory that builds a searchable map from a photo and keeps each item’s location and availability current. Unlike static inventory databases, it connects finding, lending, packing, returning, and household activity.

### Messaging hierarchy

1. **Find anything at home.**
2. **Photograph a shelf or box; review; done.**
3. **Know what is home, lent, packed, in repair, or missing.**
4. **Share one reliable answer with the household—even offline.**
5. **Add QR labels when physical storage needs them.**

Use “home inventory app” in SEO/store metadata because users search for it, but do not make “inventory” the emotional headline. The outcome is less rummaging, fewer duplicates, and less household mental load.

### Recommended product pillars

- **Find:** fast search, exact breadcrumbs, visual context, QR/NFC/barcode lookup.
- **Stow:** low-friction capture, destination-first workflows, background processing, reconciliation.
- **Track:** home/away/borrowed/repair/missing, item history, household activity.
- **Prepare:** reusable kits and packing lists that understand availability.
- **Trust:** offline behavior, clear sync, privacy, export, proof documents, undo/history.

## 8. Prioritized roadmap

Effort is relative to the current codebase: **S** is a focused change, **M** is a multi-surface feature, **L** requires significant data/UI work, and **XL** changes a core model or platform strategy.

### Now: launch readiness and activation

| Recommendation | Impact | Effort | Why now |
|---|---:|---:|---|
| Complete naming/domain/app-store/trademark clearance | Critical | S–M | Exact and near-exact direct competitors already exist. Do this before paid acquisition or broad brand investment. |
| Fix the P0 integrity issues in section 6 | Critical | M | Location, invitation, provider, household access, and sync contradictions damage trust in core flows. |
| Managed AI default with a free allowance; BYO provider under Advanced | High | M | The marquee capture feature should work during onboarding, not after technical configuration. |
| Goal-based activation wizard and first-value walkthrough | High | M | Current generic starter rooms create structure but do not teach the user how Stow solves their specific problem. |
| Area/container QR codes and basic printable label sheets | High | M | Container labels are the clearest physical behavior and a direct market baseline. |
| Save object crops/context from shelf capture | High | M | Converts an impressive demo into durable, visual records and unlocks a visual locator later. |
| CSV import with field mapping and preview | High | M | Reduces switching cost and lets serious users adopt without retyping an existing spreadsheet. |
| Truthful sync center and full account/data export | High | M | Offline and data ownership are trust promises, not technical details. |
| Consolidate duplicate search surfaces | High | M | Avoids two different search experiences and frees a primary navigation slot. |
| Undo toast plus soft-delete trash | High | M | Shared real-time editing makes irreversible deletion disproportionately risky. |

### Next: make the core loop meaningfully better than competitors

| Recommendation | Impact | Effort | Product outcome |
|---|---:|---:|---|
| **Refresh this area** reconciliation scan | Very high | L–XL | Compare a new shelf/box image with the previous inventory; confirm added, removed, moved, or unchanged items. Solves inventory decay. |
| Visual locator using context photo + stored bounding box | High | L | Search can show not only the room/bin but where the item appeared within the shelf image. |
| Fuzzy, faceted search plus bulk actions | High | L | Typos, filters, complete result counts, multi-select move/tag/status/archive, and saved views make large inventories usable. |
| Complete Kits/Packing readiness | High | M–L | Show lent/lost/repair items as unavailable; add quantities, duplication, members, dates, scan-to-pack, prior-list suggestions, and post-trip return. |
| Household switcher, multiple homes, and scoped sharing | High | L | Supports second homes, storage units, relatives, roommates, and professional organizers without overwriting context. |
| Read-only/guest/child roles and temporary links | High | L | Collaboration becomes safer and more useful for movers, guests, contractors, and extended family. |
| Item and location history | Medium-high | M | Answers “who moved it?” and “where was it?” and provides a better recovery path than global activity alone. |
| Loan reminders and return workflow | Medium-high | M | Turns an already differentiated feature into recurring value. |
| Multi-photo items, duplicate detection, and quantity/merge | High | L | Improves capture quality and handles legitimate multiples without dozens of near-identical rows. |
| Barcode and OCR capture | Medium-high | L | Autofill brand/model/serial and provide instant lookup for products and appliances. |
| Background capture queue | High | L | Let users keep taking photos while uploads and AI run; make progress resumable and visible. |
| Tablet/desktop management mode | Medium-high | L | Use a two-pane layout for imports, bulk editing, labels, settings, and inventory review while retaining phone-first capture. |

### Later: selective expansion, not a generic home suite

| Recommendation | Impact | Effort | Guardrail |
|---|---:|---:|---|
| Optional Proof & documents section | High for valuables/appliances | L | Receipts, warranty, manual, serial, purchase details, condition, appraisal; keep collapsed by default. |
| Insurance/estate PDF and completeness score | Medium-high | M–L | Useful secondary outcome; do not imply claim acceptance or reposition the whole app around insurance. |
| Item-specific maintenance and service history | Medium | L | Fits tools/appliances and Repair status; avoid general home-project/finance scope. |
| Inventory-grounded assistant | Medium | L | Cite real records; no unsourced home advice; require confirmation before changes. |
| NFC and platform shortcuts/share-sheet capture | Medium | M–L | Build after the label identity and capture routing are stable. |
| Professional organizer tier | Potentially high revenue | XL | Requires multi-household switching, scoped permissions, client handoff, templates, and strong privacy first. |
| App Store/Play distribution wrapper | Medium | L | Test PWA install/acquisition conversion first; a thin wrapper may improve discoverability without a native rewrite. |

## 9. Signature feature opportunities

### 9.1 “Refresh this area”

This is the highest-upside product concept in the report.

1. User scans the QR on a box, drawer, or shelf.
2. Stow opens the current contents and offers **Refresh with a photo**.
3. The user takes one new picture.
4. Stow compares detections with the current area inventory and groups suggestions into Added, Possibly removed, Changed/renamed, and Uncertain.
5. The user resolves only the differences, least-confident first.
6. Stow updates the inventory and writes an area-specific change summary.

Why it matters: competitors make cataloging faster, but few address the ongoing cost of keeping the catalog true. It also reuses Stow’s current whole-shelf review, activity, statuses, and offline queue.

### 9.2 Visual locator

Retain a compressed source image or per-area context photo and the normalized bounding box for each accepted detection. A search result for “HDMI adapter” could show:

`Garage → Workbench → Top drawer` plus the drawer photo with the object region highlighted.

Provide explicit privacy/storage settings and allow users to discard context images while keeping item crops.

### 9.3 Availability-aware Kits

Evolve Packing into reusable **Kits** without losing list simplicity:

- Camping, beach, emergency bag, baby travel, tool kit, move-day essentials.
- “Ready 18/22” rather than only “checked 18/22.”
- Four unavailable items with explanations: Lent to Sam, In repair, Missing, Already assigned to another active trip.
- One-tap replacements or “bring anyway” exceptions.
- Start trip: optionally mark selected physical items away/packed.
- End trip: return checklist routes each item back to its home location.

This turns Stow’s separate location/status/list models into connected product behavior competitors will find harder to match.

### 9.4 “Do we own this?”

From the central Scan action, let a user photograph or scan a barcode while shopping. Stow searches likely matches, shows quantities and locations, and offers “Not the same item” or “Add purchase later.” This directly targets duplicate purchasing, a pain frequently mentioned in competitor reviews.

## 10. UI/UX audit

### What is already strong

- Consistent warm, mobile-first visual system with clear location emphasis.
- Safe-area handling, focused screen hierarchy, and a central capture action.
- Review-before-save AI instead of invisible automation.
- Semantic buttons and labels on many interaction surfaces, visible focus styles, reduced-motion handling, and keyboard alternatives for some reordering actions.
- Thoughtful error recovery for deleted deep links, revoked access, offline writes, and camera fallbacks.
- Confirmed reassignment for destructive location changes rather than silently orphaning items.

### Highest-priority UX improvements

#### 1. Replace the current sign-in wall with a value-and-trust entry

The unauthenticated page currently says little beyond “Sign in to open your household inventory.” Before asking for Google or email access, show:

- one crisp promise: “Find anything at home”;
- a three-step visual: Photograph → Place → Find;
- a short privacy statement, especially for home photos and AI;
- the supported platforms/offline behavior;
- Try a demo or View how it works, if feasible; and
- transparent free-plan/scan allowance information.

Add Sign in with Apple if iOS acquisition or an App Store wrapper becomes important.

#### 2. Do not silently create a generic home

The four starter spaces avoid an empty-state blocker, but they can feel like someone else’s house. Ask which goal and structure fits:

- Whole home;
- Garage/storage;
- Moving boxes;
- Travel/gear; or
- Start blank.

Let the user edit the suggested names before creation.

#### 3. Simplify AI settings radically

The main consumer surface should show:

- AI scanning: On/Off;
- remaining hosted scans or plan usage;
- a one-sentence image-processing/privacy explanation; and
- Test scan.

Place provider, model, endpoint, temperature, token count, and key under **Advanced: bring your own AI provider**. Keep advanced control as a differentiator without forcing every household to understand it.

#### 4. Rework primary navigation

Home already contains a global search, while Search is a separate tab with another input and slightly different behavior. Settings occupies a scarce primary navigation slot despite low visit frequency.

Recommended navigation:

- **Home** — Find bar, exceptions, recents, spaces.
- **Browse** — all items, filters, location tree, saved views.
- **Scan** — central action: Item, Shelf/Box, QR, Barcode, Receipt.
- **Kits** — reusable packing/readiness.
- **Household** — activity, people, loans; profile/avatar opens Settings.

This retains five clear destinations while removing duplicate search and elevating recurring household value.

#### 5. Make location language concrete

“Space” and “Area” are flexible but abstract. Use friendly default labels and examples:

- Space: Room or place — Garage, Kitchen, Storage unit.
- Area: Shelf, drawer, bin, or spot — Workbench, Tote 4, Top drawer.

Keep the internal model while allowing household-specific vocabulary later. Add QR at the Area level before undertaking arbitrary-depth nesting.

#### 6. Design for fast maintenance, not only creation

Every item row and detail view should support quick, reversible actions:

- Move;
- Mark returned/home;
- Lend;
- Add to kit;
- Archive/dispose; and
- Undo.

Avoid making users open a long editor for common state changes.

#### 7. Make search results action-oriented

Each result should show:

- thumbnail;
- full location breadcrumb;
- current state;
- borrower/due state when relevant; and
- one context action such as Move, Return, or Add to kit.

Add exhaustive result counts, fuzzy matching, filters, and a clear no-results path: Try another term, Scan a barcode/photo, or Add this item.

#### 8. Make labels a dedicated workflow

Label creation is best on a wide screen; scanning is best on a phone. Provide:

- label preview;
- page size and common templates;
- starting position on a partially used sheet;
- stable QR, human-readable short code, container name, optional color/icon;
- duplicate labels for multiple box sides;
- unassigned print-ahead codes; and
- a one-label test print.

Do not encode the current location into the permanent identity or print a location that becomes wrong when the box moves.

#### 9. Improve accessibility and adaptability

- Ship dark mode; the palette supports it but the app applies the light default only.
- Test and support 200% text rather than relying on fixed pixel font sizes.
- Audit icon-only and compact controls against a 44×44 CSS-pixel touch target.
- Do not rely on long-press as the only discoverable path; retain visible/menu alternatives.
- Ensure confidence/status meaning is not communicated by color alone.
- Test VoiceOver, TalkBack, keyboard-only, reduced motion, high contrast, landscape, and short viewports.
- Remove the fixed 440px phone frame on larger screens for workflows that benefit from width.

#### 10. Improve loading, install, and sync states

- Use skeletons or cached content during startup instead of a generic auth-style “Loading household” card.
- Delay the install prompt until after the user has created or found something; installation is not the first value moment.
- Make the iOS install hint dismissible and available later from Settings.
- Show pending image/AI/sync work in one durable queue rather than transient toasts.
- Replace the hard-coded “Synced just now” and hard-coded version presentation with real data.

## 11. Recommended first-run experience

Target: a new household should experience a genuine retrieval win in under three minutes.

1. **Promise and trust** — “Find anything at home.” Explain photo/AI handling in one sentence.
2. **Choose the job** — Home, garage/storage, moving, gear/travel, or blank.
3. **Create the first location** — Pre-fill relevant rooms and storage spots but let the user edit them before saving.
4. **Capture one useful area** — Use hosted AI credits automatically; offer shelf, one item, or manual.
5. **Review only uncertainty** — Accept confident suggestions in a grid, then focus the user on corrections.
6. **Demonstrate retrieval** — Prompt “Search for one of the items you just added.” Open the result and show its breadcrumb.
7. **Offer the physical bridge** — “Want a label for this bin?” This is optional, not required for activation.
8. **Invite and install after value** — Invite a partner/housemate, then offer home-screen installation.

Progress language can remain outcome-based: `1. Add something → 2. Find it → 3. Share the answer`.

## 12. Data model and platform recommendations

### Keep the simple model first; earn nested complexity

The current two-level location model is cognitively lighter than an arbitrary tree. Near term, treat Area as a first-class shelf/drawer/bin/spot and add labels. Later, if research shows many households need `Home → Garage → Cabinet → Drawer → Box`, migrate toward a unified `Location` tree with:

- `parentLocationId`;
- location type and display name;
- stable QR identity;
- inherited permissions;
- ordering; and
- safe subtree moves.

Do not expose arbitrary nesting merely because competitors list it; validate actual depth in household data and failed search sessions.

### Add item metadata progressively

Recommended base item:

- name, photo, location, quantity, tags, state, notes.

Optional templates or sections:

- **Appliance:** brand, model, serial, manual, warranty, service.
- **Valuable:** purchase/replacement/current value, receipt, appraisal, condition.
- **Consumable:** quantity, unit, expiry, low threshold.
- **Collection:** custom fields, provenance, rating, edition.
- **Equipment/tool:** barcode/NFC, borrower, maintenance, accessories.

This preserves a calm default while making Stow capable enough for high-value cases.

### Build a portable backup, not only CSV

Provide:

- CSV for spreadsheet use;
- PDF for human sharing;
- JSON for full-fidelity reimport;
- an optional ZIP containing images/documents plus a manifest; and
- documented deletion/account closure.

Exports should remain available on the free tier and after cancellation in read-only mode. Users are investing hours into a personal record; portability is part of the product contract.

## 13. Collaboration and trust recommendations

### Roles

Add at least:

- Owner — billing, ownership transfer, all data;
- Admin — structure, members except ownership, all inventory;
- Editor — add/update/move items and lists;
- Viewer/Guest — read-only, optionally scoped;
- Child/Helper — constrained add/check/return actions, no destructive structure changes.

Allow space/container/list-specific sharing with expiry and revocation. A moving company may need one room or packing list, not the household’s passports and valuables.

### Activity and history

Evolve the global feed into an action center:

- unread state per user;
- filters for items, locations, people, kits, and system alerts;
- item/location-specific history;
- packing, membership, rename, photo/document, and return events;
- pagination beyond the most recent 50; and
- server-authored events if history is presented as authoritative.

### Privacy

Create an understandable privacy center covering:

- what household members can see;
- what happens after removal;
- where images and metadata are stored;
- which AI provider receives a photo and for how long;
- whether images train any model;
- how bring-your-own-provider changes processing;
- how to export/delete data; and
- what remains available offline.

The BYO-provider architecture can be a powerful advanced trust story, but it should not substitute for a safe hosted default.

## 14. Monetization and distribution

### Recommended consumer structure

**Free**

- One household/home.
- A generous manual inventory allowance—ideally unlimited manual items or at least 100–250.
- Two household members so collaboration can be experienced.
- A small monthly or lifetime hosted-AI allowance.
- Basic labels and QR scanning.
- Offline access and data export.

**Household Plus: test $4.99/month or $39.99–$49.99/year**

- Unlimited items/locations and more members.
- Hosted AI allowance and background batch capture.
- Advanced label templates and batch printing.
- Multiple homes/households.
- Full history/trash, PDF/ZIP backups, and advanced search/bulk tools.
- Optional document/maintenance features.

**Organizer Pro: explore only after permissions/multi-household are mature**

- Client workspaces, templates, scoped team access, branded handoff, bulk labels, and export.
- Potentially $19–$29/month for a solo organizer, validated with interviews.

### Pricing principles

- Do not charge per family member for ordinary household use.
- Do not use a tiny 20-item trial; it does not let a user experience a real room or garage.
- Do not price aggressively per unique item; large household inventories can reach thousands.
- Keep exports and read-only access after cancellation.
- Meter the variable-cost capability—hosted AI—not the user’s ownership of their data.
- A lifetime plan can include app features plus BYO AI, with a defined hosted-AI allowance rather than unlimited inference forever.
- Physical waterproof labels or printable label packs can become optional one-time revenue.

### Distribution

The PWA provides cross-platform reach and offline deployment speed, but most direct consumer competitors acquire through app stores and native screenshots/reviews. Measure:

- visit → sign-in;
- sign-in → PWA install;
- repeat open behavior on iOS/Android;
- camera permission completion; and
- acquisition source.

If installation or trust is materially weaker on mobile web, consider a thin Capacitor/native wrapper for store distribution while retaining the shared web product. Avoid a full native rewrite until data justifies it.

## 15. Metrics and experiments

### North-star behavior

Recommended proxy:

> **Weekly households that successfully retrieve or reconcile an item**—measured by a search/QR open followed by an item open/action, or a completed area refresh.

Inventory size alone rewards setup, not value.

### Activation funnel

- Sign-in completed.
- First location customized.
- First item or shelf capture started/completed.
- Time and actions to first saved item.
- AI accept/edit/skip rate by confidence/provider.
- First search result opened.
- First QR label generated/scanned.
- First household invite sent/accepted.

### Retention and quality

- Weekly and monthly active households, not only users.
- Search result-open rate and zero-result rate.
- Items moved/returned/lent/packed per household.
- Kit created/completed/reused.
- Loan marked returned before/after reminder.
- Area refresh completion and change-confirmation rate.
- Stale-record corrections.
- Pending/offline writes and sync failures.
- AI cost, latency, duplicates, and correction rate.
- Export completion and account deletion requests.
- Accessibility task-completion rate in moderated testing.

### Highest-value experiments

1. Goal-based onboarding vs. automatic generic starter rooms.
2. Five hosted AI scans immediately vs. BYO setup first.
3. Shelf capture with saved crops/context vs. text-only output.
4. Area-level label invitation after 5 items vs. a general QR feature in Settings.
5. One unified search/Browse surface vs. separate Home and Search inputs.
6. Availability-aware kit warnings vs. plain checklist progress.
7. Loan due reminder with Mark returned vs. passive Away display.
8. Demo workspace before sign-in vs. sign-in-first.

## 16. What not to build yet

- A complete home-finance, renovation, floor-plan, or property-management suite.
- A generic AI chat assistant before search, data quality, and citations are excellent.
- Social feeds, public collections, or a resale marketplace without validated demand.
- Arbitrary custom fields in the default item form.
- Full pantry/low-stock/shopping-list behavior unless a distinct consumables segment emerges.
- Insurance-carrier integrations before Stow can generate a reliable proof-ready export.
- Deep gamification. A progress indicator for a finite organization project is useful; badges for owning/cataloging more things are not.

## 17. Recommended 90-day sequence

### Weeks 1–2: decide and repair

- Complete brand/name clearance and decide whether to retain or change the name.
- Fix area rename propagation, invite-role mismatch, provider capability gating, household switching risk, and real sync messaging.
- Define hosted AI economics and privacy policy.
- Instrument the activation funnel and AI correction metrics.

### Weeks 3–6: activation and physical bridge

- Ship goal-based onboarding and hosted scan allowance.
- Simplify AI settings; move provider controls under Advanced.
- Save shelf item crops/context.
- Add Area/container QR and a basic printable label-sheet flow.
- Consolidate Home/Search behavior and improve no-result recovery.

### Weeks 7–10: adoption and trust

- CSV import with mapping/preview.
- Soft-delete trash and Undo.
- Full export/backup center.
- Complete the intended Packing list flows and availability warnings.
- Add loan due/overdue UI and return action.

### Weeks 11–13: validate the moat

- Prototype “Refresh this area” with existing shelf detection.
- Run 8–12 moderated household tests across garage/storage, shared-home, and travel/gear users.
- Measure correction time, trust, and whether users can successfully find an item one week later.
- Decide whether the next investment is reconciliation, nested containers, or proof/documentation based on actual usage.

## 18. Source list

Primary and official sources used for the market assessment:

- [Cratify product](https://thecratesapp.com/) and [Cratify App Store listing](https://apps.apple.com/us/app/cratify-home-inventory/id6756286378)
- [StowQR product](https://stowqr.com/), [StowQR pricing](https://stowqr.com/pricing), and [StowQR App Store listing](https://apps.apple.com/us/app/stowqr-home-storage-organizer/id6756251938)
- [Stow / usestow.app](https://www.usestow.app/) and [pricing](https://www.usestow.app/pricing)
- [SnapFind App Store listing](https://apps.apple.com/us/app/snapfind-home-inventory/id6740042892)
- [SnapSort AI](https://snapsortai.com/) and [App Store listing](https://apps.apple.com/us/app/snapsort-ai-box-organizer/id6748238998)
- [StuffID App Store listing](https://apps.apple.com/gb/app/ai-home-inventory-stuffid/id6762598494)
- [Stuffbee](https://www.stuffbee.com/)
- [Storalla](https://storalla.com/)
- [additem.to](https://additem.to/)
- [Itemtopia](https://www.itemtopia.com/) and [home-inventory features](https://itemtopia.com/home-inventory-app/)
- [Homer](https://homer.co/) and [inventory features](https://homer.co/features/inventory)
- [HomeZada](https://www.homezada.com/homeowners/home-inventory)
- [Under My Roof App Store listing](https://apps.apple.com/us/app/under-my-roof-home-inventory/id1524335878)
- [Sortly features](https://www.sortly.com/features/) and [pricing](https://www.sortly.com/pricing/)
- [ToteScan](https://www.totescan.com/)
- [Collection & Inventory Tracker](https://www.collectioninventory.app/)
- [HomeBox](https://github.com/sysadminsmedia/homebox) and [label-workflow discussion](https://github.com/sysadminsmedia/homebox/discussions/53)
- [Encircle Contents](https://www.getencircle.com/solutions/contents/)
- [Packr](https://packr.app/)
- [NAIC Home Inventory](https://content.naic.org/consumer/home-inventory) and [homeowners insurance guidance](https://content.naic.org/consumer/homeowners-insurance.htm)

Key repository evidence for the current-product assessment:

- [Approved location-first product thesis](</Users/ellishuff/Coding Projects/Stow/docs/superpowers/specs/2026-06-06-stow-mobile-redesign-design.md:12>)
- [Current domain model: item location, status, loan, and packing](</Users/ellishuff/Coding Projects/Stow/src/types/domain.ts:44>)
- [Persistent offline Firestore configuration](</Users/ellishuff/Coding Projects/Stow/src/lib/firebase/client.ts:23>)
- [Retrieval-first Home and search behavior](</Users/ellishuff/Coding Projects/Stow/src/features/stow/ui/mobile/screens/HomeScreen.tsx:36>)
- [Whole-shelf confidence-first review](</Users/ellishuff/Coding Projects/Stow/src/features/stow/ui/mobile/capture/QuickCapture.tsx:612>)
- [Least-confident-first ordering and batch projection](</Users/ellishuff/Coding Projects/Stow/src/features/stow/ui/mobile/capture/captureReducer.ts:47>)
- [QR generation and sharing](</Users/ellishuff/Coding Projects/Stow/src/features/stow/ui/mobile/spaces/SpaceQrSheet.tsx:40>)
- [Lending and due-date model](</Users/ellishuff/Coding Projects/Stow/src/features/stow/ui/mobile/screens/LendingSheet.tsx:53>)
- [Packing list implementation](</Users/ellishuff/Coding Projects/Stow/src/features/stow/ui/mobile/screens/PackingScreen.tsx:188>)
- [Household roles, invites, AI controls, and export](</Users/ellishuff/Coding Projects/Stow/src/features/stow/ui/mobile/screens/SettingsScreen.tsx:546>)
- [Provider abstraction](</Users/ellishuff/Coding Projects/Stow/functions/src/providers/registry.ts:8>)
- [Vision security and server-side job handling](</Users/ellishuff/Coding Projects/Stow/functions/src/vision.ts:80>)

## Bottom line

Stow should not race to become the biggest household database. It should become the most reliable **shared memory for physical belongings**.

The winning product is the one that lets a household photograph a messy space, trust the review, find an item later, see when it is away, know whether it is available for a trip, and keep the record true when life changes. Stow already has unusually good foundations for that loop. The next work should concentrate those foundations into a sharper promise and a simpler, more durable experience.
