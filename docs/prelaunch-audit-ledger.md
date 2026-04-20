# Pre-Launch Audit Ledger

Use this ledger for every issue, improvement, and re-test outcome during launch prep.

## Run Metadata
| Field | Value |
| --- | --- |
| Repo SHA | |
| Branch | |
| Audit date | |
| Launch target | |
| Environment | emulator / prod-like |
| In-scope features | |
| Release captain | |

## Reviewer Assignments
| Role | Reviewer | Scope | Status |
| --- | --- | --- | --- |
| Release captain | | setup, gate, evidence completeness | |
| Frontend flow reviewer | | routes and UX flows | |
| Auth/rules reviewer | | Firestore/Storage/authz checks | |
| Functions/LLM reviewer | | callable functions and provider validation | |

## Command Evidence
| ID | Command | Expected | Result | Artifact | Reviewer | Timestamp |
| --- | --- | --- | --- | --- | --- | --- |
| CMD-01 | `npm run verify:local` | exit 0 | | | | |
| CMD-02 | `npm run verify:emulator` | exit 0 | | | | |
| CMD-03 | `npm run seed:qa` | seed succeeds | | | | |
| CMD-04 | `npm run e2e:open` | app loads | | | | |

## Manual Coverage
| ID | Area | Flow / Route / Function | Expected | Status | Artifact | Reviewer |
| --- | --- | --- | --- | --- | --- | --- |
| MAN-01 | Auth | `/auth/finish` | sign-in completes | | | |
| MAN-02 | Invite | `/invite` | valid invite accepted | | | |
| MAN-03 | Inventory | `/spaces` CRUD | create/edit/delete works | | | |
| MAN-04 | Search | `/search` | results/filtering correct | | | |
| MAN-05 | Packing | `/packing` | list interactions work | | | |
| MAN-06 | Settings | `/settings` invites + LLM config | admin actions behave correctly | | | |
| MAN-07 | Rules | member vs admin access | unauthorized writes blocked | | | |
| MAN-08 | Storage | household upload/read | non-member blocked | | | |
| MAN-09 | LLM | `validateHouseholdLlmConfig` | real provider passes | | | |
| MAN-10 | Vision | `visionCategorizeItemImage` | categorize flow succeeds | | | |

## Findings
| ID | Severity | Type | Surface | Repro Steps | Expected | Actual | Environment | Proof Type | Evidence | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Status Rules
- `open`: unaddressed finding
- `fixed-awaiting-retest`: change landed, must be reviewed by fresh agents
- `verified`: independently re-tested and accepted
- `reopened`: regression or incomplete fix found during re-test

## Launch Gate
| Gate | Criteria | Status | Evidence |
| --- | --- | --- | --- |
| G-01 | All automated checks pass | | |
| G-02 | Manual route coverage complete | | |
| G-03 | Auth/rules checks complete | | |
| G-04 | Vision/LLM validated or explicitly out of scope | | |
| G-05 | No open P0/P1 | | |
| G-06 | P2 waivers documented | | |

## Batch Notes
- Batch:
- Touched surfaces:
- Fresh static reviewer:
- Fresh runtime reviewer:
- Fresh `Computer Use` reviewer:
- Re-test result:
