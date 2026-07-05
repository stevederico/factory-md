#!/usr/bin/env node
// factory-md — gate a repo against a factory.md's strict (`!`) rules.
// Parses `- ! <rule> `check: <shell>`` lines and runs each check.
// Exit 0 = rule passes; any non-zero = violation. Process exits with #failures.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

function parseArgs(argv) {
  const args = { repo: process.cwd(), base: null, branch: null, file: null, stage: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') args.repo = argv[++i];
    else if (a === '--base') args.base = argv[++i];
    else if (a === '--branch') args.branch = argv[++i];
    else if (a === '--stage') args.stage = argv[++i];
    else if (a === '-h' || a === '--help') args.help = true;
    else if (!a.startsWith('-')) args.file = a;
  }
  return args;
}

function usage() {
  console.log(`factory-md — gate a repo against a factory.md's strict rules

Usage:
  factory-md <factory.md> [--repo <dir>] [--base <branch>] [--branch <branch>] [--stage <name>]

Defaults:
  --repo    current directory
  --base    main, else master
  --branch  current HEAD (git rev-parse --abbrev-ref HEAD)
  --stage   run only rules whose category maps to this stage
            (build|check|ship|monitor — from the frontmatter category_stage map)`);
}

// Pull `- ! <desc> `check: <cmd>`` rules, tagging each with its `## section`.
// Also count strict rules with no check.
function parseRules(md) {
  const checkable = [];
  let strictNoCheck = 0;
  let category = null;
  for (const line of md.split('\n')) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) { category = h[1].toLowerCase(); continue; }
    const m = /^\s*-\s*!\s+(.*)$/.exec(line);
    if (!m) continue;
    const body = m[1];
    const ci = body.indexOf('`check:');
    if (ci === -1) { strictNoCheck++; continue; }
    const end = body.indexOf('`', ci + 1);
    if (end === -1) { strictNoCheck++; continue; }
    const cmd = body.slice(ci + '`check:'.length, end).trim();
    const desc = body.slice(0, ci).replace(/[`*]/g, '').trim();
    checkable.push({ desc, cmd, category });
  }
  return { checkable, strictNoCheck };
}

// Parse the v2 `## stages` section into a category → [stages] map.
// Each bullet is `- <stage>: prompt | <category>, <category>, …`.
function parseStages(md) {
  const catStage = {};
  const lines = md.split('\n');
  let i = lines.findIndex((l) => /^##\s+stages\s*$/i.test(l));
  if (i === -1) return catStage;
  for (i++; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break; // next section
    const mm = /^\s*[-*+]\s*([a-z]+)\s*:\s*(.+)$/i.exec(lines[i]);
    if (!mm) continue;
    const stage = mm[1].toLowerCase();
    const val = mm[2].trim();
    if (val.toLowerCase() === 'prompt') continue; // triage/spec are prompts, not gates
    for (const cat of val.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
      (catStage[cat] ||= []).push(stage);
    }
  }
  return catStage;
}

function detectBase(repo) {
  for (const b of ['main', 'master']) {
    try {
      execSync(`git rev-parse --verify ${b}`, { cwd: repo, stdio: 'ignore' });
      return b;
    } catch { /* try next */ }
  }
  return 'HEAD';
}

function currentBranch(repo) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: repo }).toString().trim();
  } catch { return 'HEAD'; }
}

function runCheck(cmd, env, repo) {
  try {
    execSync(cmd, { cwd: repo, env, stdio: 'pipe', shell: '/bin/bash' });
    return { pass: true };
  } catch (e) {
    const out = [e.stdout?.toString(), e.stderr?.toString()].filter(Boolean).join('').trim();
    return { pass: false, out };
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) { usage(); process.exit(args.file ? 0 : 1); }

  const repo = resolve(args.repo);
  const md = readFileSync(resolve(args.file), 'utf8');
  const { checkable, strictNoCheck } = parseRules(md);
  const catStage = parseStages(md);

  // Filter to one stage if requested, using each rule's category → stage map.
  let rules = checkable;
  if (args.stage) {
    rules = checkable.filter((r) => (catStage[r.category] || []).includes(args.stage));
  }

  const base = args.base || detectBase(repo);
  const branch = args.branch || currentBranch(repo);
  const env = { ...process.env, REPO_DIR: repo, BASE_BRANCH: base, BRANCH: branch };

  const name = /name:\s*(\S+)/.exec(md)?.[1] || args.file;
  const stageLbl = args.stage ? `  ${c.bold}stage=${args.stage}${c.reset}` : '';
  console.log(`${c.bold}factory:${c.reset} ${name}${stageLbl}  ${c.dim}repo=${repo} base=${base} branch=${branch}${c.reset}`);
  const scope = args.stage ? `${rules.length}/${checkable.length} rules in this stage` : `${checkable.length} verifiable rules`;
  console.log(`${c.dim}${scope} · ${strictNoCheck} strict rules without a check (skipped)${c.reset}\n`);

  let failed = 0;
  for (const r of rules) {
    const tag = r.category ? ` ${c.dim}[${r.category}]${c.reset}` : '';
    const res = runCheck(r.cmd, env, repo);
    if (res.pass) {
      console.log(`${c.green}✓${c.reset} ${r.desc}${tag}`);
    } else {
      failed++;
      console.log(`${c.red}✗${c.reset} ${r.desc}${tag}`);
      console.log(`  ${c.dim}check:${c.reset} ${c.cyan}${r.cmd}${c.reset}`);
      if (res.out) console.log(`  ${c.dim}${res.out.split('\n').join('\n  ')}${c.reset}`);
    }
  }

  const ok = failed === 0;
  console.log(`\n${ok ? c.green : c.red}${c.bold}${ok ? 'PASS' : 'FAIL'}${c.reset} ${rules.length - failed}/${rules.length} rules passed`);
  process.exit(failed);
}

main();
