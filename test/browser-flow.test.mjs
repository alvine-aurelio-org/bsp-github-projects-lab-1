import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  normalizeProjectUrl,
  renderLesson,
} from '../.github/scripts/mona-core.mjs';
import { harness, WORKSHOP } from './helpers/fake-github.mjs';

test('a learner pastes only the Project address-bar link and Mona advances in the same issue', async () => {
  const h = harness();
  await h.run();
  const exercise = h.api.exercise().number;
  await h.say(
    'https://github.com/users/learner/projects/7/views/2?filterQuery=is%3Aopen#item',
  );
  assert.deepEqual(h.api.state().completed, ['1-0']);
  assert.equal(
    h.api.state().projectUrl,
    'https://github.com/users/learner/projects/7',
  );
  assert.equal(h.api.exercise().number, exercise);
  assert.equal(h.api.counts('createIssue'), 1);
  assert.equal(h.api.messages('lesson:1-1').length, 1);
  assert.equal(h.api.state().samples, null);
});

test('raw Project links keep ownership and host boundaries without fetching Projects', () => {
  for (const suffix of ['', '/', '/views/2', '/views/2?pane=info#item']) {
    assert.equal(
      normalizeProjectUrl(
        `https://github.com/users/learner/projects/7${suffix}`,
        'learner',
        'User',
      ),
      'https://github.com/users/learner/projects/7',
    );
  }
  for (const value of [
    'https://github.com/users/other/projects/7',
    'https://github.com/orgs/learner/projects/7',
    'https://github.com.evil.test/users/learner/projects/7',
    'https://evil@github.com/users/learner/projects/7',
    'https://github.com:443/users/learner/projects/7',
    'https://github.com/users/x/../learner/projects/7',
    'https://github.com/users/%6cearner/projects/7',
    'https://github.com/users/learner/projects/7/views/0',
    'https://github.com/users/learner/projects/7\n',
  ])
    assert.equal(normalizeProjectUrl(value, 'learner', 'User'), null, value);
});

test('the first actual lesson asks for only the link and contains no local-tool or command instructions', () => {
  const source = readFileSync(resolve('lessons/lab-1/00-workspace.md'), 'utf8');
  const state = {
    repository: 'learner/workshop',
    owner: 'learner',
    learner: 'learner',
    projectUrl: null,
    exerciseNumber: 1,
    pullRequest: null,
    samples: null,
  };
  const rendered = renderLesson(WORKSHOP, state, WORKSHOP.lessons[0], source);
  assert.ok(rendered.includes('Paste only that URL'));
  for (const forbidden of [
    '/project',
    'YOUR_PROJECT_URL',
    'YOUR-USERNAME',
    'local clone',
    '```powershell',
    'git remote',
    'VS Code',
    '**Project UI: SELF-CONFIRMED.**',
  ])
    assert.ok(!rendered.includes(forbidden), forbidden);
  const prGuide = readFileSync(
    resolve('lessons/lab-2/03-pull-request.md'),
    'utf8',
  );
  for (const required of [
    'branch menu',
    'Edit this file',
    'Commit changes',
    'Compare & pull request',
  ])
    assert.ok(prGuide.includes(required), required);
  assert.ok(
    !/```powershell|\bgit (?:clone|push|fetch|switch)\b/i.test(prGuide),
  );
  const workflow = readFileSync(resolve('.github/workflows/mona.yml'), 'utf8');
  assert.ok(
    !workflow.includes("startsWith(github.event.comment.body, '/')"),
    'Plain URL comments must reach the workflow',
  );
});
