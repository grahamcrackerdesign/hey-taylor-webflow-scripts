/* ============================================================
   Hey Taylor — Insights category filter
   Filters the Insights CMS collection by its referenced Category.

   Multi-select (OR) · no pagination · URL-synced
   e.g. ?category=geo-method,white-label

   Webflow setup — custom attributes:
     [data-filter-bar]    filter row wrapper       (optional; falls back to .cms_filter-wrapper)
     [data-filter-list]   posts .w-dyn-items list  (optional; falls back to .u-mb-lg .w-dyn-items)
     [data-filter-all]    the static "All" chip
     [data-filter-clear]  the "Clear" chip
     [data-category]      on each CMS chip AND each post card — bind to the Category slug
     [data-filter-empty]  optional empty-state element

   Paste inside <script> tags:
   Page Settings → Custom Code → Before </body>
   ============================================================ */

(function () {
  'use strict';

  var PARAM    = 'category';
  var ACTIVE   = 'cc-selected';      // combo class on a selected chip
  var DISABLED = 'cc-disabled';      // combo class on Clear when nothing is selected
  var HIDDEN   = 'is-filtered-out';  // applied to filtered-out items

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

  var bar  = document.querySelector('[data-filter-bar], .cms_filter-wrapper');
  var list = document.querySelector('[data-filter-list], .u-mb-lg .w-dyn-items');
  if (!bar || !list) return;

  var clearChip = bar.querySelector('[data-filter-clear]') ||
                  bar.querySelector('.u-ml-auto .chip');
  var allChip   = null;

  var chips = Array.prototype.slice.call(bar.querySelectorAll('.chip'))
    .filter(function (chip) { return chip !== clearChip; });

  var items = Array.prototype.slice.call(list.querySelectorAll('.w-dyn-item'));
  if (!chips.length || !items.length) return;

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
  chips.forEach(function (chip) {
    if (isAllChip(chip)) { allChip = chip; return; }
    known[firstCategoryOf(chip)] = true;
  });

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
})();
