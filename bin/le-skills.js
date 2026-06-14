#!/usr/bin/env node
// ============================================================
// le-skills — Project skills & rules CLI
// ============================================================
//   npx le-skills install [-y] [--preview] [target]
//   npx le-skills check   [target]
//   npx le-skills info    [target]
//   npx le-skills list
//   npx le-skills outdated
//   npx le-skills update
//   npx le-skills version
//   npx le-skills --help
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ---- Paths ----

const __filename = fileURLToPath(import.meta.url);
const PKG_DIR = path.resolve(__filename, '../..');
const AGENTS_SRC = path.join(PKG_DIR, '.agents');
const SCRIPTS_SRC = path.join(PKG_DIR, 'scripts');
const PKG_JSON = path.join(PKG_DIR, 'package.json');

const manifest = JSON.parse(fs.readFileSync(PKG_JSON, 'utf-8'));
const VERSION = manifest.version;

// ---- Exit codes ----

const EXIT = {
  OK: 0,
  ERR_UNKNOWN: 1,
  ERR_NOT_INSTALLED: 2,
  ERR_ALREADY_INSTALLED: 3,
  ERR_NO_TARGET: 4,
  ERR_OUTDATED: 10,
};

// ---- Colour helpers ----

function colour(code, text) {
  return process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;
}
const green  = (s) => colour('0;32', `✔ ${s}`);
const cyan   = (s) => colour('0;36', `ℹ ${s}`);
const yellow = (s) => colour('1;33', `⚡ ${s}`);
const red    = (s) => colour('0;31', `✘ ${s}`);
const dim    = (s) => colour('2', s);

// ---- Helpers ----

function die(msg, code = EXIT.ERR_UNKNOWN) {
  console.error(red(msg));
  process.exit(code);
}

/**
 * Create a timestamped backup of a path before modifying it.
 * Returns the backup path or null if nothing was backed up.
 */
function backupPath(target, relPath) {
  const source = path.join(target, relPath);
  if (!fs.existsSync(source)) return null;

  const ts = Date.now();
  const backupDir = path.join(target, '.agents', '.le-skills-backup', String(ts));
  const dest = path.join(backupDir, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.statSync(source).isDirectory()) {
    copyFileSyncSimple(source, dest); // shallow copy for backup
  } else {
    fs.copyFileSync(source, dest);
  }
  return dest;
}

function copyFileSyncSimple(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFileSyncSimple(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

/**
 * Copy a single file with conflict resolution.
 * autoYes=true → replaces silently (--yes mode).
 * Returns 'replaced' | 'kept' | 'copied'.
 */
async function safeCopyFile(src, dest, label, autoYes = false) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    return 'copied';
  }

  // File already exists → conflict
  if (autoYes) {
    // --yes mode: auto-replace (but still backup first)
    fs.copyFileSync(src, dest);
    return 'replaced';
  }

  const srcContent = fs.readFileSync(src, 'utf-8');
  const dstContent = fs.readFileSync(dest, 'utf-8');

  // Identical content → skip
  if (srcContent === dstContent) {
    return 'kept';
  }

  console.log(`\n${yellow('═══ File Conflict ═══')}`);
  console.log(`  File: ${label}`);
  const choice = await askChoice(
    '如何处理此文件？',
    [
      '替换为 le-skills 版本（原文件备份到 .agents/.le-skills-backup/）',
      '保留现有文件，不替换',
      '显示差异（查看后再选）',
    ],
  );

  if (choice === 0) {
    backupPath(path.dirname(dest), path.basename(dest)); // backup old version
    fs.copyFileSync(src, dest);
    return 'replaced';
  } else if (choice === 2) {
    // Show diff
    const srcLines = srcContent.split('\n');
    const dstLines = dstContent.split('\n');
    console.log(`\n${dim('--- le-skills version (new)')}`);
    console.log(`${dim('+++ current file (existing)')}`);
    const max = Math.max(srcLines.length, dstLines.length);
    for (let i = 0; i < max; i++) {
      if (srcLines[i] !== dstLines[i]) {
        const lineNum = i + 1;
        if (srcLines[i] !== undefined) console.log(`${green('+')} ${dim(`L${lineNum}:`)} ${srcLines[i]}`);
        if (dstLines[i] !== undefined) console.log(`${red('-')} ${dim(`L${lineNum}:`)} ${dstLines[i]}`);
      }
    }
    // Re-ask
    return safeCopyFile(src, dest, label, autoYes);
  }

  return 'kept';
}

/**
 * Recursive copy with per-file conflict resolution.
 */
async function safeCopyRecursive(src, dest, baseLabel, autoYes = false) {
  let replaced = 0;
  let kept = 0;
  let copied = 0;

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    const label = `${baseLabel}/${entry.name}`;

    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      const sub = await safeCopyRecursive(s, d, label, autoYes);
      replaced += sub.replaced;
      kept += sub.kept;
      copied += sub.copied;
    } else {
      const result = await safeCopyFile(s, d, label, autoYes);
      if (result === 'replaced') replaced++;
      else if (result === 'kept') kept++;
      else copied++;
    }
  }

  return { replaced, kept, copied };
}

function isInstalled(target) {
  return fs.existsSync(path.join(target, '.agents', 'skills', 'INDEX.md'));
}

