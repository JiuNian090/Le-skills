#!/usr/bin/env node
// ============================================================
// psm — Project Skills Manager CLI
// ============================================================
//   npx psm install [-y] [--preview] [target]
//   npx psm check   [target]
//   npx psm info    [target]
//   npx psm list
//   npx psm outdated
//   npx psm update
//   npx psm version
//   npx psm --help
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
 * Read the skills registry JSON from the package.
 * Returns the parsed registry object, or null if not found.
 */
function readRegistry() {
  const registryPath = path.join(PKG_DIR, '.agents', 'skills-registry.json');
  if (!fs.existsSync(registryPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read user's custom skills-config.json from the target project.
 * Returns an object with customSources/ignore/alwaysInstall, or empty defaults.
 */
function readUserConfig(target) {
  const configPath = path.join(target || '.', '.agents', 'skills-config.json');
  if (!fs.existsSync(configPath)) return { customSources: [], ignore: [], alwaysInstall: [] };
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return { customSources: [], ignore: [], alwaysInstall: [] };
  }
}

/**
 * Create a timestamped backup of a path before modifying it.
 * Returns the backup path or null if nothing was backed up.
 */
function backupPath(target, relPath) {
  const source = path.join(target, relPath);
  if (!fs.existsSync(source)) return null;

  const ts = Date.now();
  const backupDir = path.join(target, '.agents', '.psm-backup', String(ts));
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
      '替换为 psm 版本（原文件备份到 .agents/.psm-backup/）',
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
    console.log(`\n${dim('--- psm version (new)')}`);
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
    const out = execSync('npm view psm version', {
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
 * Check if AGENTS.md already has psm skill tree entry injected.
 */
function hasLoadingChain(content) {
  return /psm 技能树入口/.test(content);
}

/**
 * Check if CLAUDE.md already has @AGENTS.md reference.
 */
function hasAgentsRef(content) {
  return /@AGENTS\.md/.test(content);
}

// ---- INDEX.md Generation ----

function generateIndexMd(target) {
  var NL = String.fromCharCode(92,110);
  var BK = String.fromCharCode(96);
  var Q = String.fromCharCode(34);
  const agentsSkills = path.join(target, ".agents", "skills");
  const agentsRules = path.join(target, ".agents", "rules");
  const skills = [];
  if (fs.existsSync(agentsSkills)) {
    for (const entry of fs.readdirSync(agentsSkills, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(agentsSkills, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, "utf-8");
      const name = content.match(/^name:s*(.+)/m)?.[1]?.trim() || entry.name;
      const desc = content.match(/^description:s*(.+)/m)?.[1]?.trim() || "(no description)";
      const treePath = content.match(/^tree:s*(.+)/m)?.[1]?.trim() || "";
      skills.push({ dir: entry.name, name, desc, treePath });
    }
  }
  const labels = { lifecycle: "🔧 生命周期管理", schedule: "📋 任务调度", release: "📦 版本发布" };
  const treeMap = {};
  for (const s of skills) {
    if (s.treePath === "root") continue;
    const parts = s.treePath.split("/");
    const l1Key = parts[0] || "other";
    if (!treeMap[l1Key]) treeMap[l1Key] = { label: labels[l1Key] || l1Key, children: [] };
    treeMap[l1Key].children.push({ dir: s.dir, name: s.name, desc: s.desc });
  }
  const l1Keys = Object.keys(treeMap);
  let md = "# 技能树 INDEX" + NL + NL;
  md += "> 🎯**任何 AI Agent / AI IDE 的统一导航入口** — 安装后优先读取此文件了解技能结构" + NL;
  md += "> 由 psm install 自动生成 — 运行 " + BK + "npx psm install --yes" + BK + " 重新生成" + NL + NL;
  md += "---" + NL + NL;
  md += "## 🌳 技能树总览" + NL + NL + BK + BK + BK + NL;
  md += "L0: managing-project-skills（根节点 — 用户入口）" + NL + "  │" + NL;
  for (let i = 0; i < l1Keys.length; i++) {
    const node = treeMap[l1Keys[i]];
    const isLast = i === l1Keys.length - 1;
    md += (isLast ? "  └── " : "  ├── ") + "L1: " + node.label + NL;
    for (let j = 0; j < node.children.length; j++) {
      const c = node.children[j];
      const cJoin = j === node.children.length - 1 ? "        └── " : "  │     ├── ";
      md += cJoin + "L2: " + c.name + " — " + c.desc.slice(0, 60) + NL;
    }
  }
  md += BK + BK + BK + NL + NL;
  md += "---" + NL + NL;
  md += "## 🛭 导航指南（任何 Agent 通用）" + NL + NL;
  md += "### 1. 用户发来消息 → 2. 匹配 L1 类别 → 3. 加载 L2 技能" + NL + NL;
  md += "| 用户说/场景 | → 匹配 L1 | → 加载 L2 技能 |" + NL + "|------------|----------|---------------|" + NL;
  const triggers = { "installing-project-skills": "“安装/更新/卸载/查看技能”", "scheduling-project-skills": "多技能编排/判断难度", "generating-changelogs": "“更新更新日志为 vx.x.x”" };
  for (const key of l1Keys) {
    for (const child of treeMap[key].children) {
      const trigger = triggers[child.dir] || "相关任务";
      md += "| " + trigger + " | " + treeMap[key].label + " | " + BK + child.dir + BK + " |" + NL;
    }
  }
  md += "| “版本管理” / “版本规范” | 📦 版本发布 | 检查 " + BK + "version-management-rules.md" + BK + " |" + NL + NL;
  md += "> **调用方式：** 任何 Agent 读取此表后，根据用户输入匹配第二列 L1 类别，然后直接读取 L2 对应的 SKILL.md 文件并执行。" + NL + NL;
  md += "---" + NL + NL;
  md += "## 📂 文件索引" + NL + NL + "| 文件 | 树路径 | 用途 |" + NL + "|------|-------|------|" + NL;
  md += "| .agents/skills/managing-project-skills/SKILL.md | root | 根节点，L0 入口调度 |" + NL;
  for (const s of skills) {
    if (s.treePath === "root") continue;
    md += "| " + s.dir + "/SKILL.md | " + s.treePath + " | " + s.desc.slice(0, 60) + " |" + NL;
  }
  md += "---" + NL + NL;
  md += "## ⚡ 按需加载决策表" + NL + NL + "| 触发条件 | 操作 | 加载方式 |" + NL + "|---------|------|---------|" + NL;
  md += "| 用户说「更新更新日志」「发布」「打 tag」 | 读取 version-management-rules.md 并应用 | 按需加载 |" + NL;
  md += "| 用户说「修改代码」「新增」「提交代码」 | 读取 code-standards-rules.md 检查规范 | 按需加载 |" + NL;
  md += "| 用户说「安装/更新/卸载技能」 | 读取 skill-lifecycle-rules.md 执行生命周期 | 按需加载 |" + NL;
  md += "| 技能执行时编排任务 | 读取 skill-scheduling-rules.md 决定调度策略 | 按需加载 |" + NL;
  md += "| 用户说「更新更新日志为 vx.x.x」 | 读取 changelog-rules.md 生成更新日志 | 按需加载 |" + NL;
  md += "| 未匹配以上条件 | 仅使用 project-rules.md（已全量加载） | 全量加载 |" + NL + NL;
  md += "> **注意：** 本 INDEX.md 由 psm 维护。任何 AI IDE 均可通过读取此文件理解技能树结构。" + NL;
  return md;
}

// ---- Project Rules Generation ----

/**
 * Mapping from project type (as returned by detectProjectType) to
 * tech-stack code standards template file.
 */
const TECH_STACK_TEMPLATES = {
  'Node.js / Frontend': 'code-standards-node.md',
  'Python': 'code-standards-python.md',
  'Rust': 'code-standards-rust.md',
  'Go': 'code-standards-go.md',
};

/**
 * Generate a tech-stack-aware project-rules.md for the target project.
 * Combines the base template with the matching code standards snippet.
 */
function generateProjectRules(target) {
  const templateDir = path.join(PKG_DIR, '.agents', 'rules', 'templates');
  const baseTemplate = path.join(templateDir, 'project-rules-base.md');
  
  if (!fs.existsSync(baseTemplate)) {
    console.log(yellow('  project-rules.md 模板未找到，跳过动态生成'));
    return null;
  }

  let content = fs.readFileSync(baseTemplate, 'utf-8');
  const projectType = detectProjectType(target);
  const snippetName = TECH_STACK_TEMPLATES[projectType];

  if (snippetName) {
    const snippetPath = path.join(templateDir, snippetName);
    if (fs.existsSync(snippetPath)) {
      const snippet = fs.readFileSync(snippetPath, 'utf-8');
      content = content.replace('<!-- psm:code-standards -->', snippet);
      console.log(green(`  project-rules.md → ${projectType} 规范已注入`));
    }
  } else {
    // Unknown project type: inject a minimal generic section
    const generic = `<!-- psm:tech-stack-rules -->\n### 代码规范\n\n- 遵循项目已有代码风格（由 linters/formatters 强制执行）\n- 错误处理分级：用户可见错误 / 控制台日志 / 静默容错\n- 用户输入必须校验\n- 不硬编码密钥，通过环境变量注入\n`;
    content = content.replace('<!-- psm:code-standards -->', generic);
    console.log(yellow(`  project-rules.md → ${projectType}，使用通用规范`));
  }

  return content;
}

// ---- Rule Extraction (AGENTS.md + CLAUDE.md) ----

/**
 * Load psm default rule content for comparison.
 */
function getDefaultRuleContent(sectionType) {
  const ruleFile = sectionType === 'version' ? 'version-management-rules.md' : 'code-standards-rules.md';
  const pkgRulePath = path.join(PKG_DIR, '.agents', 'rules', ruleFile);
  if (!fs.existsSync(pkgRulePath)) return '';
  return fs.readFileSync(pkgRulePath, 'utf-8');
}

/**
 * Check if user content overlaps with psm default rules.
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
 * with similarity comparison against psm defaults.
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

  // Load psm default for comparison
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
  const backupDir = path.join(target, '.agents', '.psm-backup');
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

    // Compare with psm default
    let overlap = 0;
    if (defaultContent) {
      overlap = calcRuleOverlap(section.content, defaultContent);
      if (overlap > 0.3) {
        console.log(`  ${yellow('⚠ 此规则与 psm 默认规则相似度较高')} (${Math.round(overlap * 100)}%)`);
      }
    }

    // Build options
    const options = [
      `提取到 .agents/rules/${ruleFile}，${section.sourceFile} 中替换为引用`,
      `保留在 ${section.sourceFile} 原处，不提取`,
    ];
    if (overlap > 0.3) {
      options.push(`使用 psm 默认规则替换（丢弃此段）`);
    } else {
      options.push(`同时保留两处（拷贝到规则文件 + 保留 ${section.sourceFile} 原内容）`);
    }

    const choice = await askChoice(
      overlap > 0.3
        ? `此规则与 psm 默认规则 ${Math.round(overlap * 100)}% 相似，如何处理？`
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
      // Use psm default instead — don't extract user version
      console.log(cyan(`  → 使用 psm 默认规则，丢弃此段`));
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
 * Confirm and inject skill tree entry into AGENTS.md.
 */
async function confirmInjectLoadingChain(target, autoYes = false) {
  const agentsPath = path.join(target, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) return false;
  let content = fs.readFileSync(agentsPath, 'utf-8');
  if (/psm 技能树入口/.test(content)) return false; // already has it

  if (!autoYes) {
    console.log(`\n${yellow('═══ AGENTS.md 注入 ═══')}`);
    console.log('需要在 AGENTS.md 末尾添加 psm 技能树入口引用，确保 AI Agent 加载技能树。');
    const ok = await askYesNo('是否注入技能树入口引用？', true);
    if (!ok) {
      console.log(cyan('  → 跳过'));
      return false;
    }
  }

  const backupPath = path.join(target, '.agents', '.psm-backup');
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  fs.copyFileSync(agentsPath, path.join(backupPath, 'AGENTS.md'));

  const injection = `\n---\n## psm 技能树入口\n\n读取 \`.agents/skills/INDEX.md\` 了解技能树和按需加载规则。\n`;
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

  const backupPath = path.join(target, '.agents', '.psm-backup');
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
  console.log(`${cyan('  psm Install Plan')}`);
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
    console.log(`    ${green('2')} Add skill tree entry to AGENTS.md`);
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
${green('psm v' + VERSION)}

${cyan('Usage:')}
  npx psm install [-y] [--preview] [target]
  npx psm check        [target]
  npx psm info         [target]
  npx psm list
  npx psm registry
  npx psm discover     [target]
  npx psm outdated
  npx psm update
  npx psm version / -v
  npx psm help / -h

${cyan('Install options:')}
  -y, --yes          Skip prompts, overwrite existing
  --preview          Show install plan only, do not install

${cyan('Registry commands:')}
  npx psm registry              List all skill sources from registry
  npx psm discover [target]     Show skills matching this project's tech stack

${cyan('Tool commands:')}
  npx psm tool list [target]            List tools & installation status
  npx psm tool install <name> [target]  Install a tool (CLI or MCP)
  npx psm tool verify [target]          Verify installed tool commands work
  npx psm tool setup [target]           Scan skills & install missing tools

${cyan('Examples:')}
  npx psm install                  Install into current directory
  npx psm install ../my-app        Install into ../my-app
  npx psm install --preview        Preview install plan
  npx psm install -y               Quiet install, overwrite existing
  npx psm check                    Check current directory
  npx psm info                     Show version + env + status
  npx psm registry                 List available skill sources
  npx psm discover                 Discover matching skills for this project
  npx psm tool list                List tools and their status
  npx psm tool install codegraph   Install codegraph (CLI or MCP)
  npx psm tool setup               Auto-detect and install missing tools
  npx psm tool verify               Verify installed tool commands
`);
}

function cmdVersion() {
  console.log(`psm v${VERSION}`);
}

// ---- registry ----

function cmdRegistry() {
  const registry = readRegistry();
  if (!registry) {
    die('skills-registry.json not found in package.');
  }

  console.log(`\n${green('PSM Skill Registry')}`);
  console.log(`  Version: ${registry.version}`);
  console.log(`  Sources: ${registry.sources.length}\n`);

  for (const src of registry.sources) {
    const tag = src.selfManaged ? '🔄 self-managed'
              : src.filter === 'always' ? '✅ always'
              : '⚠️  tech-stack';
    console.log(`  ${cyan(src.name)} ${dim(`(${tag})`)}`);
    console.log(`      ${src.description}`);
    if (src.skills.length > 0) {
      console.log(`      Skills: ${src.skills.join(', ')}`);
    }
    if (src.filter === 'tech-stack' && src.match) {
      const deps = src.match.dependencies || [];
      const files = src.match.files || [];
      console.log(`      Matches: ${[...deps, ...files].join(', ')}`);
    }
    console.log();
  }
}

// ---- discover ----

function cmdDiscover(targetDir) {
  const target = path.resolve(targetDir || process.cwd());
  const registry = readRegistry();
  if (!registry) {
    die('skills-registry.json not found in package.');
  }

  // Detect tech stack
  const projectType = detectProjectType(target);
  const pkgJsonPath = path.join(target, 'package.json');
  let dependencies = [];
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      dependencies = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}));
    } catch {}
  }

  // Read user config
  const userConfig = readUserConfig(target);

  console.log(`\n${green('PSM Skill Discovery')}`);
  console.log(`  Project: ${target}`);
  console.log(`  Type:    ${projectType}`);
  console.log(`  Dependencies: ${dependencies.length > 0 ? dependencies.slice(0, 10).join(', ') + (dependencies.length > 10 ? '...' : '') : '(none detected)'}`);
  console.log();

  // Always-install sources
  const always = registry.sources.filter(s => s.filter === 'always' && !s.selfManaged);
  const techStack = registry.sources.filter(s => s.filter === 'tech-stack');
  const selfManaged = registry.sources.filter(s => s.selfManaged);

  console.log(`${green('✅ Always recommended')}`);
  for (const src of always) {
    console.log(`  ${cyan(src.name)} — ${src.description}`);
    console.log(`    Skills: ${src.skills.join(', ')}`);
  }
  console.log();

  // Tech-stack matched
  const matched = techStack.filter(src => {
    if (!src.match || !src.match.dependencies) return dependencies.length > 0;
    return src.match.dependencies.some(d => dependencies.includes(d));
  });
  if (matched.length > 0) {
    console.log(`${yellow('⚠️  Tech-stack matched (recommended)')}`);
    for (const src of matched) {
      console.log(`  ${cyan(src.name)} — ${src.description}`);
      console.log(`    Skills: ${src.skills.join(', ')}`);
    }
    console.log();
  }

  // Self-managed
  console.log(`${dim('🔄 Self-managed (install via their own CLI)')}`);
  for (const src of selfManaged) {
    console.log(`  ${dim(src.name)} — ${src.description}`);
  }
  console.log();

  // User custom sources
  if (userConfig.customSources.length > 0) {
    console.log(`${cyan('📦 Custom sources (from .agents/skills-config.json)')}`);
    for (const src of userConfig.customSources) {
      console.log(`  ${src.name} — ${src.description || '(no description)'}`);
    }
    console.log();
  }

  if (!always.length && !matched.length && !selfManaged.length && !userConfig.customSources.length) {
    console.log('  No skills matched your project.\n');
  }
}

// ---- Tool Management ----

/**
 * Read tool definitions from the skills registry.
 */
function readToolRegistry() {
  const registry = readRegistry();
  return registry?.tools?.items || [];
}

/**
 * Read the tool index from a target project.
 * Returns a map of tool name → tool info.
 */
function readToolIndex(target) {
  const indexPath = path.join(target || '.', '.agents', 'tools.json');
  if (!fs.existsSync(indexPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Write the tool index to a target project.
 * Index shape per tool:
 *   { installed, mode, version, path, commands: [{cmd, verified, lastOk}], verifiedAt }
 */
function writeToolIndex(target, index) {
  const dir = path.join(target, '.agents');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tools.json'), JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Check if a tool is currently available on the system PATH.
 */
function checkToolAvailable(name) {
  try {
    const result = execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${name}`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the full path of a tool binary.
 */
function getToolPath(name) {
  try {
    const result = execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${name}`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return result.trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

/**
 * Get the version of an installed tool.
 */
function getToolVersion(name) {
  try {
    const result = execSync(`${name} --version`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return result.trim().split('\n')[0];
  } catch {
    return 'unknown';
  }
}

/**
 * Test whether a specific subcommand works.
 * Returns { ok, output }.
 */
function testSubcommand(cmd) {
  try {
    const result = execSync(`${cmd} --help`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: result.trim().split('\n')[0] };
  } catch (e) {
    // Some tools don't have --help on every subcommand; try without args
    try {
      const result = execSync(`${cmd}`, {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { ok: true, output: result.trim().split('\n')[0] };
    } catch {
      return { ok: false, output: null };
    }
  }
}

/**
 * Verify all subcommands for a tool and return the verified list.
 */
function verifyToolCommands(toolDef) {
  if (!toolDef.commands || toolDef.commands.length === 0) return [];
  console.log(dim(`  验证命令可用性...`));
  return toolDef.commands.map(c => {
    const { ok } = testSubcommand(c.cmd);
    const status = ok ? green('✓') : yellow('⚠');
    console.log(`    ${status} ${c.cmd} — ${c.description}${ok ? '' : dim(' (不可用)')}`);
    return { cmd: c.cmd, description: c.description, verified: ok };
  });
}

/**
 * Find the IDE's MCP config path by detecting common IDEs.
 */
function getMcpConfigPath() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidates = [
    // Windows
    { path: path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cli', 'mcp.json'), name: 'Roo Code' },
    { path: path.join(home, '.cursor', 'mcp.json'), name: 'Cursor' },
    { path: path.join(home, '.windsurf', 'mcp.json'), name: 'Windsurf' },
    { path: path.join(home, '.codex', 'mcp.json'), name: 'Codex' },
    { path: path.join(home, '.claude', 'mcp.json'), name: 'Claude Code' },
  ];
  for (const c of candidates) {
    if (fs.existsSync(c.path)) return c;
  }
  return null;
}

/**
 * Write MCP server config to the IDE's MCP config file.
 */
function writeMcpConfig(toolName, mcpConfig) {
  const ide = getMcpConfigPath();
  if (!ide) {
    console.log(yellow(`  未检测到支持的 IDE。请手动配置 MCP。`));
    return false;
  }

  try {
    let config = { mcpServers: {} };
    if (fs.existsSync(ide.path)) {
      config = JSON.parse(fs.readFileSync(ide.path, 'utf-8'));
      if (!config.mcpServers) config.mcpServers = {};
    }

    // Add or update the tool's MCP config
    config.mcpServers[toolName] = {
      command: mcpConfig.command,
      args: mcpConfig.args || [],
    };

    fs.writeFileSync(ide.path, JSON.stringify(config, null, 2), 'utf-8');
    console.log(green(`  → MCP 配置已写入 ${ide.path}`));
    return true;
  } catch (e) {
    console.log(yellow(`  ⚠ 写入 MCP 配置失败: ${e.message}`));
    return false;
  }
}

// ---- cmd: tool install ----

async function cmdToolInstall(toolName, targetDir) {
  const target = path.resolve(targetDir || process.cwd());
  const tools = readToolRegistry();
  const tool = tools.find(t => t.name === toolName);

  if (!tool) {
    die(`未知工具: ${toolName}。可用工具: ${tools.map(t => t.name).join(', ')}`);
  }

  console.log(`\n${green(`安装工具: ${tool.name}`)}`);
  console.log(`  ${tool.description}`);
  console.log(`  ${dim(tool.homepage)}\n`);

  // Check if already installed
  if (checkToolAvailable(toolName)) {
    const ver = getToolVersion(toolName);
    const toolPath = getToolPath(toolName);
    console.log(green(`${toolName} 已安装 (${ver})`));
    console.log(dim(`  路径: ${toolPath}`));
    // Re-verify commands
    const cmds = verifyToolCommands(tool);
    const index = readToolIndex(target);
    index[toolName] = {
      installed: true, mode: 'cli', version: ver,
      path: toolPath, commands: cmds, verifiedAt: new Date().toISOString()
    };
    writeToolIndex(target, index);
    return;
  }

  // Ask: CLI or MCP?
  const options = [];
  if (tool.cli) options.push(`CLI — ${tool.cli.description}`);
  if (tool.mcp) options.push(`MCP — ${tool.mcp.description}`);
  options.push('取消');

  const choice = await askChoice(`选择 ${tool.name} 的安装方式`, options);

  if (choice === options.length - 1) {
    console.log(cyan('  → 取消安装'));
    return;
  }

  const isCli = choice === 0;

  if (isCli && tool.cli) {
    console.log(`\n${cyan(`安装 CLI: ${tool.cli.commands[0]}`)}`);
    for (const cmd of tool.cli.commands) {
      try {
        console.log(dim(`$ ${cmd}`));
        execSync(cmd, { stdio: 'inherit', timeout: 120000 });
      } catch {
        console.log(yellow(`  ⚠ 命令执行失败: ${cmd}`));
        if (!await askYesNo('继续尝试下一个安装方式？', false)) {
          return;
        }
      }
    }

    // Post-install setup
    if (tool.cli.postInstall && checkToolAvailable(toolName)) {
      console.log(`\n${cyan('运行安装后配置...')}`);
      try {
        execSync(tool.cli.postInstall, { stdio: 'inherit', timeout: 60000 });
      } catch {
        console.log(yellow(`  ⚠ 安装后配置失败: ${tool.cli.postInstall}`));
      }
    }

    // Verify: check path + each subcommand
    if (checkToolAvailable(toolName)) {
      const ver = getToolVersion(toolName);
      const toolPath = getToolPath(toolName);
      console.log(green(`\n${tool.name} CLI 安装成功 (${ver})`));
      const cmds = verifyToolCommands(tool);
      const index = readToolIndex(target);
      index[toolName] = {
        installed: true, mode: 'cli', version: ver,
        path: toolPath, commands: cmds, verifiedAt: new Date().toISOString()
      };
      writeToolIndex(target, index);
      console.log(green(`  命令索引已写入 .agents/tools.json`));
    } else {
      console.log(yellow(`\n⚠ ${tool.name} 安装可能未完成，请检查后重试。`));
    }
  } else if (!isCli && tool.mcp) {
    console.log(`\n${cyan('配置 MCP 服务器...')}`);

    // Try auto-setup first
    if (tool.mcp.autoSetup) {
      try {
        console.log(dim(`$ ${tool.cli?.postInstall || 'codegraph install'}`));
        execSync(tool.cli?.postInstall || 'codegraph install', { stdio: 'inherit', timeout: 60000 });
      } catch {
        console.log(yellow('  自动配置失败，尝试手动配置。'));
      }
    }

    // Write MCP config to IDE
    let mcpWritten = false;
    if (tool.mcp.config) {
      console.log(`\n${cyan('写入 MCP 配置...')}`);
      mcpWritten = writeMcpConfig(toolName, tool.mcp.config);

      if (!mcpWritten) {
        console.log(`\n${cyan('手动 MCP 配置:')}`);
        console.log(`  ${JSON.stringify(tool.mcp.config, null, 2)}`);
        console.log(`\n${dim('请将以上配置添加到你的 IDE 的 MCP 配置文件中。')}`);
        console.log(dim('Cursor: ~/.cursor/mcp.json'));
        console.log(dim('Windsurf: ~/.windsurf/mcp.json'));
        console.log(dim('Claude Code: claude mcp add'));
      }
    }

    const index = readToolIndex(target);
    index[toolName] = {
      installed: true, mode: 'mcp',
      mcpConfig: tool.mcp.config || null,
      mcpWrittenTo: mcpWritten ? getMcpConfigPath()?.path : null,
      commands: (tool.commands || []).map(c => ({ cmd: c.cmd, description: c.description, verified: false })),
      updatedAt: new Date().toISOString()
    };
    writeToolIndex(target, index);
    console.log(green(`\n${tool.name} MCP 配置已记录到 .agents/tools.json`));
  }
}

// ---- cmd: tool list ----

function cmdToolList(targetDir) {
  const target = path.resolve(targetDir || process.cwd());
  const tools = readToolRegistry();
  const index = readToolIndex(target);

  if (tools.length === 0) {
    console.log(yellow('注册中心中未定义工具。'));
    return;
  }

  console.log(`\n${green('工具清单')}\n`);
  for (const t of tools) {
    const available = checkToolAvailable(t.name);
    const recorded = index[t.name];

    // Status icon
    let status;
    if (available) {
      const cmdsOk = recorded?.commands?.every(c => c.verified === false) === false;
      status = cmdsOk ? green('✓ 已安装 (命令可用)') : green('✓ 已安装');
    } else if (recorded) {
      status = yellow(`已记录 (${recorded.mode})`);
    } else {
      status = dim('未安装');
    }

    const ver = available ? ` (${getToolVersion(t.name)})` : '';
    console.log(`  ${cyan(t.name)} ${status}${ver}`);

    if (available || recorded) {
      const mode = recorded?.mode || 'cli';
      const toolPath = recorded?.path || (available ? getToolPath(t.name) : '—');
      console.log(`      方式: ${mode}  路径: ${toolPath}`);
    }

    // Show recorded commands
    if (recorded?.commands?.length) {
      for (const c of recorded.commands) {
        const ok = c.verified ? green('✓') : dim('?');
        console.log(`      ${ok} ${c.cmd} — ${c.description || ''}`);
      }
    } else if (t.commands?.length) {
      // Show default commands from registry (not yet verified)
      for (const c of t.commands) {
        console.log(`      ${dim('·')} ${c.cmd} — ${c.description}`);
      }
    }
    console.log();
  }
}

// ---- cmd: tool setup ----

async function cmdToolSetup(targetDir) {
  const target = path.resolve(targetDir || process.cwd());
  const tools = readToolRegistry();
  const index = readToolIndex(target);

  // Scan skills for requires_tools
  const skillsDir = path.join(target, '.agents', 'skills');
  const requiredTools = new Set();

  // Add tools from registry self-managed sources (they depend on their own CLI)
  const registry = readRegistry();
  if (registry) {
    for (const src of registry.sources) {
      if (src.selfManaged) {
        requiredTools.add(src.name);
      }
    }
  }

  // Scan installed skills for requires_tools in frontmatter
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf-8');
      const match = content.match(/^requires_tools:\s*$/m);
      if (match) {
        const lines = content.slice(match.index).split('\n');
        for (let i = 1; i < lines.length; i++) {
          const toolMatch = lines[i].match(/^\s*-\s*(.+)/);
          if (toolMatch) requiredTools.add(toolMatch[1].trim());
          else break;
        }
      }
    }
  }

  if (requiredTools.size === 0) {
    console.log(green('未检测到需要安装的工具依赖。'));
    return;
  }

  console.log(`\n${cyan('检测到以下工具依赖:')}`);
  for (const t of requiredTools) {
    const available = checkToolAvailable(t);
    const recorded = index[t];
    if (!available && !recorded) {
      console.log(`  ${yellow(t)} — 未安装`);
    } else {
      console.log(`  ${green(t)} — ${available ? '已安装' : `已记录 (${recorded.mode})`}`);
    }
  }

  for (const t of requiredTools) {
    if (!checkToolAvailable(t) && !index[t]) {
      console.log();
      const ok = await askYesNo(`安装 ${t}？`, true);
      if (ok) {
        await cmdToolInstall(t, target);
      } else {
        console.log(cyan(`  → 跳过 ${t}`));
      }
    }
  }
}

// ---- cmd: tool verify ----

function cmdToolVerify(targetDir) {
  const target = path.resolve(targetDir || process.cwd());
  const tools = readToolRegistry();
  const index = readToolIndex(target);

  if (tools.length === 0) {
    console.log(yellow('注册中心中未定义工具。'));
    return;
  }

  console.log(`\n${green('验证工具命令可用性')}\n`);
  let allOk = true;

  for (const t of tools) {
    const available = checkToolAvailable(t.name);
    if (!available) {
      console.log(`  ${yellow(t.name)}  ${dim('未安装，跳过验证')}`);
      continue;
    }

    const ver = getToolVersion(t.name);
    const toolPath = getToolPath(t.name);
    console.log(`  ${cyan(t.name)} ${dim(`(${ver})`)}`);
    console.log(`    路径: ${toolPath}`);

    if (t.commands && t.commands.length > 0) {
      const verified = verifyToolCommands(t);
      // Update index
      index[t.name] = {
        ...(index[t.name] || {}),
        installed: true, mode: index[t.name]?.mode || 'cli',
        version: ver, path: toolPath,
        commands: verified, verifiedAt: new Date().toISOString()
      };
      const hasFailures = verified.some(c => !c.verified);
      if (hasFailures) allOk = false;
    } else {
      console.log(`    ${dim('无可验证的子命令')}`);
    }
  }

  writeToolIndex(target, index);
  console.log(allOk ? green('\n✓ 所有工具命令可用') : yellow('\n⚠ 部分子命令不可用，请检查工具安装'));
}

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
            '保持不动，psm 不管理此目录',
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

    // ── Generate tech-stack-aware project-rules.md ──
    const projectRulesContent = generateProjectRules(target);
    if (projectRulesContent) {
      const prPath = path.join(target, '.agents', 'rules', 'project-rules.md');
      fs.writeFileSync(prPath, projectRulesContent, 'utf-8');
      console.log(green('  project-rules.md 已根据技术栈生成'));
    }
  }

  // ── Save extracted rules (version + standards) ──
  if (extractedVersion.length > 0) {
    const vrmPath = path.join(target, '.agents', 'rules', 'version-management-rules.md');
    if (fs.existsSync(vrmPath)) {
      let vrmContent = fs.readFileSync(vrmPath, 'utf-8');
      const marker = '<!-- psm:project-custom -->';
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
      const marker = '<!-- psm:project-custom -->';
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
      console.log(yellow('Installation cancelled. Backup files are in .agents/.psm-backup/'));
      return;
    }
  }

  // ── Generate INDEX.md ──
  const indexContent = generateIndexMd(target);
  const indexDest = path.join(target, '.agents', 'skills', 'INDEX.md');
  fs.writeFileSync(indexDest, indexContent, 'utf-8');
  console.log(green('INDEX.md 已生成'));

  // ── Check tool dependencies ──
  console.log(`\n${cyan('═══ 检查工具依赖 ═══')}\n`);
  const registry = readRegistry();
  if (registry?.tools?.items) {
    const index = readToolIndex(target);
    for (const t of registry.tools.items) {
      const available = checkToolAvailable(t.name);
      const recorded = index[t.name];
      if (!available && !recorded) {
        console.log(`  ${yellow(t.name)} — ${t.description}`);
        if (!autoYes) {
          const ok = await askYesNo(`安装 ${t.name}？`, true);
          if (ok) {
            await cmdToolInstall(t.name, target);
          } else {
            console.log(cyan(`  → 跳过 ${t.name}`));
          }
        }
      } else {
        console.log(`  ${green(t.name)} ${available ? '✓ 已安装' : '✓ 已记录'}`);
      }
    }
  }
  console.log();

  // ── Done ──
  const hasNodeBootstrap = fs.existsSync(path.join(target, 'scripts', 'bootstrap.js'));
  console.log(`\n${green('Installation complete!')}`);
  if (chainInjected) console.log(green('  AGENTS.md 技能树入口已注入'));
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

  console.log(`\n${green('psm — Package Info')}\n`);
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

    // Check skill tree entry
    if (fs.existsSync(agentsPath)) {
      const content = fs.readFileSync(agentsPath, 'utf-8');
      console.log(`  Skill tree      ${hasLoadingChain(content) ? green('present') : yellow('missing')}`);
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
    console.log(green(`psm v${VERSION} is up to date.`));
    process.exit(EXIT.OK);
  } else {
    console.log(yellow(`psm v${VERSION} installed, v${latest} available.`));
    console.log(cyan('  Run « npx psm update » to upgrade.'));
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
    console.log(green(`psm v${VERSION} is already the latest version.`));
    return;
  }

  console.log(cyan(`Updating psm: v${VERSION} → v${latest} …`));
  try {
    execSync(`npm install -g psm@latest`, {
      stdio: 'inherit',
    });
    console.log(green(`Updated to v${latest}.`));
  } catch {
    die('Update failed. Try: npm install -g psm@latest');
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
    case 'registry':
      cmdRegistry();
      break;
    case 'discover':
      cmdDiscover(args[1]);
      break;
    case 'tool': {
      const sub = args[1];
      if (sub === 'install') {
        const toolName = args[2];
        if (!toolName) die('用法: psm tool install <工具名> [target]');
        cmdToolInstall(toolName, args[3]);
      } else if (sub === 'list') {
        cmdToolList(args[2]);
      } else if (sub === 'setup') {
        cmdToolSetup(args[2]);
      } else if (sub === 'verify') {
        cmdToolVerify(args[2]);
      } else {
        die(`未知 tool 子命令: ${sub}。可用: install, list, setup, verify`);
      }
      break;
    }
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
