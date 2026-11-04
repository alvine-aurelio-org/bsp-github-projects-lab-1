import {
  CheckFailed, MonaError, bindingFor, bot, completionText, decodeBinding, decodeState,
  encodeBinding, encodeState, hasStateMarker, human, initialState, markerLine,
  messageMarker, planCommand, positive, recordDecision, renderLesson,
  repositoryParts, requireSafe, same, sampleMarker, validateBinding, validateState,
  validateWorkshop, verifyDependency, verifyPullRequest,
} from './mona-core.mjs';

export * from './mona-core.mjs';

function validateRepository(repository, context, workshop) {
  const parts = repositoryParts(context.repository);
  requireSafe(repository && positive(repository.id) && same(repository.full_name, context.repository)
    && same(repository.name, parts.name) && same(repository.owner?.login, parts.owner)
    && ['User', 'Organization'].includes(repository.owner.type), 'Mona stopped: repository identity did not match the workflow.');
  if (repository.private !== true || (repository.visibility && repository.visibility !== 'private')) return 'private-copy-required';
  if (repository.is_template !== false) return 'template-or-unknown-template-status';
  if (repository.default_branch !== workshop.defaultBranch) return 'default-branch-must-be-main';
  return null;
}

function authenticIssue(issue, repository) {
  requireSafe(positive(issue.number) && positive(issue.id) && typeof issue.body === 'string'
    && Number.isFinite(Date.parse(issue.created_at))
    && same(issue.repository_url, `https://api.github.com/repos/${repository.full_name}`));
}

function discover(issues, marker, repository) {
  requireSafe(Array.isArray(issues));
  const matches = issues.filter((issue) => !issue.pull_request && bot(issue.user) && markerLine(issue.body, marker));
  requireSafe(matches.length <= 1, 'Mona stopped: duplicate bot workshop issues; no state was reset or advanced.');
  if (matches[0]) authenticIssue(matches[0], repository);
  return matches[0];
}

function validateComments(comments, repository, number) {
  requireSafe(Array.isArray(comments));
  const ids = new Set();
  for (const comment of comments) {
    requireSafe(positive(comment.id) && !ids.has(comment.id) && typeof comment.body === 'string'
      && same(comment.issue_url, `https://api.github.com/repos/${repository}/issues/${number}`)
      && Number.isFinite(Date.parse(comment.created_at)));
    ids.add(comment.id);
  }
}

function validatePublicationLedger(workshop, state, comments) {
  const published = (key) => comments.filter((comment) => bot(comment.user)
    && markerLine(comment.body, messageMarker(key)));
  for (const [index, lesson] of workshop.lessons.entries()) {
    const lessons = published(`lesson:${lesson.id}`);
    const feedback = published(`feedback:${lesson.id}`);
    requireSafe(lessons.length <= 1 && feedback.length <= 1);
    requireSafe(index <= state.completed.length || lessons.length === 0,
      'Mona stopped: saved progress conflicts with a published lesson. It was not reset.');
    requireSafe(index < state.completed.length || feedback.length === 0,
      'Mona stopped: saved progress conflicts with recorded feedback. It was not reset.');
    // Prior completed lessons cannot disappear through an interrupted POST:
    // they were necessarily visible before the following command was applied.
    if (index < state.completed.length) requireSafe(lessons.length === 1,
      'Mona stopped: a historical lesson is missing. Saved progress was not reset.');
    if (index < state.completed.length - 1) requireSafe(feedback.length === 1,
      'Mona stopped: historical feedback is missing. Saved progress was not reset.');
    if (index === 0 && state.readyAfterCommentId !== null) requireSafe(lessons[0]?.id === state.readyAfterCommentId,
      'Mona stopped: the saved creation fence does not match the first bot lesson.');
  }
  const completion = published('complete');
  requireSafe(completion.length <= 1 && (completion.length === 0 || state.completed.length === workshop.lessons.length));
}