function getLatestVersion() {
  try {
    const out = execSync('npm view le-skills version', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.trim();
  } catch {
    return null;
  }
}

// ---- Prompt ----

function askYesNo(question, defaultYes = true) {
  const hint = defaultYes ? '(Y/n)' : '(y/N)';
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${cyan(`? ${question} ${hint}`)} `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === '') resolve(defaultYes);
      else if (a === 'y' || a === 'yes') resolve(true);
      else resolve(false);
    });
  });
}

function askChoice(question, options) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    console.log(`\n${cyan(`? ${question}`)}`);
    for (let i = 0; i < options.length; i++) {
      console.log(`  ${i + 1}) ${options[i]}`);
    }
    rl.question(`  ${cyan('选择 (1-' + options.length + ')')}: `, (answer) => {
      rl.close();
      const idx = parseInt(answer.trim(), 10);
      if (idx >= 1 && idx <= options.length) {
        resolve(idx - 1);
      } else {
        resolve(0); // default = first option
      }
    });
  });
}

// ---- Project Scanning ----

function detectProjectType(target) {
  for (const [file, label] of [
    ['package.json', 'Node.js / Frontend'],
    ['pyproject.toml', 'Python'],
    ['requirements.txt', 'Python'],
    ['Cargo.toml', 'Rust'],
    ['go.mod', 'Go'],
  ]) {
    if (fs.existsSync(path.join(target, file))) return label;
  }
  return 'unknown';
}

function scanExistingAiDocs(target) {
  const docs = {};
  const agentsPath = path.join(target, 'AGENTS.md');
  const claudePath = path.join(target, 'CLAUDE.md');

  if (fs.existsSync(agentsPath)) {
    docs.AGENTS = fs.readFileSync(agentsPath, 'utf-8');
  }
  if (fs.existsSync(claudePath)) {
    docs.CLAUDE = fs.readFileSync(claudePath, 'utf-8');
  }

  // Scan .cursor/rules/
  const cursorRules = path.join(target, '.cursor', 'rules');
  if (fs.existsSync(cursorRules)) {
    docs.cursorRules = fs.readdirSync(cursorRules).filter((f) => f.endsWith('.mdc'));
  }

  return docs;
}

function scanExistingSkillDirs(target) {
  const dirs = [];
  for (const dir of ['.trae/skills', '.reasonix/skills', '.skills', 'skills', '.cursor/rules']) {
    const full = path.join(target, dir);
    if (fs.existsSync(full)) {
      const entries = fs.readdirSync(full, { withFileTypes: true });
      const skills = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      if (skills.length > 0) {
        dirs.push({ path: dir, skills });
      }
    }
  }
  return dirs;
}

/**
 * Scan content for version management sections.
 * Returns array of matched section headers.
 */
function scanVersionManagement(content) {
  const patterns = [
    /版本管理/i,
    /版本更新/i,
    /版本号/i,
    /versioning/i,
    /更新日志/i,
    /changelog/i,
    /version management/i,
    /release\s*process/i,
  ];
  const matches = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match headings or list items containing version-related keywords
    if (/^#{1,4}\s/.test(line) || /^[-*]\s/.test(line)) {
      for (const p of patterns) {
        if (p.test(line)) {
          matches.push({ line: i + 1, text: line.trim() });
          break;
        }
      }
    }
  }
  return matches;
}

/**
 * Scan content for code standards sections.
 */
function scanCodeStandards(content) {
  const patterns = [
    /代码规范/i,
    /编码规范/i,
    /提交规范/i,
    /commit\s*(message|convention|规范)/i,
    /code\s*style/i,
    /coding\s*standard/i,
    /代码风格/i,
    /lint/i,
  ];
  const matches = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,4}\s/.test(line) || /^[-*]\s/.test(line)) {
      for (const p of patterns) {
        if (p.test(line)) {
          matches.push({ line: i + 1, text: line.trim() });
          break;
        }
      }
    }
  }
  return matches;
}

/**
 * Check if AGENTS.md already has le-skills loading chain injected.
 */
function hasLoadingChain(content) {
  return /每次任务开始前必须加载以下规则文件/.test(content);
}

/**
 * Check if CLAUDE.md already has @AGENTS.md reference.
 */
function hasAgentsRef(content) {
  return /@AGENTS\.md/.test(content);
}

// ---- INDEX.md Generation ----

function generateIndexMd(target) {
  const agentsSkills = path.join(target, '.agents', 'skills');
  const agentsRules = path.join(target, '.agents', 'rules');

  const skills = [];
  if (fs.existsSync(agentsSkills)) {
    for (const entry of fs.readdirSync(agentsSkills, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(agentsSkills, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf-8');
      const name = content.match(/^name:\s*(.+)/m)?.[1]?.trim() || entry.name;
      const desc = content.match(/^description:\s*(.+)/m)?.[1]?.trim() || '(no description)';
      skills.push({ dir: entry.name, name, desc });
    }
  }

  const rules = [];
  if (fs.existsSync(agentsRules)) {
    for (const f of fs.readdirSync(agentsRules)) {
      if (!f.endsWith('.md')) continue;
      const loadType = f === 'project-rules.md' ? '全量加载' : '按需加载';
      rules.push({ file: f, loadType });
    }
  }

  let md = '# 技能清单 INDEX\n\n';
  md += '> 由 le-skills install 自动生成\n\n';
  md += '## 已安装技能\n\n';
  md += '| 技能 | 用途 | 调度优先级 |\n';
  md += '|------|------|-----------|\n';

  for (const s of skills) {
    const link = `[${s.name}](./${s.dir}/SKILL.md)`;
    const priority = s.dir === 'managing-project-skills' ? '⭐ 最高（入口）'
                  : s.dir === 'installing-project-skills' ? '⭐ 高'
                  : '⭐ 中';
    md += `| ${link} | ${s.desc} | ${priority} |\n`;
  }

  md += '\n## 依赖规则\n\n';
  md += '| 规则文件 | 加载方式 |\n';
  md += '|---------|---------|\n';
  for (const r of rules) {
    md += `| \`.agents/rules/${r.file}\` | ${r.loadType} |\n`;
  }

  md += '\n## ⚡ 按需加载决策表（Agent 执行指南）\n\n';
  md += '每次收到用户消息后，按以下规则决定是否加载额外规则文件：\n\n';
  md += '| 触发条件 | 操作 | 加载方式 |\n';
  md += '|---------|------|---------|\n';
  md += '| 用户说「更新更新日志」「发布」「打 tag」 | 读取 `version-management-rules.md` 并应用 | 按需加载 |\n';
  md += '| 用户说「修改代码」「新增」「提交代码」 | 读取 `code-standards-rules.md` 检查规范 | 按需加载 |\n';
  md += '| 用户说「安装/更新/卸载技能」 | 读取 `skill-lifecycle-rules.md` 执行生命周期 | 按需加载 |\n';
  md += '| 技能执行时编排任务 | 读取 `skill-scheduling-rules.md` 决定调度策略 | 按需加载 |\n';
  md += '| 用户说「更新更新日志为 vx.x.x」 | 读取 `changelog-rules.md` 生成更新日志 | 按需加载 |\n';
  md += '| 未匹配以上条件 | 仅使用 `project-rules.md`（已全量加载） | 全量加载 |\n';

  md += '\n> **注意：** 本 INDEX.md 由 le-skills 维护，运行 `npx le-skills install --yes` 会重新生成。\n';

  return md;
}

