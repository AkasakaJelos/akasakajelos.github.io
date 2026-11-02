'use strict';

// Post-build check for the policy integrations/site-csp.mjs injects. Run against
// the build output directory (default: dist):
//
//     node tools/verify-csp.cjs [dir] [--site-wide]
//
// Every HTML page must carry exactly one CSP meta tag, inside <head> and ahead of
// the first <script>. script-src must not contain any source that would make
// hashing pointless, the SHA-256 of every inline <script> must appear in it, and no
// inline event handlers or javascript: URLs may remain.
//
// This is deliberately independent of integrations/site-csp.mjs: it checks the
// shipped HTML, not the code that produced it, and errs towards failing.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCRIPT_TAG = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
const META_TAG = /<meta\b[^>]*>/gi;
const OPEN_TAG = /<[a-zA-Z][^>]*>/g;

// Any of these in script-src lets script run without matching a hash.
// 'wasm-unsafe-eval' is intentionally absent: it permits WebAssembly compilation
// only, not string-to-code evaluation.
const WEAK_SCRIPT_SOURCES = [
  "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", '*', 'http:', 'https:', 'data:', 'blob:'
];

function listHtml (dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listHtml(p));
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function attr (tag, name) {
  const m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  if (!m) return null;
  return m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
}

// Matched on the attribute, not on one literal spelling, so a second policy written
// in a different attribute order or self-closing form is still counted. Browsers
// enforce every CSP meta they see, so a stray one could block hashed scripts.
function findCspMetas (html) {
  const metas = [];
  for (const m of html.matchAll(META_TAG)) {
    if ((attr(m[0], 'http-equiv') || '').toLowerCase() !== 'content-security-policy') continue;
    metas.push({ index: m.index, policy: attr(m[0], 'content') || '' });
  }
  return metas;
}

// Conservative on purpose: only JSON data blocks are exempt. importmap,
// speculationrules and legacy JavaScript MIME types are all governed by script-src.
function needsHash (attrs) {
  if (/\ssrc\s*=/i.test(attrs)) return false;
  const type = attrs.match(/\stype\s*=\s*["']?([^"'\s>]+)/i);
  return !(type && /^application\/(ld\+)?json$/i.test(type[1]));
}

function checkPage (html) {
  const problems = [];

  const metas = findCspMetas(html);
  if (metas.length !== 1) problems.push('expected 1 CSP meta tag, found ' + metas.length);
  const csp = metas[0];
  if (csp) {
    const headEnd = html.search(/<\/head>/i);
    if (headEnd === -1 || csp.index > headEnd) problems.push('CSP meta is outside <head>');
    // A policy delivered by <meta> does not cover scripts parsed before it.
    const firstScript = html.search(/<script[\s>]/i);
    if (firstScript !== -1 && firstScript < csp.index) problems.push('a <script> precedes the CSP meta');
  }

  const charset = html.search(/<meta[^>]+charset=/i);
  if (charset === -1) problems.push('no charset meta');
  else if (Buffer.byteLength(html.slice(0, charset), 'utf8') > 1024) problems.push('charset meta is not within the first 1024 bytes');

  const policy = csp ? csp.policy : '';
  const scriptSrc = policy.split(';').map(s => s.trim()).find(s => /^script-src\s/i.test(s)) || '';
  const sources = scriptSrc.split(/\s+/).slice(1);
  if (!scriptSrc) problems.push('no script-src directive');
  for (const weak of WEAK_SCRIPT_SOURCES) {
    if (sources.includes(weak)) problems.push('script-src contains ' + weak);
  }

  let hashed = 0;
  for (const [, attrs, body] of html.matchAll(SCRIPT_TAG)) {
    if (!needsHash(attrs)) continue;
    const hash = "'sha256-" + crypto.createHash('sha256').update(body, 'utf8').digest('base64') + "'";
    if (sources.includes(hash)) hashed++;
    else problems.push('inline script not in script-src: ' + JSON.stringify(body.trim().slice(0, 60)));
  }

  // Scoped to tags, so prose like "online = ..." is not mistaken for a handler, and
  // without requiring a quote, so unquoted onclick=go() is still caught.
  const handlers = new Set();
  let jsUrls = 0;
  for (const [tag] of html.replace(SCRIPT_TAG, '').matchAll(OPEN_TAG)) {
    for (const h of tag.matchAll(/\s(on[a-z]+)\s*=/gi)) handlers.add(h[1].toLowerCase());
    if (/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(tag)) jsUrls++;
  }
  if (handlers.size) problems.push('inline event handlers: ' + Array.from(handlers).join(', '));
  if (jsUrls) problems.push(jsUrls + ' javascript: URL(s), which CSP blocks');

  return { problems, hashed, policy };
}

// swup's head updates insert each page's <meta> CSP, and browsers intersect
// every policy they have seen. Under client-side navigation the policy must
// therefore be byte-identical on every page.
function checkSiteWide (policies) {
  const distinct = new Set(policies);
  if (distinct.size <= 1) return null;
  return distinct.size + ' distinct policies across pages; swup head updates would intersect them';
}

function main () {
  const args = process.argv.slice(2);
  const siteWide = args.includes('--site-wide');
  const dir = args.find(a => !a.startsWith('--')) || 'dist';
  if (!fs.existsSync(dir)) {
    console.error('[verify-csp] ' + dir + ' does not exist; build the site first');
    process.exitCode = 1;
    return;
  }

  const pages = listHtml(dir);
  // An empty directory would otherwise pass vacuously.
  if (pages.length === 0) {
    console.error('[verify-csp] no HTML files under ' + dir);
    process.exitCode = 1;
    return;
  }

  let failing = 0;
  const policies = [];
  for (const page of pages) {
    const { problems, hashed, policy } = checkPage(fs.readFileSync(page, 'utf8'));
    policies.push(policy);
    if (problems.length === 0) {
      console.log('ok   ' + page + ' (' + hashed + ' inline scripts hashed)');
      continue;
    }
    failing++;
    console.log('FAIL ' + page);
    for (const p of problems) console.log('       - ' + p);
  }

  const siteWideProblem = siteWide ? checkSiteWide(policies) : null;
  if (siteWideProblem) console.log('FAIL site-wide: ' + siteWideProblem);

  console.log('\n[verify-csp] ' + pages.length + ' pages checked, ' + failing + ' failing' +
    (siteWide ? ', site-wide ' + (siteWideProblem ? 'FAIL' : 'ok') : ''));
  // exitCode rather than exit(): exit() can truncate output still buffered for a pipe.
  if (failing || siteWideProblem) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { checkPage, checkSiteWide };
