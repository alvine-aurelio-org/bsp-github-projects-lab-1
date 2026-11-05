# Implementation and verification boundary

## Publication layout

- **Lab 1** is the recommended full-workshop starter and packages all twelve lessons, Mona's engine and images.
- **Lab 2 / Lab 3** also support optional four-step standalone starts. Their Mona caller uses a commit-pinned reusable runtime, one exercise issue and no work-item seeding. Standalone setup is included within 45 minutes; the existing full-workshop continuation remains 35 minutes per later lab.
- For all three modules, the participant creates one private template copy through the browser, creates a matching-owner Project in Step 0 and stays in the **same automatically created exercise issue**. No second learner copy is required. Someone practising only Lab 2 or 3 may choose that lab's template instead, not in addition.
- The source repositories are public so participants need no source-repository invitation. Only synthetic workshop material is published.

## Runtime

Node 24 runs on GitHub Actions with no dependency installation. `push` to main and a manual dispatch initialize/resume; `issue_comment: created` processes exact commands. Repository-level concurrency serializes state updates. Pending events may coalesce, so the engine reconciles all eligible new comments in creation order instead of trusting only the latest payload.

The engine uses bot-authored issue markers and a durable bot-authored state comment, bound to repository ID, owner, initiating learner, exercise ID and the course contract. It persists completion evidence before publishing feedback and the next lesson. Idempotent publication markers recover interrupted writes. It does not silently reset an exercise after losing or corrupting state.

V2 starts with an empty backlog-role map. At Step 1-1 the learner creates four work issues manually, then submits `/backlog #FEATURE #IMPLEMENTATION #VERIFICATION #BUG` in the same Mona thread. Native GETs validate distinct numbers and immutable IDs, matching repository, exact role titles, open non-PR state, learner authorship and creation dates. Registration and completion evidence are one durable state change; the role map cannot be rebound later. No work issue is created or edited by this command.

## Evidence classes

**Lab 1 Step 1 is mixed evidence:** the four learner-created issues' native identities, role titles and authors are checked; their Project membership and the converted announcement remain self-confirmed.

| Class               | Activities                                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self-confirmed      | Project existence/privacy/linking, cloning, item membership, draft conversion, fields, values, board, iterations, roadmap, workload, charts, status updates and export                                    |
| Repository-verified | Lab 2 native blocked_by relationship; learner PR, correct repository/head/base/branch, exact changed file/content and native closingIssuesReferences; same checked head merged into main and issue states |
| Mixed               | Lab 2 final merge is repository-verified; Project Done and Sprint 2 reassignment are self-confirmed by the completion command                                                                             |

The learner pastes the Project's address-bar URL as a new comment, without a command or editing placeholders. View suffixes and address-bar query/fragment data are normalized internally to the main Project URL. Saved-state validation remains strict. Validation checks syntax, matching owner/account type and a positive Project number **only**; it never queries Projects or infers existence from a 404. Project UI work is never described as API-verified.

All participant actions are browser-only. The PR activity uses GitHub's branch menu, pencil editor, Commit changes dialog and PR page. Export uses the browser's Downloads list; no participant editor, terminal, Git installation or spreadsheet is required. Author tooling is separate from participant instructions.

Standalone module code runs from an immutable public framework commit; caller metadata and README are read as data, never executed. Module state binds the caller repository/learner/Project roles and README hash. The two manually created work issues are identified by exact titles and native author/ID/date checks at first link submission. All later lessons stay in the same issue. Module tests cover both four-step flows, failure recovery and one-issue-only idempotency. This does not claim a native personal-Project UI rehearsal.

## Author checks

Run the portable `node --test --test-reporter=tap` suite and `node tools/verify-content.mjs` from a fresh source checkout. Tests use an in-memory GitHub API and cover all twelve steps, hostile and out-of-order commands, forged markers, identity mismatch, partial API results, native check failures and interrupted-write recovery. Tests do not stand in for a live GitHub rehearsal.

`tools/build-screenshots.mjs` downloads immutable, attributed GitHub Docs images and uses an author-only Playwright browser to render twelve navigation-overview sheets. Participant copies need none of that tooling. It preserves original files and digests for attribution and reproducibility. Images show real documented UI entry points; they are not claimed to be authenticated screenshots of a BSP tenant or proof that every latest menu was live-tested.

The daily work report records actual local test counts, hosted workflow results and any native rehearsal scope. Do not claim a private personal Project was inspected automatically or that an unperformed UI exercise passed.

## Historical v1 native bootstrap result — 2026-11-04

The scoped **v1** author probe passed with the real GitHub Actions repository token on the source's initial content commit. It verified bot-created sample issues, a durable state comment, a rendered first lesson, an idempotent rerun and the native dependency-list endpoint, then closed exactly its five probe issues. **This historical five-issue bootstrap was replaced by the one-issue v2 flow on 2026-11-05.** Zero learner steps were completed; zero Projects were created or queried.

The first probe's immediate issue-list receipt did not contain the new exercise; its original failure is retained. An exact issue GET confirmed the expected bot-created record. A reconciled rerun of the same source commit passed with no duplicated issues. This is not permission to assume every empty list is transient or to repeat a mutation blindly.

The author probe temporarily removes the canonical-source skip **in memory only**, while requiring the exact source repository to be private and not a template. It is now inert because the published source is public and marked as a template. It is not a native template-copy event or a full participant UI/PR/merge rehearsal. Those boundaries and the actual run URLs are in the [daily work report](daily%20work%20report/2026-11-04.md).

## V2 compatibility and regression checks — 2026-11-05

The runtime recognizes v2 bindings/state only. A v1 exercise or unknown/mixed bot namespace stops initialization before writes; it does not create another exercise, reinterpret evidence, delete work or migrate silently. Existing copies do not automatically receive template updates. Use a fresh private template copy for the v2 flow; an active v1 copy requires a separate owner-reviewed migration, which is not automated by this release.

Offline tests cover a single exercise POST, no work-item POSTs at any stage, repeat-start idempotency, all twelve lessons remaining in the same thread, lazy issue-number rendering before registration, native role binding and interrupted-write recovery. The dormant author probe now asserts one issue and null backlog bindings; the 2026-11-04 native run is not claimed as a v2 run. See the [2026-11-05 report](daily%20work%20report/2026-11-05.md) for actual counts and hosted run evidence.

The reported learner copy was inspected at zero progress but became unavailable to the same authenticated actor before any cleanup. No migration, deletion, closure or recreation was attempted against it or any replacement learner repository.