// ---- Rule Extraction (AGENTS.md + CLAUDE.md) ----

/**
 * Load le-skills default rule content for comparison.
 */
function getDefaultRuleContent(sectionType) {
  const ruleFile = sectionType === 'version' ? 'version-management-rules.md' : 'code-standards-rules.md';
  const pkgRulePath = path.join(PKG_DIR, '.agents', 'rules', ruleFile);
  if (!fs.existsSync(pkgRulePath)) return '';
  return fs.readFileSync(pkgRulePath, 'utf-8');
}

/**
 * Check if user content overlaps with le-skills default rules.
 * Returns a similarity score 0-1 based on keyword overlap.
 */
function calcRuleOverlap(userContent, defaultContent) {
  const extractKeywords = (text) => {
    const tokens = text.toLowerCase()
      .replace(/[#*`\-_>|\[\]]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
    return new Set(tokens);
  };

  const userKeys = extractKeywords(userContent);
  const defaultKeys = extractKeywords(defaultContent);
  if (userKeys.size === 0 || defaultKeys.size === 0) return 0;

  let overlap = 0;
  for (const k of userKeys) {
    if (defaultKeys.has(k)) overlap++;
  }
  return overlap / Math.max(userKeys.size, defaultKeys.size);
}

/**
 * Scan a single file (AGENTS.md or CLAUDE.md) for matching rule sections.
 * Returns array of { header, content, sourceFile }.
 */
function scanFileForSections(filePath, sectionType) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let headingPattern;
  if (sectionType === 'version') {
    headingPattern = /^#{1,3}\s*(版本管理|版本更新|版本号|versioning|更新日志|changelog|version management|release\s*process)/i;
  } else if (sectionType === 'standards') {
    headingPattern = /^#{1,3}\s*(代码规范|编码规范|提交规范|commit\s*(message|convention)|code\s*style|coding\s*standard|代码风格)/i;
  } else {
    return [];
  }

  const sections = [];
  let i = 0;

  while (i < lines.length) {
    if (headingPattern.test(lines[i])) {
      const header = lines[i].trim();
      const sectionLines = [lines[i]];
      i++;
      while (i < lines.length) {
        if (/^#{1,3}\s/.test(lines[i]) && !/^#{4,}\s/.test(lines[i])) break;
        sectionLines.push(lines[i]);
        i++;
      }
      sections.push({
        header,
        content: sectionLines.join('\n'),
        sourceFile: path.basename(filePath),
      });
    } else {
      i++;
    }
  }

  return sections;
}

/**
 * Extract rule sections from AGENTS.md AND CLAUDE.md — ONE SECTION AT A TIME,
 * with similarity comparison against le-skills defaults.
 * Returns array of extracted section contents.
 */
async function extractSectionsInteractive(target, sectionType, autoYes = false) {
  const agentPath = path.join(target, 'AGENTS.md');
  const claudePath = path.join(target, 'CLAUDE.md');

  const typeLabel = sectionType === 'version' ? '版本管理' : '代码规范';
  const ruleFile = sectionType === 'version' ? 'version-management-rules.md' : 'code-standards-rules.md';

  // Scan both files
  const agSections = scanFileForSections(agentPath, sectionType);
  const clSections = scanFileForSections(claudePath, sectionType);
  const allSections = [...agSections, ...clSections];

  if (allSections.length === 0) return [];

  // Load le-skills default for comparison
  const defaultContent = getDefaultRuleContent(sectionType);

  if (autoYes) {
    // --yes: extract all, replace with references (from AGENTS.md only)
    const extracted = allSections.map((s) => s.content);
    if (agSections.length > 0) {
      // Replace in AGENTS.md
      let agContent = fs.readFileSync(agentPath, 'utf-8');
      for (const s of agSections) {
        const refText = `\n> **${typeLabel}：** 详见 \`.agents/rules/${ruleFile}\`（按需加载）\n`;
        agContent = agContent.replace(s.content, refText);
      }
      fs.writeFileSync(agentPath, agContent, 'utf-8');
    }
    return extracted;
  }

  // Backup both files
  const backupDir = path.join(target, '.agents', '.le-skills-backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  if (fs.existsSync(agentPath)) {
    fs.copyFileSync(agentPath, path.join(backupDir, 'AGENTS.md'));
  }
  if (fs.existsSync(claudePath)) {
    fs.copyFileSync(claudePath, path.join(backupDir, 'CLAUDE.md'));
  }

  // Read current content (might be modified between sections)
  let agContent = fs.existsSync(agentPath) ? fs.readFileSync(agentPath, 'utf-8') : '';
  const extracted = [];

  // Process each section one by one
  for (const section of allSections) {
    console.log(`\n${yellow(`═══════════════════════════════════════`)}`);
    console.log(`${yellow(`  ${typeLabel} 规则段落`)}`);
    console.log(`${yellow(`═══════════════════════════════════════`)}`);
    console.log(`  来源: ${section.sourceFile} (L${findLineNumber(section.content, section.sourceFile, target)})`);
    console.log(`  ${dim(section.header)}`);
    console.log(`  ${dim(section.content.slice(0, 250))}${section.content.length > 250 ? '…' : ''}`);

    // Compare with le-skills default
    let overlap = 0;
    if (defaultContent) {
      overlap = calcRuleOverlap(section.content, defaultContent);
      if (overlap > 0.3) {
        console.log(`  ${yellow('⚠ 此规则与 le-skills 默认规则相似度较高')} (${Math.round(overlap * 100)}%)`);
      }
    }

    // Build options
    const options = [
      `提取到 .agents/rules/${ruleFile}，${section.sourceFile} 中替换为引用`,
      `保留在 ${section.sourceFile} 原处，不提取`,
    ];
    if (overlap > 0.3) {
      options.push(`使用 le-skills 默认规则替换（丢弃此段）`);
    } else {
      options.push(`同时保留两处（拷贝到规则文件 + 保留 ${section.sourceFile} 原内容）`);
    }

    const choice = await askChoice(
      overlap > 0.3
        ? `此规则与 le-skills 默认规则 ${Math.round(overlap * 100)}% 相似，如何处理？`
        : `如何处理此${typeLabel}规则段落？`,
      options,
    );

    if (choice === 0) {
      // Extract + replace in the source file
      extracted.push(section.content);
      const refText = `\n> **${typeLabel}：** 详见 \`.agents/rules/${ruleFile}\`（按需加载）\n`;
      if (section.sourceFile === 'AGENTS.md') {
        agContent = agContent.replace(section.content, refText);
        fs.writeFileSync(agentPath, agContent, 'utf-8');
      } else {
        let clContent = fs.readFileSync(claudePath, 'utf-8');
        clContent = clContent.replace(section.content, refText);
        fs.writeFileSync(claudePath, clContent, 'utf-8');
      }
      console.log(cyan(`  → 已提取，${section.sourceFile} 中替换为引用`));
    } else if (choice === 1) {
      console.log(cyan(`  → 保留在原处`));
    } else if (choice === 2 && overlap > 0.3) {
      // Use le-skills default instead — don't extract user version
      console.log(cyan(`  → 使用 le-skills 默认规则，丢弃此段`));
    } else {
      // Keep both
      extracted.push(section.content);
      console.log(cyan(`  → 已复制到规则文件，${section.sourceFile} 保留原内容`));
    }
  }

  return extracted;
}

function findLineNumber(content, sourceFile, target) {
  const filePath = path.join(target, sourceFile);
  if (!fs.existsSync(filePath)) return '?';
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const firstLine = content.split('\n')[0];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === firstLine) return i + 1;
  }
  return '?';
}

