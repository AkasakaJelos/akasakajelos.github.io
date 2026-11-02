'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const { checkPage, checkSiteWide } = require('./verify-csp.js');

const sha = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";

function page (script) {
  const csp = "default-src 'self'; script-src 'self' " + sha(script);
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/>' +
    '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
    '</head><body><script>' + script + '</script></body></html>';
}

test('a well-formed page passes and reports its policy', () => {
  const result = checkPage(page('a()'));
  assert.deepEqual(result.problems, []);
  assert.equal(result.hashed, 1);
  assert.match(result.policy, /^default-src 'self'; script-src /);
});

test('an unhashed inline script fails', () => {
  const html = page('a()').replace('</body>', '<script>b()</script></body>');
  assert.ok(checkPage(html).problems.some(p => p.startsWith('inline script not in script-src')));
});

test('an unquoted inline handler fails', () => {
  const html = page('a()').replace('<body>', '<body onclick=go()>');
  assert.ok(checkPage(html).problems.some(p => p.startsWith('inline event handlers')));
});

test('identical policies pass site-wide', () => {
  assert.equal(checkSiteWide(["script-src 'self'", "script-src 'self'"]), null);
});

test('differing policies fail site-wide', () => {
  const message = checkSiteWide(["script-src 'self'", "script-src 'self' 'sha256-x'"]);
  assert.match(message, /2 distinct policies/);
});
