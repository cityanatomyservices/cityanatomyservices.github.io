'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const QRCode = require('qrcode');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'template', 'promo-template.html');
const REPORTS_DIR = path.join(ROOT, 'reports');
const OUT_DIR = path.join(ROOT, 'out');
const GSAP_SRC = path.join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js');

// pool-openings maps to a non-standard output path (capital P/O)
const OUTPUT_PATHS = {
  'pool-openings': '../../apps/reports/PoolOpenings/promo.mp4',
};

function outputPath(slug) {
  return OUTPUT_PATHS[slug] || `../../apps/reports/${slug}/promo.mp4`;
}

const args = process.argv.slice(2);
const shouldRender = args.includes('--render');
const slugArg = args.find(a => !a.startsWith('--')) || null;

async function main() {
  const template = fs.readFileSync(TEMPLATE, 'utf-8');

  const slugs = slugArg
    ? [slugArg]
    : fs.readdirSync(REPORTS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.slice(0, -5));

  for (const slug of slugs) {
    const configPath = path.join(REPORTS_DIR, `${slug}.json`);
    if (!fs.existsSync(configPath)) {
      console.error(`Missing config: reports/${slug}.json`);
      process.exit(1);
    }

    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const qrUrl = `https://anatomy.city${cfg.appPath}`;

    // Generate QR code as inline SVG — no CDN needed at render time
    const qrSvgRaw = await QRCode.toString(qrUrl, {
      type: 'svg',
      color: { dark: '#111111', light: '#ffffff' },
      margin: 1,
    });
    const qrSvg = qrSvgRaw.replace(/^<\?xml[^>]*\?>\s*/, '').trim();

    const html = template
      .replaceAll('{{SLUG}}', slug)
      .replaceAll('{{TITLE}}', cfg.title)
      .replaceAll('{{EYEBROW}}', cfg.eyebrow)
      .replaceAll('{{NARRATIVE}}', cfg.narrative)
      .replaceAll('{{ACCENT}}', cfg.accentColor)
      .replaceAll('{{QR_SVG}}', qrSvg);

    // Each slug gets its own subdirectory so `hyperframes render out/{slug}/`
    // matches the CLI's expected [dir] argument format.
    const slugDir = path.join(OUT_DIR, slug);
    fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(path.join(slugDir, 'index.html'), html, 'utf-8');
    fs.copyFileSync(GSAP_SRC, path.join(slugDir, 'gsap.min.js'));
    console.log(`Built: out/${slug}/index.html`);

    if (shouldRender) {
      const mp4Out = outputPath(slug);
      console.log(`Rendering ${slug} → ${mp4Out}`);
      execSync(
        `npx hyperframes render "${slugDir}" --fps 30 --output "${mp4Out}"`,
        { stdio: 'inherit', cwd: ROOT }
      );
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