/**
 * Confirm and inject loading chain into AGENTS.md.
 */
async function confirmInjectLoadingChain(target, autoYes = false) {
  const agentsPath = path.join(target, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) return false;
  let content = fs.readFileSync(agentsPath, 'utf-8');
  if (/每次任务开始前必须加载以下规则文件/.test(content)) return false; // already has it

  if (!autoYes) {
    console.log(`\n${yellow('═══ AGENTS.md 注入 ═══')}`);
    console.log('需要在 AGENTS.md 末尾添加 le-skills 规则加载链，确保 AI Agent 自动加载规则文件。');
    const ok = await askYesNo('是否注入规则加载链？', true);
    if (!ok) {
      console.log(cyan('  → 跳过'));
      return false;
    }
  }

  const backupPath = path.join(target, '.agents', '.le-skills-backup');
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  fs.copyFileSync(agentsPath, path.join(backupPath, 'AGENTS.md'));

  const injection = `\n---\n\n## le-skills 规则加载链\n\n> 本段由 le-skills install 自动注入\n\n**每次任务开始前必须加载以下规则文件：**\n- \`.agents/rules/project-rules.md\` — 全量加载，含任务分类铁律和技能入口映射\n- \`.agents/rules/skill-scheduling-rules.md\` — 按需加载，含难度判断/场景流程/开发工作流\n- \`.agents/rules/code-standards-rules.md\` — 按需加载，修改代码时应用\n- \`.agents/rules/version-management-rules.md\` — 按需加载，版本发布/CHANGELOG 时应用\n\n`;
  content += injection;
  fs.writeFileSync(agentsPath, content, 'utf-8');
  return true;
}

