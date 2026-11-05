import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const date = new Date().toISOString().slice(0, 10);

execSync('npm version patch --no-git-tag-version', { stdio: 'inherit' });

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const changelogPath = 'CHANGELOG.md';
const log = readFileSync(changelogPath, 'utf8');
const header = '## [Unreleased]';
const start = log.indexOf(header);

if (start < 0) {
  throw new Error('CHANGELOG.md needs an ## [Unreleased] section');
}

const bodyStart = start + header.length;
const nextHeading = log.indexOf('\n## ', bodyStart);
const unreleased = (nextHeading === -1 ? log.slice(bodyStart) : log.slice(bodyStart, nextHeading)).trim();
const rest = nextHeading === -1 ? '' : log.slice(nextHeading + 1);

let notes = unreleased;
if (!notes) {
  let range = 'HEAD';
  try {
    const tag = execSync('git describe --tags --abbrev=0 --match "v[0-9]*"', {
      encoding: 'utf8',
    }).trim();
    range = `${tag}..HEAD`;
  } catch {
    range = 'HEAD';
  }
  const subjects = execSync(`git log ${range} --pretty=format:%s --no-merges`, {
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('Release '));
  notes = subjects.length
    ? `### Changed\n\n${subjects.map((line) => `- ${line}`).join('\n')}`
    : '### Changed\n\n- Patch release.';
}

const entry = `## [${version}] - ${date}\n\n${notes}\n`;
const updated = `${log.slice(0, start)}${header}\n\n${entry}\n${rest}`;
writeFileSync(changelogPath, updated.endsWith('\n') ? updated : `${updated}\n`);

if (process.env.RELEASE_NOTES_PATH) {
  writeFileSync(process.env.RELEASE_NOTES_PATH, `${notes}\n`);
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}

console.log(version);
