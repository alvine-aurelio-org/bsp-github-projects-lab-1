# Step 3 — Create a linked pull request

**Time: 12 minutes · Topic: local clone, branch, change and native issue linkage**

## What and why

A branch isolates a proposed change; a PR lets you inspect it before merging. A closing reference links the change to the planned issue. This exercise changes **one file only**. Never edit workflows, lesson files or Mona's saved progress.

## Do

1. In your local clone's terminal, confirm `origin` names `{{REPO}}`. Start the work branch from current main. Paste this PowerShell group as a single block; it stops after a failed Git command:

```powershell
. {
    $expectedRepository = '{{REPO}}'
    $origin = git remote get-url origin
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read origin; use your private clone.' }
    $allowed = @("https://github.com/$expectedRepository", "https://github.com/$expectedRepository.git", "git@github.com:$expectedRepository", "git@github.com:$expectedRepository.git")
    if ($origin -notin $allowed) { throw 'Origin is not your private learner repository; stop without changing it.' }
    $pending = @(git status --porcelain=v1)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect your local changes.' }
    if ($pending.Count -ne 0) { throw 'Preserve and resolve your existing local changes before continuing.' }
    git fetch origin main
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed; stop and fix authentication.' }
    git switch -c workshop/release-checklist origin/main
    if ($LASTEXITCODE -ne 0) { throw 'Branch creation failed; do not continue on main.' }
}
```

2. In VS Code, open **work/release-checklist.md**. Change only the first task from unchecked to checked:

```markdown
- [x] Publish the service release checklist
```

   Leave the Sprint 2 verification checkbox unchecked. Save, then inspect and publish exactly that file:

```powershell
. {
    $branch = git branch --show-current
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'workshop/release-checklist') { throw 'Stop: the required work branch is not checked out.' }
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Preserve and resolve pre-existing staged changes before continuing.' }
    git diff -- work/release-checklist.md
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the checklist change.' }
    git add -- work/release-checklist.md
    if ($LASTEXITCODE -ne 0) { throw 'Staging failed.' }
    git diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw 'Fix the staged whitespace before committing.' }
    git commit -m "Publish the service release checklist"
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed; resolve the displayed Git error.' }
    git push -u origin workshop/release-checklist
    if ($LASTEXITCODE -ne 0) { throw 'Push failed; do not create a PR from a different branch.' }
}
```

3. Open your repository on GitHub → **Compare & pull request**. Base: **main**; compare: **workshop/release-checklist**. Use title **Publish the service release checklist** and put this line in the description:

```text
Closes #{{ISSUE_implementation}}
```

   Create the PR, confirm its **Development** relationship points to implementation, and leave the PR **open**. Do not merge until Mona posts Step 4. If Git asks for an author name/email, configure your own identity for this repository only; no instructor account is required.

![Issue Development entry point and Compare and pull request banner](../../assets/screenshots/lab-2-step-3.png)

*The file change is made in your local clone; the browser is used to open the PR. [Image attribution](https://github.com/alvine-aurelio-org/bsp-github-projects-lab-1/blob/main/assets/screenshots/SOURCES.md).*

## Ask Mona to check

In Mona's exercise issue, replace the placeholder with your actual PR number:

```text
/check 2-3 #YOUR_PR_NUMBER
```

**REPOSITORY-VERIFIED:** Mona checks author, same-repository head/base, exact branch, the native closing relationship, the only changed file and the required checked line. Never submit the sample issue number in place of the PR number. Do not change the PR's head after this passes.
