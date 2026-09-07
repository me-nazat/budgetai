#!/usr/bin/env node

/**
 * @fileoverview CI Translation Coverage Check
 * Asserts 100% translation key parity between en.json and bn.json,
 * and validates that every t('key') call in the codebase resolves in both locale files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const enPath = path.join(srcDir, 'locales', 'en.json');
const bnPath = path.join(srcDir, 'locales', 'bn.json');

console.log('🔍 Running i18n Translation Coverage Check...');

if (!fs.existsSync(enPath) || !fs.existsSync(bnPath)) {
  console.error('❌ Missing locale files (en.json or bn.json).');
  process.exit(1);
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const bn = JSON.parse(fs.readFileSync(bnPath, 'utf8'));

function flattenKeys(obj, prefix = '') {
  let keys = [];
  for (const k in obj) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(flattenKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const enKeys = new Set(flattenKeys(en));
const bnKeys = new Set(flattenKeys(bn));

console.log(`📦 Dictionary Keys: en=${enKeys.size}, bn=${bnKeys.size}`);

// 1. Cross-dictionary parity check
const missingInBn = [...enKeys].filter((k) => !bnKeys.has(k));
const missingInEn = [...bnKeys].filter((k) => !enKeys.has(k));

let hasErrors = false;

if (missingInBn.length > 0) {
  console.error(`❌ ${missingInBn.length} keys present in en.json are missing in bn.json:`);
  missingInBn.slice(0, 20).forEach((k) => console.error(`   - ${k}`));
  if (missingInBn.length > 20) console.error(`   ... and ${missingInBn.length - 20} more`);
  hasErrors = true;
}

if (missingInEn.length > 0) {
  console.error(`❌ ${missingInEn.length} keys present in bn.json are missing in en.json:`);
  missingInEn.slice(0, 20).forEach((k) => console.error(`   - ${k}`));
  if (missingInEn.length > 20) console.error(`   ... and ${missingInEn.length - 20} more`);
  hasErrors = true;
}

// 2. Scan source code for t('...') calls
function walkSource(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '__tests__') {
        results = results.concat(walkSource(fullPath));
      }
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      results.push(fullPath);
    }
  }
  return results;
}

const sourceFiles = walkSource(srcDir);
const tRegex = /\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
const usedKeys = new Map(); // key -> list of files

for (const filePath of sourceFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = tRegex.exec(content)) !== null) {
    const key = match[1];
    if (!usedKeys.has(key)) {
      usedKeys.set(key, []);
    }
    usedKeys.get(key).push(path.relative(rootDir, filePath));
  }
}

console.log(`🔎 Found ${usedKeys.size} distinct t() call keys across ${sourceFiles.length} source files.`);

const unmappedInEn = [];
const unmappedInBn = [];

for (const [key, files] of usedKeys.entries()) {
  if (!enKeys.has(key)) {
    unmappedInEn.push({ key, files });
  }
  if (!bnKeys.has(key)) {
    unmappedInBn.push({ key, files });
  }
}

if (unmappedInEn.length > 0) {
  console.error(`❌ ${unmappedInEn.length} t() calls have no translation key in en.json:`);
  unmappedInEn.forEach(({ key, files }) => {
    console.error(`   - "${key}" used in ${files[0]}`);
  });
  hasErrors = true;
}

if (unmappedInBn.length > 0) {
  console.error(`❌ ${unmappedInBn.length} t() calls have no translation key in bn.json:`);
  unmappedInBn.forEach(({ key, files }) => {
    console.error(`   - "${key}" used in ${files[0]}`);
  });
  hasErrors = true;
}

if (hasErrors) {
  console.error('\n💥 i18n check FAILED! All t() calls and locale files must have 100% key parity.\n');
  process.exit(1);
}

console.log(`✅ 100% translation coverage confirmed! (${enKeys.size} keys verified in en & bn).\n`);
process.exit(0);
