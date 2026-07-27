/* ============================================================
   Hey Taylor — Insights category filter
   Filters the Insights CMS collection by its referenced Category.

   Multi-select (OR) · no pagination · URL-synced
   e.g. ?category=geo-method,white-label

   ── Webflow hooks — ALL attribute-driven ─────────────────────
   Add these custom attributes in the Designer (Element Settings →
   Custom attributes). Classes are only used as last-resort fallbacks.

     [data-filter-bar]     the filter row wrapper                 (required)
     [data-filter-list]    the posts .w-dyn-items container        (required)
     [data-filter-item]    each post card  (put on the Collection Item)
     [data-filter-chip]    each category chip
     [data-filter-all]     the static "All" chip
     [data-filter-clear]   the "Clear" chip
     [data-category]       slug — on every chip AND every post card
     [data-filter-empty]   optional empty-state element
     [data-filter-debug]   optional, on [data-filter-bar] — verbose logging

   Paste inside <script defer> in
   Page Settings → Custom Code → Before </body>, or load from CDN.
   ============================================================ */

(function () {
  'use strict';

  var TAG      = '[insights-filter]';
  var PARAM    = 'category';
  var ACTIVE   = 'cc-selected';      // combo class on a selected chip
  var DISABLED = 'cc-disabled';      // combo class on Clear when nothing is selected
  var HIDDEN   = 'is-filtered-out';  // applied to filtered-out items

  /* --- diagnostics -------------------------------------------- */
  // The old version returned silently when a hook was missing, so a
  // markup mismatch looked identical to "script never loaded". Now every
  // bail path shouts, and a successful boot prints a one-line summary.

  var DEBUG = false;  // flipped on if [data-filter-bar] has data-filter-debug

  function warn(msg)  { try { console.warn(TAG + ' ' + msg); } catch (e) {} }
  function info(msg)  { try { console.info(TAG + ' ' + msg); } catch (e) {} }
  function debug(msg) { if (DEBUG) { try { console.log(TAG + ' ' + msg); } catch (e) {} } }

  function bail(msg) { warn(msg + ' — filter not initialised.'); }

  /* --- helpers ------------------------------------------------ */

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[‐-―−]/g, '-')   // en/em dashes, minus sign
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Returns an array — an item may carry more than one category if the
  // reference field ever becomes multi-reference. Falls back to eyebrow text.
  function categoriesOf(el) {
    var explicit = el.getAttribute('data-category');
    if (explicit === null) {
      var label = el.querySelector('.eyebrow');
      explicit = label ? label.textContent : el.textContent;
    }
    return String(explicit)
      .split(/[,\s]+/)
      .map(slugify)
      .filter(Boolean);
  }

  function firstCategoryOf(el) {
    return categoriesOf(el)[0] || '';
  }

  function isAllChip(chip) {
    if (chip.hasAttribute('data-filter-all')) return true;
    var slug = firstCategoryOf(chip);
    return slug === 'all' || slug === '';
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.' + HIDDEN + '{display:none !important;}' +
      '[data-filter-empty]{display:none;}' +
      '[data-filter-empty].is-visible{display:block;}';
    document.head.appendChild(style);
  }

  /* --- elements ----------------------------------------------- */

  var bar = document.querySelector('[data-filter-bar]') ||
            document.querySelector('.cms_filter-wrapper');
  if (!bar) {
    return bail('No [data-filter-bar] (and no .cms_filter-wrapper fallback) found');
  }

  DEBUG = bar.hasAttribute('data-filter-debug');

  var list = document.querySelector('[data-filter-list]') ||
             document.querySelector('.u-mb-lg .w-dyn-items');
  if (!list) {
    return bail('No [data-filter-list] (and no .w-dyn-items fallback) found');
  }

  var clearChip = bar.querySelector('[data-filter-clear]') ||
                  bar.querySelector('.u-ml-auto .chip');

  // Prefer explicit [data-filter-chip]; fall back to .chip for old markup.
  var chips = Array.prototype.slice.call(
    bar.querySelectorAll('[data-filter-chip]')
  );
  if (!chips.length) {
    chips = Array.prototype.slice.call(bar.querySelectorAll('.chip'));
    if (chips.length) debug('Using .chip fallback — add [data-filter-chip] for reliability.');
  }
  chips = chips.filter(function (chip) { return chip !== clearChip; });

  // Prefer explicit [data-filter-item]; fall back to .w-dyn-item.
  var items = Array.prototype.slice.call(
    list.querySelectorAll('[data-filter-item]')
  );
  if (!items.length) {
    items = Array.prototype.slice.call(list.querySelectorAll('.w-dyn-item'));
    if (items.length) debug('Using .w-dyn-item fallback — add [data-filter-item] for reliability.');
  }

  if (!chips.length) return bail('Found the bar but zero chips ([data-filter-chip] / .chip)');
  if (!items.length) return bail('Found the list but zero items ([data-filter-item] / .w-dyn-item)');

  injectStyles();

  var empty = document.querySelector('[data-filter-empty]');
  if (!empty) {
    empty = document.createElement('div');
    empty.setAttribute('data-filter-empty', '');
    empty.className = 'u-text-midgray-1';
    empty.textContent = 'Nothing published in these categories yet.';
    list.parentNode.insertBefore(empty, list.nextSibling);
  }
  empty.setAttribute('role', 'status');
  empty.setAttribute('aria-live', 'polite');

  // Cache each item's categories once.
  var index = items.map(function (item) {
    return { el: item, categories: categoriesOf(item) };
  });

  // Only slugs that exist as chips are honoured, so a junk URL can't blank the grid.
  var known = {};
  var allChip = null;
  chips.forEach(function (chip) {
    if (isAllChip(chip)) { allChip = chip; return; }
    known[firstCategoryOf(chip)] = true;
  });

  // Loud warning for the most common real-world break: chips and cards
  // slugify to different strings, so nothing ever matches.
  var orphanItems = index.filter(function (entry) {
    return !entry.categories.some(function (slug) { return known[slug]; });
  }).length;
  if (orphanItems === items.length) {
    warn('None of the ' + items.length + ' items carry a category slug that matches any chip. ' +
         'Check that [data-category] is bound to the SAME slug on both chips and cards.');
  }

  /* --- state -------------------------------------------------- */

  var selected = [];   // empty === All

  function isSelected(slug) {
    return selected.indexOf(slug) !== -1;
  }

  function toggle(slug) {
    var at = selected.indexOf(slug);
    if (at === -1) selected.push(slug);
    else selected.splice(at, 1);
  }

  /* --- rendering ---------------------------------------------- */

  function render() {
    var none  = selected.length === 0;
    var shown = 0;

    index.forEach(function (entry) {
      var match = none || entry.categories.some(isSelected);
      entry.el.classList.toggle(HIDDEN, !match);
      if (match) shown++;
    });

    chips.forEach(function (chip) {
      var on = isAllChip(chip) ? none : isSelected(firstCategoryOf(chip));
      chip.classList.toggle(ACTIVE, on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    if (clearChip) {
      clearChip.classList.toggle(DISABLED, none);
      clearChip.setAttribute('aria-disabled', none ? 'true' : 'false');
    }

    empty.classList.toggle('is-visible', shown === 0);
    debug('render — selected=[' + selected.join(',') + '] showing ' + shown + '/' + items.length);
  }

  function syncURL() {
    if (!window.history.pushState) return;
    var url = selected.length
      ? window.location.pathname + '?' + PARAM + '=' +
        selected.map(encodeURIComponent).join(',')
      : window.location.pathname;
    window.history.pushState({ filter: selected.slice() }, '', url);
  }

  function commit() {
    render();
    syncURL();
  }

  function fromURL() {
    var match = window.location.search.match(
      new RegExp('[?&]' + PARAM + '=([^&]*)')
    );
    if (!match || !match[1]) return [];
    return decodeURIComponent(match[1])
      .split(',')
      .map(slugify)
      .filter(function (slug, at, all) {
        return slug && known[slug] && all.indexOf(slug) === at;
      });
  }

  /* --- wiring ------------------------------------------------- */

  function bind(el, handler) {
    if (el.tagName !== 'A') {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
    }
    el.addEventListener('click', function (event) {
      event.preventDefault();
      handler();
    });
    el.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        el.click();
      }
    });
  }

  chips.forEach(function (chip) {
    var all  = isAllChip(chip);
    var slug = all ? null : firstCategoryOf(chip);

    // Static href = "this category on its own", so middle-click and
    // open-in-new-tab still land somewhere sensible.
    if (chip.tagName === 'A') {
      chip.setAttribute(
        'href',
        all ? window.location.pathname : '?' + PARAM + '=' + encodeURIComponent(slug)
      );
    }

    bind(chip, function () {
      if (all) selected = [];
      else toggle(slug);
      commit();
    });
  });

  if (clearChip) {
    bind(clearChip, function () {
      if (!selected.length) return;
      selected = [];
      commit();
    });
  }

  window.addEventListener('popstate', function () {
    selected = fromURL();
    render();
  });

  selected = fromURL();
  render();

  info('ready — ' + chips.length + ' chips, ' + items.length + ' items' +
       (allChip ? '' : ' (no All chip found)') +
       (clearChip ? '' : ' (no Clear chip found)'));
})();
