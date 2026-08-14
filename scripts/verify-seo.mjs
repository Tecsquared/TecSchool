import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const failures = [];
const pass = (message) => console.log(`PASS ${message}`);
const fail = (message) => failures.push(message);
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const vercel = JSON.parse(read('vercel.json'));
const expectedRedirects = new Map([
  ['/english', '/english/'],
  ['/thai', '/thai/'],
  ['/chinese', '/chinese/'],
]);
for (const [source, destination] of expectedRedirects) {
  const rule = vercel.redirects?.find((item) => item.source === source);
  if (!rule || rule.destination !== destination || rule.permanent !== true) {
    fail(`missing permanent redirect ${source} -> ${destination}`);
  }
}
if (!failures.length) pass('canonical language redirects are configured');

const htmlFiles = ['index.html', 'english/index.html', 'thai/index.html', 'chinese/index.html'];
for (const file of htmlFiles) {
  const html = read(file);
  const jsonLd = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!jsonLd.length) fail(`${file} has no JSON-LD`);
  for (const [index, match] of jsonLd.entries()) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      fail(`${file} JSON-LD block ${index + 1} is invalid: ${error.message}`);
    }
  }
}
if (!failures.some((item) => item.includes('JSON-LD'))) pass('all landing-page JSON-LD blocks parse');

const nonCanonicalHref = /href=["']\/(english|thai|chinese)["']/g;
for (const file of fs.readdirSync(root, { recursive: true }).filter((item) => item.endsWith('.html'))) {
  const html = read(file);
  const matches = [...html.matchAll(nonCanonicalHref)];
  if (matches.length) fail(`${file} contains ${matches.length} non-canonical language link(s)`);
}
if (!failures.some((item) => item.includes('non-canonical'))) pass('all internal language links use trailing slashes');

const assetAttributes = /(?:src|poster|href)=["']([^"']+)["']/g;
for (const file of htmlFiles) {
  const html = read(file);
  for (const [, raw] of html.matchAll(assetAttributes)) {
    if (/^(?:https?:|mailto:|tel:|#|javascript:)/.test(raw) || raw.startsWith('/_vercel/')) continue;
    const clean = raw.split(/[?#]/)[0];
    if (!clean || clean.endsWith('/')) continue;
    const target = clean.startsWith('/')
      ? path.join(root, clean.slice(1))
      : path.resolve(path.dirname(path.join(root, file)), clean);
    if (!fs.existsSync(target)) fail(`${file} references missing local asset ${raw}`);
  }
}
if (!failures.some((item) => item.includes('missing local asset'))) pass('changed landing pages reference existing local assets');

const llmsLinks = [...read('llms.txt').matchAll(/\]\((https:\/\/www\.tecschool\.org\/[^)]+)\)/g)].map((match) => match[1]);
const duplicates = [...new Set(llmsLinks.filter((url, index) => llmsLinks.indexOf(url) !== index))];
if (duplicates.length) fail(`llms.txt contains duplicate URLs: ${duplicates.join(', ')}`);
else pass('llms.txt has no duplicate TEC URLs');

const sitemap = read('sitemap.xml');
for (const destination of expectedRedirects.values()) {
  if (!sitemap.includes(`<loc>https://www.tecschool.org${destination}</loc>`)) fail(`sitemap is missing ${destination}`);
}
if ([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].some((match) => expectedRedirects.has(new URL(match[1]).pathname))) {
  fail('sitemap contains a non-canonical language URL');
} else {
  pass('sitemap contains canonical language URLs only');
}

const optimizedAssets = [
  'assets/video/parrot-poster.webp',
  'assets/video/thai-hero-poster.webp',
  'assets/video/chinese-hero-poster.webp',
  'assets/founders/suthamas-400.webp',
  'assets/founders/damien-400.webp',
];
for (const file of optimizedAssets) {
  if (!fs.existsSync(path.join(root, file))) fail(`optimized asset is missing: ${file}`);
}
if (!failures.some((item) => item.includes('optimized asset'))) pass('optimized hero and founder assets exist');

const courseDir = path.join(root, 'courses');
const courseDetailFiles = fs.readdirSync(courseDir)
  .filter((name) => name.endsWith('.html') && name !== 'index.html')
  .sort();
if (courseDetailFiles.length !== 17) fail(`expected 17 course detail pages; found ${courseDetailFiles.length}`);

const courseFontFile = 'assets/fonts/fonts-courses.css';
const courseFontCss = read(courseFontFile);
for (const match of courseFontCss.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
  const fontAsset = match[1].startsWith('/')
    ? path.join(root, match[1].slice(1))
    : path.resolve(path.dirname(path.join(root, courseFontFile)), match[1]);
  if (!fs.existsSync(fontAsset)) fail(`${courseFontFile} references missing font asset ${match[1]}`);
}

const courseHub = read('courses/index.html');
if (!courseHub.includes('href="/english/"')) fail('course hub does not link back to the canonical English landing page');
const hubCourseLinks = new Set(
  [...courseHub.matchAll(/href="([^"/]+\.html)"/g)].map((match) => match[1]),
);
for (const name of courseDetailFiles) {
  if (!hubCourseLinks.has(name)) fail(`course hub does not link to ${name}`);

  const file = `courses/${name}`;
  const html = read(file);
  if (html.includes('fonts.googleapis.com') || html.includes('fonts.gstatic.com')) {
    fail(`${file} still loads fonts from Google`);
  }
  if (!html.includes('href="/assets/fonts/fonts-courses.css"')) {
    fail(`${file} does not load the self-hosted course fonts`);
  }
  if (!html.includes('href="/courses/"')) fail(`${file} does not link back to the course hub`);
  if (!html.includes(`<link rel="canonical" href="https://www.tecschool.org/courses/${name}">`)) {
    fail(`${file} has an unexpected canonical URL`);
  }

  const jsonLd = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const types = [];
  for (const [index, match] of jsonLd.entries()) {
    try {
      types.push(JSON.parse(match[1])['@type']);
    } catch (error) {
      fail(`${file} JSON-LD block ${index + 1} is invalid: ${error.message}`);
    }
  }
  if (!types.includes('Course')) fail(`${file} has no Course structured data`);
  if (!types.includes('BreadcrumbList')) fail(`${file} has no breadcrumb structured data`);
}
if (!failures.some((item) => item.includes('course hub') || item.includes('fonts') || item.includes('Course structured') || item.includes('breadcrumb structured') || item.includes('unexpected canonical'))) {
  pass('course hub and detail pages form a canonical, self-hosted crawl path');
}

const courseSitemapEntries = [...sitemap.matchAll(/<url>[\s\S]*?<loc>https:\/\/www\.tecschool\.org\/courses\/[^<]*<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/g)];
if (courseSitemapEntries.length !== 18) {
  fail(`expected 18 course sitemap entries; found ${courseSitemapEntries.length}`);
} else if (courseSitemapEntries.some((match) => match[1] !== '2026-08-14')) {
  fail('course sitemap entries do not have the current source-change date');
} else {
  pass('all course sitemap dates reflect the current source changes');
}

if (failures.length) {
  for (const message of failures) console.error(`FAIL ${message}`);
  process.exit(1);
}

console.log('SEO source verification passed.');