async function snapshotFor(api, workshop, state, plan) {
  if (plan.lessonId === '2-2') return verifyDependency(state, await api.listBlockedBy(state.samples.verification.number));
  const pr = await api.getPullRequest(plan.prNumber);
  // Ref values are SHA-validated before they can become a content request.
  const ref = plan.lessonId === '2-4' ? pr?.merge_commit_sha : pr?.head?.sha;
  if (!/^[a-f\d]{40}$/i.test(ref ?? '')) throw new CheckFailed('Mona: no progress changed. The pull request does not yet have the required head or merge commit.');
  const files = await api.listPullRequestFiles(plan.prNumber);
  const closingIssues = await api.getClosingIssues(plan.prNumber, pr.head.sha);
  const content = await api.readRepositoryFile(workshop.workFile, ref);
  const snapshot = { pr, files, closingIssues, content };
  if (plan.lessonId === '2-4') {
    snapshot.implementation = await api.getIssue(state.samples.implementation.number);
    snapshot.verification = await api.getIssue(state.samples.verification.number);
  }
  snapshot.after = await api.getPullRequest(plan.prNumber);
  return verifyPullRequest(workshop, state, plan, snapshot);
}

/**
 * Injected I/O shell around the pure reducer. The workflow's repository-scoped,
 * cancel-in-progress:false concurrency group supplies the single writer.
 * Every write is recoverable by listing trusted markers on the next run. Do not
 * automatically retry a POST: GitHub might have committed a lost response.
 */
