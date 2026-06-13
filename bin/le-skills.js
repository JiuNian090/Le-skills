#!/usr/bin/env node
// ============================================================
// le-skills — Project skills & rules CLI
// ============================================================
//   npx le-skills install [target]     Install skills into a project
//   npx le-skills check   [target]     Check installation status
//   npx le-skills info    [target]     Show detailed package + system info
//   npx le-skills list                 List available skills & rules
//   npx le-skills outdated             Check if a newer version exists
//   npx le-skills update               Self-update to latest version
//   npx le-skills version              Show version
//   npx le-skills --help               Show this help
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
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

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
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

// ---- Commands ----

function cmdHelp() {
  console.log(`\
${green('le-skills v' + VERSION)}

${cyan('Usage:')}
  npx le-skills install [-y] [target]   Install skills & rules into a project
  npx le-skills check        [target]   Check installation status
  npx le-skills info         [target]   Show detailed package + system info
  npx le-skills list                     List available skills & rules
  npx le-skills outdated                 Check if a newer npm version exists
  npx le-skills update                   Self-update to latest version
  npx le-skills version / -v            Show version
  npx le-skills help / -h               Show this help

${cyan('Install options:')}
  -y, --yes          Skip "already installed" warning (for CI/scripts)

${cyan('Examples:')}
  npx le-skills install                  Install into current directory
  npx le-skills install ../my-app        Install into ../my-app
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
      const loadType = r === 'project-rules.md' ? 'always-load' : 'on-demand';
      console.log(`  ${r.padEnd(30)} ${loadType}`);
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
        console.log(`  ${s}`);
      }
      console.log();
    }
  }
}

// ---- install ----

function cmdInstall(targetDir, opts = {}) {
  const target = path.resolve(targetDir || process.cwd());

  // Validate target
  if (!fs.existsSync(target)) {
    die(`Target directory does not exist: ${target}`, EXIT.ERR_NO_TARGET);
  }
  if (!fs.statSync(target).isDirectory()) {
    die(`Target is not a directory: ${target}`, EXIT.ERR_NO_TARGET);
  }

  // Check if already installed
  if (isInstalled(target)) {
    if (opts.yes) {
      // --yes mode: overwrite (remove then reinstall)
      console.log(cyan('Reinstalling (--yes) …'));
      fs.rmSync(path.join(target, '.agents'), { recursive: true, force: true });
      fs.rmSync(path.join(target, 'scripts'), { recursive: true, force: true });
    } else {
      console.log(yellow('Skills already installed in this project.'));
      console.log(cyan('  Run « npx le-skills check ' + target + ' » to verify status.'));
      console.log(cyan('  Use --yes to reinstall: npx le-skills install --yes'));
      process.exit(EXIT.ERR_ALREADY_INSTALLED);
    }
  }

  console.log(cyan(`Installing skills into: ${target}\n`));

  // Copy .agents/
  if (fs.existsSync(AGENTS_SRC)) {
    const dest = path.join(target, '.agents');
    copyRecursive(AGENTS_SRC, dest);
    console.log(green('.agents/  →  copied'));
  }

  // Copy scripts/
  if (fs.existsSync(SCRIPTS_SRC)) {
    const dest = path.join(target, 'scripts');
    copyRecursive(SCRIPTS_SRC, dest);
    console.log(green('scripts/ →  copied'));
  }

  // Done
  console.log(`\n${green('Installation complete!')}`);
  console.log(cyan('Run the bootstrap check:'));
  console.log(`  cd ${target} && bash scripts/bootstrap.sh`);
  console.log(cyan('Then in your IDE, say: 「安装技能和规则」'));
}

// ---- check ----

function cmdCheck(targetDir) {
  const target = path.resolve(targetDir || process.cwd());
  const bootstrap = path.join(target, 'scripts', 'bootstrap.sh');

  if (!fs.existsSync(bootstrap)) {
    die(`bootstrap.sh not found in ${target} — skills may not be installed.`, EXIT.ERR_NOT_INSTALLED);
  }

  try {
    execSync(`bash "${bootstrap}"`, {
      cwd: target,
      stdio: 'inherit',
    });
  } catch {
    process.exit(EXIT.ERR_UNKNOWN);
  }
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

  // Detect project type
  for (const [file, label] of [
    ['package.json', 'Node.js / Frontend'],
    ['pyproject.toml', 'Python'],
    ['requirements.txt', 'Python'],
    ['Cargo.toml', 'Rust'],
    ['go.mod', 'Go'],
  ]) {
    if (fs.existsSync(path.join(target, file))) {
      console.log(`  Type           ${label}`);
      break;
    }
  }

  // Skills status
  if (isInstalled(target)) {
    const skillsDir = path.join(target, '.agents', 'skills');
    const count = fs.readdirSync(skillsDir).filter((e) => {
      return fs.statSync(path.join(skillsDir, e)).isDirectory();
    }).length;
    console.log(`  Skills         ${count} installed ${green('✓')}`);

    // Check for outdated scripts vs. package
    const localBootstrap = path.join(target, 'scripts', 'bootstrap.sh');
    const pkgBootstrap = path.join(PKG_DIR, 'scripts', 'bootstrap.sh');
    if (fs.existsSync(localBootstrap) && fs.existsSync(pkgBootstrap)) {
      const localSize = fs.statSync(localBootstrap).size;
      const pkgSize = fs.statSync(pkgBootstrap).size;
      if (localSize !== pkgSize) {
        console.log(`  Scripts        ${yellow('out of date — reinstall with --yes')}`);
      } else {
        console.log(`  Scripts        up to date`);
      }
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
      // Parse -y / --yes flag
      const yes = args.includes('-y') || args.includes('--yes');
      // Target is the first non-flag argument after the command
      const target = args.slice(1).find((a) => !a.startsWith('-'));
      cmdInstall(target, { yes });
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
