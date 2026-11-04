import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createGitHubClient } from '../.github/scripts/github-api.mjs';
import { bot, decodeState, hasStateMarker, runMona } from '../.github/scripts/mona-engine.mjs';
import { createLessonLoader } from '../.github/scripts/mona.mjs';

const repository = process.env.GITHUB_REPOSITORY;
assert.equal(repository, 'alvine-aurelio-org/bsp-github-projects-lab-1');
const api = createGitHubClient({ token: process.env.GH_TOKEN, repository });
const actual = await api.getRepository();
assert.equal(actual.private, true, 'Probe is allowed only before public publication.');
assert.equal(actual.is_template, false, 'Never run an author mutation against the learner template.');
const course = JSON.parse(await readFile(resolve('workshop.json'), 'utf8'));
// Test ONLY native repository-token bootstrap. The source exemption is removed
// in this private, author-owned probe; runtime learner code is not altered.
course.sourceRepositories = course.sourceRepositories.filter((name) => name !== repository);
course.exerciseTitle = '[Author smoke only] Mona native bootstrap — not learner completion';
course.exerciseMarker = '<!-- bsp-author-smoke-exercise:v1 -->';
course.stateMarker = 'bsp-author-smoke-state:v1';
course.sampleIssues = course.sampleIssues.map((issue) => ({
  ...issue, title: `[Author smoke only] ${issue.title}`,
  body: `AUTHOR PROBE: synthetic bootstrap data only; no learner Project exists or has been completed.\n\n${issue.body}`,
}));
const context = { repository, actor: process.env.GITHUB_ACTOR, eventName: 'workflow_dispatch', event: {} };
const result = await runMona({ workshop: course, context, api, loadLesson: createLessonLoader() });
assert.equal(result.status, 'ready');
assert.equal(result.completed, 0, 'No Project UI or participant lesson may be credited by this probe.');
const issues = await api.listIssues();
const exercise = issues.find((issue) => bot(issue.user) && issue.body?.split(/\r?\n/).includes(course.exerciseMarker));
assert.ok(exercise);
const comments = await api.listComments(exercise.number);
const saved = comments.find((comment) => bot(comment.user) && hasStateMarker(course, comment.body));
assert.ok(saved);
const state = decodeState(course, saved.body);
assert.equal(state.completed.length, 0);
assert.equal(state.projectUrl, null);
assert.equal(Object.keys(state.samples).length, 4);
assert.ok(comments.some((comment) => bot(comment.user) && comment.body.includes('lesson:1-0')));
const rerun = await runMona({ workshop: course, context, api, loadLesson: createLessonLoader() });
assert.equal(rerun.completed, 0);
assert.equal((await api.listIssues()).length, issues.length, 'Rerun must not duplicate seed issues.');
assert.deepEqual(await api.listBlockedBy(state.samples.verification.number), [], 'Native empty dependency route is readable, not a pass.');
for (const issue of [...Object.values(state.samples), { number: exercise.number }]) {
  const found = await api.getIssue(issue.number);
  assert.ok(bot(found.user) && found.title.startsWith('[Author smoke only]'));
  assert.equal((await api.closeExercise(issue.number)).state, 'closed');
}
console.log(JSON.stringify({
  nativeBootstrap: 'passed', nativeIdempotentRerun: 'passed', nativeIssuesDependencyRead: 'passed',
  sourceGuardExemption: 'private author probe only', sampleIssues: 4, exerciseIssue: exercise.number,
  probeIssuesClosed: 5, participantLessonsCompleted: 0, projectApiCalls: 0, projectUiRehearsed: false,
  note: 'Does not claim a template-copy event, native PR/merge or participant Project UI rehearsal.',
}, null, 2));