export async function runMona({ workshop, context, api, loadLesson }) {
  validateWorkshop(workshop);
  repositoryParts(context.repository);
  const skip = (reason) => ({ status: 'skipped', reason });
  if (workshop.role !== 'starter') return skip('companion-role');
  if (workshop.sourceRepositories.some((source) => same(source, context.repository))) return skip('source-repository');
  if (!['push', 'workflow_dispatch', 'issue_comment'].includes(context.eventName)) return skip('unsupported-event');
  const event = context.event ?? {};
  if (!human({ login: context.actor, type: 'User' })) return skip('non-human-actor');
  if (event.repository?.full_name && !same(event.repository.full_name, context.repository)) return skip('event-repository-mismatch');
  if (context.eventName === 'push' && event.ref !== `refs/heads/${workshop.defaultBranch}`) return skip('not-default-branch');
  if (context.eventName === 'issue_comment' && (event.action !== 'created' || event.issue?.pull_request
    || !positive(event.issue?.number) || !human(event.comment?.user)
    || !same(event.comment.user.login, context.actor) || !positive(event.comment.id))) return skip('not-human-issue-comment');
  const repository = await api.getRepository();
  const guard = validateRepository(repository, context, workshop);
  if (guard) return skip(guard);
  if (repository.owner.type === 'User' && !same(context.actor, repository.owner.login)) return skip('not-repository-owner');
  const issues = await api.listIssues();
  let exercise = discover(issues, workshop.exerciseMarker, repository);
  let binding;
  if (exercise) {
    binding = decodeBinding(exercise.body);
    validateBinding(binding, bindingFor(workshop, repository, binding.learner, 'exercise'));
    if (!same(context.actor, binding.learner)) return skip('not-bound-learner');
    if (context.eventName === 'issue_comment' && event.issue.number !== exercise.number) return skip('unrelated-issue');
  } else {
    if (context.eventName === 'issue_comment') return skip('exercise-not-created');
    // An organization is not a human login. Its copy must be initialized by a
    // repository administrator, checked for THIS actor, not token permissions.
    if (repository.owner.type === 'Organization') {
      const permission = await api.getCollaboratorPermission(context.actor);
      if (permission?.permission !== 'admin' || !same(permission.user?.login, context.actor)) return skip('not-repository-owner-admin');
    }
    binding = bindingFor(workshop, repository, context.actor, 'exercise');
  }
  const samples = {};
  const missing = [];
  for (const sample of workshop.sampleIssues) {
    const found = discover(issues, sampleMarker(sample.key), repository);
    const sampleBinding = { ...binding, kind: `sample:${sample.key}` };
    if (found) {
      validateBinding(decodeBinding(found.body), sampleBinding);
      samples[sample.key] = { number: found.number, id: found.id };
    } else missing.push({ sample, sampleBinding });
  }
  // Only initialization may create samples. Losing state/seed data must never
  // silently reset a workshop that already published its first lesson.
  let comments = exercise ? await api.listComments(exercise.number) : [];
  if (exercise) validateComments(comments, repository.full_name, exercise.number);
  const trustedState = comments.filter((comment) => bot(comment.user) && hasStateMarker(workshop, comment.body));
  requireSafe(trustedState.length <= 1, 'Mona stopped: multiple bot state comments. Nothing was reset.');
  const alreadyPublished = comments.some((comment) => bot(comment.user)
    && comment.body.includes('<!-- bsp-workshop-message:v1 '));
  requireSafe(trustedState.length > 0 || !alreadyPublished, 'Mona stopped: saved bot state is missing. Published progress was not reset.');
  if (missing.length && (trustedState.length || alreadyPublished)) throw new MonaError('Mona stopped: a bound sample issue is missing. It was not recreated and progress was not reset.');
  if (!trustedState.length && context.eventName === 'issue_comment') return skip('initialization-incomplete');
  const lessonCache = new Map();
  const lessonSource = async (lesson) => {
    if (!lessonCache.has(lesson.id)) lessonCache.set(lesson.id, await loadLesson(lesson.file));
    return lessonCache.get(lesson.id);
  };
  if (!trustedState.length) {
    // Read before seed writes, so a missing packaged guide fails safely.
    const source = await lessonSource(workshop.lessons[0]);
    requireSafe(typeof source === 'string' && source.length > 0 && source.length <= 48_000,
      'Mona stopped: the first lesson file is missing or invalid.');
    for (const { sample, sampleBinding } of missing) {
      const created = await api.createIssue({
        title: sample.title,
        body: `${sampleMarker(sample.key)}\n${encodeBinding(sampleBinding)}\n${sample.body}`,
      });
      authenticIssue(created, repository);
      requireSafe(bot(created.user) && markerLine(created.body, sampleMarker(sample.key)));
      validateBinding(decodeBinding(created.body), sampleBinding);
      samples[sample.key] = { number: created.number, id: created.id };
    }
    if (!exercise) {
      exercise = await api.createIssue({
        title: workshop.exerciseTitle,
        body: `${workshop.exerciseMarker}\n${encodeBinding(binding)}\n### Mona's guided workshop\n\n`
          + `Learner: @${binding.learner}. This private copy is bound to ${binding.repository}. `
          + 'Follow the bot lesson comments below. Project UI work is **SELF-CONFIRMED**; Mona never uses the Projects API. '
          + 'Only the initiating learner can progress. No PAT, App or instructor is needed.',
      });
      authenticIssue(exercise, repository);
      requireSafe(bot(exercise.user) && markerLine(exercise.body, workshop.exerciseMarker));
      validateBinding(decodeBinding(exercise.body), binding);
      comments = await api.listComments(exercise.number);
      validateComments(comments, repository.full_name, exercise.number);
    }
  }
  // Stable key order is independent of which seed POST failed on a prior run.
  const boundSamples = Object.fromEntries(workshop.sampleIssues.map(({ key }) => [key, samples[key]]));
  let stateComment = trustedState[0];
  let state = stateComment ? decodeState(workshop, stateComment.body)
    : initialState(workshop, binding, exercise, boundSamples);
  validateState(workshop, state, binding, exercise, boundSamples);
  validatePublicationLedger(workshop, state, comments);
  const validateSavedComment = (comment, body) => {
    requireSafe(bot(comment?.user) && comment.body === body && positive(comment.id)
      && same(comment.issue_url, `https://api.github.com/repos/${state.repository}/issues/${exercise.number}`));
  };
  const save = async (next) => {
    validateState(workshop, next, binding, exercise, boundSamples);
    const body = encodeState(workshop, next);
    requireSafe(body.length <= 60_000, 'Mona stopped: durable progress is too large.');
    const saved = stateComment ? await api.updateComment(stateComment.id, body)
      : await api.createComment(exercise.number, body);
    validateSavedComment(saved, body);
    if (stateComment) requireSafe(saved.id === stateComment.id);
    stateComment = saved;
    state = next;
  };
  if (!stateComment) await save(state);

  const ensureMessage = async (key, render) => {
    const marker = messageMarker(key);
    const existing = comments.filter((comment) => bot(comment.user) && markerLine(comment.body, marker));
    requireSafe(existing.length <= 1, 'Mona stopped: duplicate bot lesson/feedback markers. No progress was reset.');
    if (existing[0]) return existing[0];
    const body = await render(marker);
    requireSafe(markerLine(body, marker) && body.length <= 60_000);
    const created = await api.createComment(exercise.number, body);
    validateSavedComment(created, body);
    comments.push(created);
    return created;
  };

  const reconcile = async () => {
    for (let index = 0; index <= state.completed.length && index < workshop.lessons.length; index += 1) {
      if (index > 0) {
        const id = workshop.lessons[index - 1].id;
        await ensureMessage(`feedback:${id}`, (marker) => `${marker}\n${state.evidence[id].feedback}`);
      }
      const lesson = workshop.lessons[index];
      const published = await ensureMessage(`lesson:${lesson.id}`, async () =>
        renderLesson(workshop, state, lesson, await lessonSource(lesson)));
      if (index === 0 && state.readyAfterCommentId === null) {
        await save({ ...state, readyAfterCommentId: published.id });
      }
    }
    if (state.lastReply) await ensureMessage(`reply:${state.lastReply.commentId}`,
      (marker) => `${marker}\n${state.lastReply.text}`);
    if (state.completed.length === workshop.lessons.length) {
      const last = workshop.lessons.at(-1).id;
      await ensureMessage(`feedback:${last}`, (marker) => `${marker}\n${state.evidence[last].feedback}`);
      await ensureMessage('complete', (marker) => `${marker}\n${completionText(state)}`);
      if (exercise.state !== 'closed') {
        const closed = await api.closeExercise(exercise.number);
        requireSafe(closed?.number === exercise.number && closed.id === exercise.id && closed.state === 'closed');
        exercise = closed;
      }
    }
  };

  // Drain a committed outbox before considering another learner command.
  await reconcile();
  if (exercise.state === 'closed' && state.completed.length < workshop.lessons.length) return { status: 'paused', reason: 'exercise-closed', completed: state.completed.length };
  const queue = comments.filter((comment) => human(comment.user) && same(comment.user.login, state.learner)
    && comment.id > state.lastProcessedHumanCommentId && comment.id > state.readyAfterCommentId
    && Date.parse(comment.created_at) >= Date.parse(state.createdAt)
    && comment.updated_at === comment.created_at).sort((a, b) => a.id - b.id);
  for (const comment of queue) {
    let plan = planCommand(workshop, state, comment.body);
    let details;
    if (plan.kind === 'check') {
      try {
        details = await snapshotFor(api, workshop, state, plan);
      } catch (error) {
        if (!(error instanceof CheckFailed)) throw error;
        plan = { kind: 'reply', text: error.message };
      }
    }
    const next = recordDecision(workshop, state, comment, plan, details);
    await save(next); // Evidence + completion + cursor are one durable PATCH.
    await reconcile();
  }
  return { status: state.completed.length === workshop.lessons.length ? 'complete' : 'ready', completed: state.completed.length };
}