/**
 * Confirm and inject @AGENTS.md into CLAUDE.md.
 */
async function confirmInjectClaudeRef(target, autoYes = false) {
  const claudePath = path.join(target, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) return false;
  let content = fs.readFileSync(claudePath, 'utf-8');
  if (/@AGENTS\.md/.test(content)) return false; // already has it

  if (!autoYes) {
    console.log(`\n${yellow('═══ CLAUDE.md 注入 ═══')}`);
    console.log('需要在 CLAUDE.md 开头添加 @AGENTS.md 引用，确保 Claude Code 能加载 AGENTS.md 中的规则。');
    const ok = await askYesNo('是否添加 @AGENTS.md 引用？', true);
    if (!ok) {
      console.log(cyan('  → 跳过'));
      return false;
    }
  }

  const backupPath = path.join(target, '.agents', '.le-skills-backup');
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  fs.copyFileSync(claudePath, path.join(backupPath, 'CLAUDE.md'));

  content = `@AGENTS.md\n\n${content}`;
  fs.writeFileSync(claudePath, content, 'utf-8');
  return true;
}

// ---- Install Plan ----

function buildInstallPlan(target) {
  const projectType = detectProjectType(target);
  const existingDocs = scanExistingAiDocs(target);
  const existingSkillDirs = scanExistingSkillDirs(target);

  const hasAgents = !!existingDocs.AGENTS;
  const hasClaude = !!existingDocs.CLAUDE;
  const hasCursorRules = existingDocs.cursorRules && existingDocs.cursorRules.length > 0;
  const hasOtherSkills = existingSkillDirs.length > 0;

  // Scan for conflicts
  let versionConflict = false;
  let standardsConflict = false;
  let versionMatches = [];
  let standardsMatches = [];

  if (existingDocs.AGENTS) {
    versionMatches = scanVersionManagement(existingDocs.AGENTS);
    standardsMatches = scanCodeStandards(existingDocs.AGENTS);
    if (versionMatches.length > 0) versionConflict = true;
    if (standardsMatches.length > 0) standardsConflict = true;
  }
  if (existingDocs.CLAUDE) {
    const cv = scanVersionManagement(existingDocs.CLAUDE);
    const cs = scanCodeStandards(existingDocs.CLAUDE);
    if (cv.length > 0) versionConflict = true;
    if (cs.length > 0) standardsConflict = true;
    versionMatches = versionMatches.concat(cv);
    standardsMatches = standardsMatches.concat(cs);
  }

  const needsLoadingChain = existingDocs.AGENTS ? !hasLoadingChain(existingDocs.AGENTS) : false;
  const needsClaudeRef = existingDocs.CLAUDE ? !hasAgentsRef(existingDocs.CLAUDE) : false;

  return {
    projectType,
    hasAgents,
    hasClaude,
    hasCursorRules,
    hasOtherSkills,
    otherSkillDirs: existingSkillDirs,
    versionConflict,
    standardsConflict,
    versionMatches,
    standardsMatches,
    needsLoadingChain,
    needsClaudeRef,
  };
}

function showInstallPlan(target, plan) {
  const hasIssues = plan.versionConflict || plan.standardsConflict || plan.hasOtherSkills;

  console.log(`\n${cyan('═══════════════════════════════════════')}`);
  console.log(`${cyan('  le-skills Install Plan')}`);
  console.log(`${cyan('═══════════════════════════════════════')}`);
  console.log(`\n  ${cyan('Target:')}  ${target}`);
  console.log(`  ${cyan('Type:')}    ${plan.projectType}`);
  console.log();

  // AI docs
  console.log(`  ${cyan('AI Documents')}`);
  console.log(`    AGENTS.md        ${plan.hasAgents ? green('found') : yellow('not found')}`);
  console.log(`    CLAUDE.md        ${plan.hasClaude ? green('found') : yellow('not found')}`);
  if (plan.hasCursorRules) {
    console.log(`    .cursor/rules/   ${green(`${plan.cursorRules.length} rules found`)}`);
  }
  console.log();

  // Conflicts
  if (plan.versionConflict) {
    console.log(`  ${yellow('⚠ Version Management Conflict')}`);
    for (const m of plan.versionMatches) {
      console.log(`      L${m.line}: ${dim(m.text)}`);
    }
  }
  if (plan.standardsConflict) {
    console.log(`  ${yellow('⚠ Code Standards Conflict')}`);
    for (const m of plan.standardsMatches) {
      console.log(`      L${m.line}: ${dim(m.text)}`);
    }
  }
  if (!plan.versionConflict && !plan.standardsConflict) {
    console.log(`  ${green('No rule conflicts detected')}`);
  }
  console.log();

  // Existing skill dirs
  if (plan.hasOtherSkills) {
    console.log(`  ${yellow('Existing Skill Directories')}`);
    for (const d of plan.otherSkillDirs) {
      console.log(`    ${d.path} (${d.skills.length} skills)`);
    }
    console.log();
  }

  // Actions
  console.log(`  ${cyan('Actions to perform:')}`);
  console.log(`    ${green('1')} Copy .agents/  →  skills + rules`);
  if (plan.needsLoadingChain) {
    console.log(`    ${green('2')} Inject loading chain into AGENTS.md`);
  }
  if (plan.needsClaudeRef) {
    console.log(`    ${green('3')} Add @AGENTS.md reference to CLAUDE.md`);
  }
  if (plan.versionConflict) {
    console.log(`    ${yellow('?')} Extract version management rules → .agents/rules/`);
  }
  if (plan.standardsConflict) {
    console.log(`    ${yellow('?')} Extract code standards rules → .agents/rules/`);
  }
  console.log(`    ${green('4')} Copy scripts/`);
  console.log(`    ${green('5')} Generate INDEX.md`);
  console.log();

  if (hasIssues) {
    console.log(`  ${yellow('Some items require your input during install.')}\n`);
  } else {
    console.log(`  ${green('No conflicts — installation will proceed automatically.')}\n`);
  }
}

