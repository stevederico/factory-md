import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKER = join(dirname(fileURLToPath(import.meta.url)), '..', 'checker', 'factory.mjs');

const FACTORY = `---
name: stages-fixture
---

## stages
- triage: prompt
- plan: prompt
- build: build

## build
- ! build passes \`check: true\`

## prompt
- ! never a gate \`check: false\`
`;

function runStage(stage) {
  const dir = mkdtempSync(join(tmpdir(), 'factory-md-'));
  try {
    const file = join(dir, 'factory.md');
    writeFileSync(file, FACTORY);
    return spawnSync(process.execPath, [CHECKER, file, '--repo', dir, '--base', 'main', '--branch', 'work', '--stage', stage], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('prompt stages run no gate rules', () => {
  for (const stage of ['triage', 'plan']) {
    const result = runStage(stage);
    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /0\/2 rules in this stage/);
  }
});

test('a gate stage runs the rules of its categories', () => {
  const result = runStage('build');
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /1\/2 rules in this stage/);
});
