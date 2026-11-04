# Implementation and verification boundary

## Publication layout

- **Lab 1** is the only learner starter template and packages all twelve lessons, Mona's engine and images.
- **Lab 2 / Lab 3** are companion reference repositories. They deliberately contain no learner bootstrap; they link back to the starter and tell learners not to make another copy.
- A participant creates a private template copy, clones that copy, creates a matching-owner Project in Step 0 and completes the three modules in the same exercise issue.
- The source repositories are public so participants need no source-repository invitation. Only synthetic workshop material is published.

## Runtime

Node 24 runs on GitHub Actions with no dependency installation. `push` to main and a manual dispatch initialize/resume; `issue_comment: created` processes exact commands. Repository-level concurrency serializes state updates. Pending events may coalesce, so the engine reconciles all eligible new comments in creation order instead of trusting only the latest payload.

The engine uses bot-authored issue markers and a durable bot-authored state comment, bound to repository ID, owner, initiating learner, exercise ID and the course contract. It persists completion evidence before publishing feedback and the next lesson. Idempotent publication markers recover interrupted writes. It does not silently reset an exercise after losing or corrupting state.

## Evidence classes

| Class | Activities |
|---|---|
| Self-confirmed | Project existence/privacy/linking, cloning, item membership, draft conversion, fields, values, board, iterations, roadmap, workload, charts, status updates and export |
| Repository-verified | Lab 2 native blocked_by relationship; learner PR, correct repository/head/base/branch, exact changed file/content and native closingIssuesReferences; same checked head merged into main and issue states |
| Mixed | Lab 2 final merge is repository-verified; Project Done and Sprint 2 reassignment are self-confirmed by the completion command |

Project URL validation checks a strict HTTPS GitHub URL, owner, account type and positive number **only**. It does not query Projects or infer existence from a 404. Project UI work is never described as API-verified. A course completion is not an independently reviewed assessment.

## Author checks

Run the portable `node --test --test-reporter=tap` suite and `node tools/verify-content.mjs` from a fresh source checkout. Tests use an in-memory GitHub API and cover all twelve steps, hostile and out-of-order commands, forged markers, identity mismatch, partial API results, native check failures and interrupted-write recovery. Tests do not stand in for a live GitHub rehearsal.

`tools/build-screenshots.mjs` downloads immutable, attributed GitHub Docs images and uses an author-only Playwright browser to render twelve navigation-overview sheets. Participant copies need none of that tooling. It preserves original files and digests for attribution and reproducibility. Images show real documented UI entry points; they are not claimed to be authenticated screenshots of a BSP tenant or proof that every latest menu was live-tested.

The daily work report records actual local test counts, hosted workflow results and any native rehearsal scope. Do not claim a private personal Project was inspected automatically or that an unperformed UI exercise passed.
