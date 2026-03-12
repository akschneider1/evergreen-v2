/**
 * Design-system migration tests.
 *
 * Verifies that the USWDS migration is complete: correct classes are present,
 * old custom classes are absent, evergreen.css defines all required selectors,
 * and no stale CSS variable references remain.
 *
 * Uses only fs.readFileSync — no browser, no new dependencies.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

// ── Tests ──

function testLandingHtml(): void {
  console.log('Test 1: landing.html — USWDS migration');
  const html = read('src/web/landing.html');

  // Shared stylesheet linked
  assert(html.includes('href="/assets/css/evergreen.css"'), 'evergreen.css link missing');

  // USWDS native elements in place
  assert(html.includes('usa-header usa-header--basic'), 'usa-header--basic missing');
  assert(html.includes('class="usa-overlay"'),          'usa-overlay missing (required by USWDS header JS)');
  assert(html.includes('class="usa-hero"'),              'usa-hero missing');
  assert(html.includes('class="usa-section usa-section--light"'), 'usa-section--light missing');
  assert(html.includes('class="usa-process-list"'),     'usa-process-list missing');
  assert(html.includes('usa-footer usa-footer--slim'),   'usa-footer--slim missing');

  // Custom evergreen classes that belong in evergreen.css (must stay)
  assert(html.includes('class="ev-split-card"'), 'ev-split-card missing (custom split-card component)');

  // Old custom classes removed
  assert(!html.includes('class="ev-header"'),  'stale ev-header found');
  assert(!html.includes('class="ev-hero"'),    'stale ev-hero found');
  assert(!html.includes('class="ev-footer"'),  'stale ev-footer found');
  assert(!html.includes('class="ev-section"'), 'stale ev-section found');
  assert(!html.includes('<style>'),            'inline <style> block found — should have been removed');

  console.log('  PASSED (USWDS native elements confirmed, old classes absent)\n');
}

function testInputHtml(): void {
  console.log('Test 2: input.html — USWDS migration');
  const html = read('src/web/input.html');

  // Shared stylesheet linked
  assert(html.includes('href="/assets/css/evergreen.css"'), 'evergreen.css link missing');

  // USWDS native elements in place
  assert(html.includes('usa-header usa-header--basic'),     'usa-header--basic missing');
  assert(html.includes('class="usa-form usa-form--large"'), 'usa-form--large missing');
  assert(html.includes('class="usa-label"'),                'usa-label missing');
  assert(html.includes('class="usa-input"'),                'usa-input missing');
  assert(html.includes('class="usa-select"'),               'usa-select missing');
  assert(html.includes('class="usa-radio"'),                'usa-radio missing');
  assert(html.includes('class="usa-alert usa-alert--error"'), 'usa-alert--error missing');
  assert(html.includes('grid-container-mobile-lg'),         'grid-container-mobile-lg missing');
  assert(html.includes('usa-footer usa-footer--slim'),       'usa-footer--slim missing');

  // Custom evergreen classes that belong in evergreen.css (must stay)
  assert(html.includes('class="ev-loader"'),  'ev-loader missing (custom spinner component)');
  assert(html.includes('class="ev-spinner"'), 'ev-spinner missing (custom spinner animation)');

  // Old custom classes removed
  assert(!html.includes('class="ev-header"'),   'stale ev-header found');
  assert(!html.includes('class="ev-page"'),     'stale ev-page found');
  assert(!html.includes('class="ev-footer"'),   'stale ev-footer found');
  assert(!html.includes('class="ev-subtitle"'), 'stale ev-subtitle found');
  assert(!html.includes('<style>'),             'inline <style> block found — should have been removed');

  console.log('  PASSED (USWDS form elements confirmed, old classes absent)\n');
}

function testBuilderHtml(): void {
  console.log('Test 3: builder.html — USWDS migration');
  const html = read('src/web/builder.html');

  // Shared stylesheet linked
  assert(html.includes('href="/assets/css/evergreen.css"'), 'evergreen.css link missing');

  // ── HTML assertions ──
  assert(html.includes('usa-header usa-header--basic'),      'usa-header--basic missing');
  assert(html.includes('role="tablist"'),                     'role="tablist" missing (ARIA tab bar)');
  assert(html.includes('role="tab"'),                        'role="tab" missing (ARIA tab buttons)');
  assert(html.includes('role="tabpanel"'),                   'role="tabpanel" missing (ARIA tab panels)');
  assert(html.includes('usa-card-group'),                    'usa-card-group missing (library grid)');
  assert(html.includes('class="bg-base-lightest"'),          'bg-base-lightest missing (body background)');
  assert(html.includes('class="padding-4"'),                 'padding-4 missing (panel padding)');
  assert(html.includes('id="main-content"'),                 'main-content landmark missing');

  // ── JS-generated HTML assertions (string literals inside JS) ──
  assert(html.includes("'usa-button'"),              "JS: 'usa-button' string missing (switchTab)");
  assert(html.includes('usa-card__container'),        'JS: usa-card__container missing (renderLibrary)');
  assert(html.includes('usa-accordion__button'),      'JS: usa-accordion__button missing (renderRow)');
  assert(html.includes('usa-accordion__content'),     'JS: usa-accordion__content missing (renderRow)');
  assert(html.includes('class="usa-textarea"'),      'JS: usa-textarea missing (renderRow)');
  assert(html.includes('class="usa-label'),            'JS: usa-label missing (renderRow)');

  // Old custom classes and patterns removed
  assert(!html.includes('class="ev-header"'),         'stale ev-header found');
  assert(!html.includes('class="ev-tab '),            'stale ev-tab found (old tab button class)');
  assert(!html.includes('class="ev-panel"'),          'stale ev-panel found');
  assert(!html.includes('class="ev-footer"'),         'stale ev-footer found');
  assert(!html.includes('class="ev-breadcrumb"'),     'stale ev-breadcrumb found');
  assert(!html.includes('class="lib-grid"'),          'stale lib-grid found (replaced by usa-card-group)');
  assert(!html.includes("classList.toggle('active'"), 'stale classList.toggle(active) found (old tab pattern)');
  assert(!html.includes('<style>'),                   'inline <style> block found — should have been removed');

  console.log('  PASSED (ARIA tablist/tab/tabpanel, skip-nav, cards, accordion confirmed; old classes absent)\n');
}

function testEvergreenCss(): void {
  console.log('Test 4: evergreen.css — All required classes defined');
  const css = read('src/web/assets/css/evergreen.css');

  // Section A: metric color tokens
  assert(css.includes('--ev-safety:'),   'Section A: --ev-safety missing');
  assert(css.includes('--ev-accuracy:'), 'Section A: --ev-accuracy missing');

  // Section B: header override
  assert(css.includes('.usa-header--basic .usa-nav'), 'Section B: header nav override missing');

  // Section C: hero override
  assert(css.includes('.usa-hero {'), 'Section C: hero gradient override missing');

  // Section D: footer override
  assert(css.includes('.usa-footer--slim .usa-footer__primary-section'), 'Section D: footer override missing');

  // Section E: landing split card
  assert(css.includes('.ev-split-card'), 'Section E: ev-split-card missing');

  // Section F: loader / spinner
  assert(css.includes('.ev-loader'),         'Section F: ev-loader missing');
  assert(css.includes('.ev-spinner'),        'Section F: ev-spinner missing');
  assert(css.includes('@keyframes ev-spin'), 'Section F: ev-spin keyframe missing');

  // Section G: builder metric groups
  assert(css.includes('.metric-group'), 'Section G: metric-group missing');
  assert(css.includes('.mg-safety'),    'Section G: mg-safety missing');
  assert(css.includes('.mg-accuracy'),  'Section G: mg-accuracy missing');

  // Section H: severity badges
  assert(css.includes('.sev-badge'),    'Section H: sev-badge missing');
  assert(css.includes('.sev-critical'), 'Section H: sev-critical missing');

  // Section I: coverage bar
  assert(css.includes('.cov-bar'), 'Section I: cov-bar missing');

  // Section J: accordion row internals
  assert(css.includes('.case-row-num'), 'Section J: case-row-num missing');

  // Section K: criteria editor
  assert(css.includes('.criteria-row'),    'Section K: criteria-row missing');
  assert(css.includes('.criteria-remove'), 'Section K: criteria-remove missing');

  // Section L: pill selector
  assert(css.includes('.pill-btn'),           'Section L: pill-btn missing');
  assert(css.includes('data-value="safety"'), 'Section L: pill selected state for safety missing');

  // Section M: run CTA and empty state
  assert(css.includes('.run-cta'),         'Section M: run-cta missing');
  assert(css.includes('.builder-no-suite'),'Section M: builder-no-suite missing');

  // Section N: library card variant
  assert(css.includes('.lib-card-start'), 'Section N: lib-card-start missing');

  // Section P: criteria textarea flex fix
  assert(css.includes('.criteria-row .usa-textarea'), 'Section P: criteria-row usa-textarea flex fix missing');

  // Section Q: accordion button override
  assert(css.includes('.usa-accordion__button'), 'Section Q: usa-accordion__button override missing');

  console.log('  PASSED (all CSS sections verified, every required class present)\n');
}

function testGeneratorTs(): void {
  console.log('Test 5: generator.ts — USWDS chrome in report output');
  const src = read('src/report/generator.ts');

  // USWDS stylesheet linked
  assert(src.includes('href="/assets/css/evergreen.css"'), 'evergreen.css link missing from report');

  // Slim footer present
  assert(src.includes('class="usa-footer usa-footer--slim"'), 'usa-footer--slim missing from report');
  assert(src.includes('usa-footer__secondary-section'),       'usa-footer__secondary-section missing');

  // Old patterns removed
  assert(!src.includes('class="report-nav"'),       'stale report-nav class found');
  assert(!src.includes('class="methodology"'),      'stale methodology class found');

  console.log('  PASSED (USWDS slim footer confirmed, old chrome removed)\n');
}

function testNoStaleVarReferences(): void {
  console.log('Test 6: No stale CSS variable references in any source file');

  const files: Record<string, string> = {
    'src/web/landing.html':    read('src/web/landing.html'),
    'src/web/input.html':      read('src/web/input.html'),
    'src/web/builder.html':    read('src/web/builder.html'),
    'src/report/generator.ts': read('src/report/generator.ts'),
  };

  // These vars only existed in the removed per-page <style> blocks.
  // Finding them now means a stale reference slipped through.
  const staleVars = [
    'var(--ev-g',      // old gray-scale tokens (ev-g50, ev-g100, ..., ev-g800)
    'var(--ev-red)',   // old color alias (now --ev-safety)
    'var(--ev-blue)',  // old color alias (now --ev-accuracy)
    'var(--ev-green)', // old color alias (now --ev-ease-of-use)
    'var(--ev-orange)',// old color alias (now --ev-effectiveness)
    'var(--ev-purple)',// old color alias (now --ev-emotion)
    'var(--topbar-h)', // old builder-specific height var
  ];

  for (const [filename, content] of Object.entries(files)) {
    for (const staleVar of staleVars) {
      assert(
        !content.includes(staleVar),
        `Stale variable "${staleVar}" found in ${filename}`,
      );
    }
  }

  console.log('  PASSED (no stale CSS variables found across all 4 source files)\n');
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
}

// ── Run ──

console.log('');
console.log('=== Evergreen Design System Migration Tests ===');
console.log('');

try {
  testLandingHtml();
  testInputHtml();
  testBuilderHtml();
  testEvergreenCss();
  testGeneratorTs();
  testNoStaleVarReferences();
  console.log('All tests passed.');
  console.log('');
} catch (err) {
  console.error('TEST FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
}