// ---- Commands ----

function cmdHelp() {
  console.log(`\
${green('le-skills v' + VERSION)}

${cyan('Usage:')}
  npx le-skills install [-y] [--preview] [target]
  npx le-skills check        [target]
  npx le-skills info         [target]
  npx le-skills list
  npx le-skills outdated
  npx le-skills update
  npx le-skills version / -v
  npx le-skills help / -h

${cyan('Install options:')}
  -y, --yes          Skip prompts, overwrite existing
  --preview          Show install plan only, do not install

${cyan('Examples:')}
  npx le-skills install                  Install into current directory
  npx le-skills install ../my-app        Install into ../my-app
  npx le-skills install --preview        Preview install plan
  npx le-skills install -y               Quiet install, overwrite existing
  npx le-skills check                    Check current directory
  npx le-skills info                     Show version + env + status
`);
}

function cmdVersion() {
  console.log(`le-skills v${VERSION}`);
}

// ---- list ----

function cmdList() {
  const skillsDir = path.join(PKG_DIR, '.agents', 'skills');

  if (!fs.existsSync(skillsDir)) {
    die('No skills found in package — package may be corrupted.');
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills = entries
    .filter((e) => e.isDirectory())
    .map((e) => {
      const skillMd = path.join(skillsDir, e.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) {
        return { name: e.name, desc: dim('(missing SKILL.md)') };
      }
      const content = fs.readFileSync(skillMd, 'utf-8');
      const match = content.match(/^description:\s*(.+)/m);
      const desc = match ? match[1].trim() : dim('(no description)');
      return { name: e.name, desc };
    });

  console.log(`\n${green(`Available skills (${skills.length})`)}\n`);
  for (const s of skills) {
    console.log(`  ${cyan(s.name)}`);
    console.log(`      ${s.desc}\n`);
  }

  // Rules
  const rulesDir = path.join(PKG_DIR, '.agents', 'rules');
  if (fs.existsSync(rulesDir)) {
    const rules = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md'));
    console.log(`${cyan(`Rules (${rules.length})`)}`);
    for (const r of rules) {
      const loadType = r === 'project-rules.md' ? 'always-load'
                     : r === 'code-standards-rules.md' || r === 'version-management-rules.md' ? 'on-demand (triggered)'
                     : 'on-demand';
      console.log(`  ${r.padEnd(35)} ${loadType}`);
    }
    console.log();
  }

  // Scripts
  const scriptsDir = path.join(PKG_DIR, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    const scripts = fs.readdirSync(scriptsDir);
    if (scripts.length > 0) {
      console.log(`${cyan('Scripts')}`);
      for (const s of scripts) {
        const compat = s.endsWith('.js') ? ' (cross-platform)' : s.endsWith('.sh') ? ' (bash)' : '';
        console.log(`  ${s}${compat}`);
      }
      console.log();
    }
  }
}

// ---- install ----

async function cmdInstall(targetDir, opts = {}) {
  const target = path.resolve(targetDir || process.cwd());
  const autoYes = opts.yes; // --yes: auto-answer "replace" but NEVER delete without asking

  // Validate target
  if (!fs.existsSync(target)) {
    die(`Target directory does not exist: ${target}`, EXIT.ERR_NO_TARGET);
  }
  if (!fs.statSync(target).isDirectory()) {
    die(`Target is not a directory: ${target}`, EXIT.ERR_NO_TARGET);
  }

  // Build and show install plan
  const plan = buildInstallPlan(target);
  showInstallPlan(target, plan);

  // --preview: stop here
  if (opts.preview) {
    console.log(`${green('Preview mode — no changes made.')}\n`);
    return;
  }

  // ── Per-section extraction (one section at a time) ──

  let extractedVersion = [];
  if (plan.versionConflict) {
    console.log(`\n${yellow('═══════════════════════════════════════')}`);
    console.log(`${yellow('  版本管理规则 — 逐段处理')}`);
    console.log(`${yellow('═══════════════════════════════════════')}`);
    extractedVersion = await extractSectionsInteractive(target, 'version', autoYes);
  }

  let extractedStandards = [];
  if (plan.standardsConflict) {
    console.log(`\n${yellow('═══════════════════════════════════════')}`);
    console.log(`${yellow('  代码规范规则 — 逐段处理')}`);
    console.log(`${yellow('═══════════════════════════════════════')}`);
    extractedStandards = await extractSectionsInteractive(target, 'standards', autoYes);
  }

  // ── Existing skill dirs ──
  if (plan.hasOtherSkills && !autoYes) {
    console.log(`\n${yellow('═══════════════════════════════════════')}`);
    console.log(`${yellow('  已有技能目录')}`);
    console.log(`${yellow('═══════════════════════════════════════')}`);
    for (const d of plan.otherSkillDirs) {
      console.log(`  检测到 ${d.path}（${d.skills.length} 个技能）`);
      if (d.skills.length > 0) {
        const action = await askChoice(
          `如何处理 ${d.path}？`,
          [
            '保持不动，le-skills 不管理此目录',
            '迁移到 .agents/skills/（保留原目录）',
            '迁移到 .agents/skills/（迁移后删除原目录）',
          ],
        );
        if (action === 0) {
          console.log(cyan(`  → ${d.path} 保持不动`));
        } else if (action === 1) {
          console.log(cyan(`  → ${d.path} 迁移（保留原目录）`));
        } else {
          console.log(cyan(`  → ${d.path} 迁移（完成后删除）`));
        }
      }
    }
  }

  // ── AGENTS.md / CLAUDE.md injection (confirm first) ──
  const chainInjected = await confirmInjectLoadingChain(target, autoYes);
  const claudeRefInjected = await confirmInjectClaudeRef(target, autoYes);

  // ── Copy .agents/ with per-file conflict resolution ──
  console.log(`\n${cyan('═══ 安装技能与规则 ═══')}\n`);

  if (fs.existsSync(AGENTS_SRC)) {
    const dest = path.join(target, '.agents');
    const result = await safeCopyRecursive(AGENTS_SRC, dest, '.agents', autoYes);
    console.log(green(`.agents/ 复制完成：${result.copied} 新增, ${result.replaced} 替换, ${result.kept} 跳过`));
  }

  // ── Save extracted rules (version + standards) ──
  if (extractedVersion.length > 0) {
    const vrmPath = path.join(target, '.agents', 'rules', 'version-management-rules.md');
    if (fs.existsSync(vrmPath)) {
      let vrmContent = fs.readFileSync(vrmPath, 'utf-8');
      const marker = '<!-- le-skills:project-custom -->';
      const markerIdx = vrmContent.indexOf(marker);
      if (markerIdx !== -1) {
        const before = vrmContent.slice(0, markerIdx + marker.length);
        const after = vrmContent.slice(markerIdx + marker.length);
        vrmContent = `${before}\n\n### 从项目 AGENTS.md 提取的规则\n\n${extractedVersion.join('\n\n---\n\n')}\n${after}`;
        fs.writeFileSync(vrmPath, vrmContent, 'utf-8');
        console.log(green(`版本管理规则已保存到 version-management-rules.md（${extractedVersion.length} 段）`));
      }
    }
  }

  if (extractedStandards.length > 0) {
    const csPath = path.join(target, '.agents', 'rules', 'code-standards-rules.md');
    if (fs.existsSync(csPath)) {
      let csContent = fs.readFileSync(csPath, 'utf-8');
      const marker = '<!-- le-skills:project-custom -->';
      const markerIdx = csContent.indexOf(marker);
      if (markerIdx !== -1) {
        const before = csContent.slice(0, markerIdx + marker.length);
        const after = csContent.slice(markerIdx + marker.length);
        csContent = `${before}\n\n### 从项目 AGENTS.md 提取的规则\n\n${extractedStandards.join('\n\n---\n\n')}\n${after}`;
        fs.writeFileSync(csPath, csContent, 'utf-8');
        console.log(green(`代码规范规则已保存到 code-standards-rules.md（${extractedStandards.length} 段）`));
      }
    }
  }

  // ── Copy scripts/ ──
  if (fs.existsSync(SCRIPTS_SRC)) {
    const dest = path.join(target, 'scripts');
    const result = await safeCopyRecursive(SCRIPTS_SRC, dest, 'scripts', autoYes);
    console.log(green(`scripts/ 复制完成：${result.copied} 新增, ${result.replaced} 替换, ${result.kept} 跳过`));
  }

  // ── Final confirmation before writing INDEX.md ──
  if (!autoYes) {
    console.log();
    const proceed = await askYesNo('确认完成安装？', true);
    if (!proceed) {
      console.log(yellow('Installation cancelled. Backup files are in .agents/.le-skills-backup/'));
      return;
    }
  }

  // ── Generate INDEX.md ──
  const indexContent = generateIndexMd(target);
  const indexDest = path.join(target, '.agents', 'skills', 'INDEX.md');
  fs.writeFileSync(indexDest, indexContent, 'utf-8');
  console.log(green('INDEX.md 已生成'));

  // ── Done ──
  const hasNodeBootstrap = fs.existsSync(path.join(target, 'scripts', 'bootstrap.js'));
  console.log(`\n${green('Installation complete!')}`);
  if (chainInjected) console.log(green('  AGENTS.md 规则加载链已注入'));
  if (claudeRefInjected) console.log(green('  CLAUDE.md @AGENTS.md 引用已注入'));

  console.log(cyan('Run the bootstrap check:'));
  if (hasNodeBootstrap) {
    console.log(`  node scripts/bootstrap.js`);
  } else {
    console.log(`  cd ${target} && bash scripts/bootstrap.sh`);
  }
  console.log(cyan('Then in your IDE, say: 「安装技能和规则」'));
  console.log();
}

// ---- check ----

function cmdCheck(targetDir) {
  const target = path.resolve(targetDir || process.cwd());

  // Try Node.js bootstrap first (cross-platform)
  const bootstrapJs = path.join(target, 'scripts', 'bootstrap.js');
  const bootstrapSh = path.join(target, 'scripts', 'bootstrap.sh');

  if (fs.existsSync(bootstrapJs)) {
    try {
      execSync(`node "${bootstrapJs}"`, {
        cwd: target,
        stdio: 'inherit',
      });
      return;
    } catch {
      process.exit(EXIT.ERR_UNKNOWN);
    }
  }

  if (fs.existsSync(bootstrapSh)) {
    try {
      execSync(`bash "${bootstrapSh}"`, {
        cwd: target,
        stdio: 'inherit',
      });
    } catch {
      process.exit(EXIT.ERR_UNKNOWN);
    }
    return;
  }

  die(`No bootstrap script found in ${target} — skills may not be installed.`, EXIT.ERR_NOT_INSTALLED);
}

// ---- info ----

function cmdInfo(targetDir) {
  const target = path.resolve(targetDir || process.cwd());

  console.log(`\n${green('le-skills — Package Info')}\n`);
  console.log(`  Version        ${VERSION}`);
  console.log(`  Package dir    ${PKG_DIR}`);
  console.log(`  Node.js        ${process.version}`);
  console.log(`  OS             ${process.platform} ${process.arch}`);
  console.log(`  TTY            ${process.stdout.isTTY ? 'yes' : 'no'}`);

  // npm registry latest
  const latest = getLatestVersion();
  if (latest) {
    if (latest === VERSION) {
      console.log(`  npm latest     ${latest} ${green('(up to date)')}`);
    } else {
      console.log(`  npm latest     ${latest} ${yellow(`(yours: ${VERSION})`)}`);
    }
  } else {
    console.log(`  npm latest     ${dim('(unable to check)')}`);
  }

  // Target project info
  console.log(`\n${green('Target project')}\n`);
  console.log(`  Path           ${target}`);
  console.log(`  Type           ${detectProjectType(target)}`);

  // AI docs status
  const agentsPath = path.join(target, 'AGENTS.md');
  const claudePath = path.join(target, 'CLAUDE.md');
  console.log(`  AGENTS.md      ${fs.existsSync(agentsPath) ? green('present') : yellow('absent')}`);
  console.log(`  CLAUDE.md      ${fs.existsSync(claudePath) ? green('present') : yellow('absent')}`);

  // Skills status
  if (isInstalled(target)) {
    const skillsDir = path.join(target, '.agents', 'skills');
    const count = fs.readdirSync(skillsDir).filter((e) => {
      return fs.statSync(path.join(skillsDir, e)).isDirectory();
    }).length;
    console.log(`  Skills         ${count} installed ${green('✓')}`);

    // Check loading chain
    if (fs.existsSync(agentsPath)) {
      const content = fs.readFileSync(agentsPath, 'utf-8');
      console.log(`  Loading chain  ${hasLoadingChain(content) ? green('present') : yellow('missing')}`);
    }
  } else {
    console.log(`  Skills         ${yellow('not installed')}`);
  }

  console.log();
}

// ---- outdated ----

function cmdOutdated() {
  const latest = getLatestVersion();
  if (!latest) {
    die('Unable to check npm registry. Are you online?');
  }

  if (latest === VERSION) {
    console.log(green(`le-skills v${VERSION} is up to date.`));
    process.exit(EXIT.OK);
  } else {
    console.log(yellow(`le-skills v${VERSION} installed, v${latest} available.`));
    console.log(cyan('  Run « npx le-skills update » to upgrade.'));
    process.exit(EXIT.ERR_OUTDATED);
  }
}

// ---- update ----

function cmdUpdate() {
  const latest = getLatestVersion();
  if (!latest) {
    die('Unable to check npm registry. Are you online?');
  }

  if (latest === VERSION) {
    console.log(green(`le-skills v${VERSION} is already the latest version.`));
    return;
  }

  console.log(cyan(`Updating le-skills: v${VERSION} → v${latest} …`));
  try {
    execSync(`npm install -g le-skills@latest`, {
      stdio: 'inherit',
    });
    console.log(green(`Updated to v${latest}.`));
  } catch {
    die('Update failed. Try: npm install -g le-skills@latest');
  }
}

// ---- Main ----

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || '--help';

  switch (cmd) {
    case 'install': {
      const yes = args.includes('-y') || args.includes('--yes');
      const preview = args.includes('--preview');
      const target = args.slice(1).find((a) => !a.startsWith('-'));
      // cmdInstall is now async
      cmdInstall(target, { yes, preview }).catch((err) => {
        die(`Install failed: ${err.message}`);
      });
      break;
    }
    case 'check':
      cmdCheck(args[1]);
      break;
    case 'info':
      cmdInfo(args[1]);
      break;
    case 'list':
      cmdList();
      break;
    case 'outdated':
      cmdOutdated();
      break;
    case 'update':
      cmdUpdate();
      break;
    case 'version':
    case '--version':
    case '-v':
      cmdVersion();
      break;
    case 'help':
    case '--help':
    case '-h':
      cmdHelp();
      break;
    default:
      console.error(red(`Unknown command: ${cmd}`));
      cmdHelp();
      process.exit(EXIT.ERR_UNKNOWN);
  }
}

main();
