// One-click release: builds the NSIS installer and publishes it to a GitHub
// Release for the current package.json version. The GitHub token is read from
// the GITHUB_TOKEN env var, or falls back to the local Git credential store
// (git credential fill). No secret is ever written to disk.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const version = pkg.version;
const tag = 'v' + version;
const repo = process.env.GH_REPO || 'DGoat/EggTools';

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const res = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  const m = /^password=(.*)$/m.exec(res.stdout || '');
  return m ? m[1].trim() : null;
}

function build() {
  console.log('> Building installer...');
  execSync('npm run dist', {
    cwd: root,
    stdio: 'inherit',
    env: Object.assign({}, process.env, {
      ELECTRON_BUILDER_BINARIES_MIRROR:
        process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
        'https://npmmirror.com/mirrors/electron-builder-binaries/'
    })
  });
}

function findInstaller() {
  const distDir = path.join(root, 'dist');
  const exe = fs.readdirSync(distDir).find((f) => f.toLowerCase().endsWith('.exe'));
  if (!exe) throw new Error('No .exe found in dist/. Build failed?');
  return { dir: distDir, file: exe };
}

async function main() {
  build();

  const token = getToken();
  if (!token) {
    throw new Error(
      'No GitHub token. Set GITHUB_TOKEN, or run `git push` once so the credential store has a token.'
    );
  }

  const { dir, file } = findInstaller();
  const assetName = file.replace(/\s+/g, '-');
  const api = `https://api.github.com/repos/${repo}`;
  const headers = {
    Authorization: `token ${token}`,
    'User-Agent': 'eggtools-release',
    Accept: 'application/vnd.github+json'
  };

  console.log(`> Publishing release ${tag} to ${repo}...`);

  let rel = await fetch(`${api}/releases/tags/${tag}`, { headers }).then((r) =>
    r.ok ? r.json() : null
  );

  if (!rel) {
    rel = await fetch(`${api}/releases`, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify({
        tag_name: tag,
        target_commitish: 'main',
        name: `Sticky Notes ${tag}`,
        body: `Sticky Notes desktop app ${tag}. Download the NSIS installer below and run it.`,
        draft: false,
        prerelease: false
      })
    }).then((r) => r.json());
    if (!rel.id) throw new Error('Create release failed: ' + JSON.stringify(rel));
  }

  const existing = (rel.assets || []).find((a) => a.name === assetName);
  if (existing) {
    console.log('> Replacing existing asset...');
    await fetch(`${api}/releases/assets/${existing.id}`, { method: 'DELETE', headers });
  }

  console.log(`> Uploading ${assetName}...`);
  const data = fs.readFileSync(path.join(dir, file));
  const up = await fetch(
    `https://uploads.github.com/repos/${repo}/releases/${rel.id}/assets?name=${encodeURIComponent(assetName)}`,
    {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/octet-stream' }, headers),
      body: data
    }
  ).then((r) => r.json());

  console.log('\nRelease: ' + rel.html_url);
  if (up.browser_download_url) console.log('Asset:   ' + up.browser_download_url);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
