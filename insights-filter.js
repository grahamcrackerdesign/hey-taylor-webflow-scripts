/* ============================================================
   Hey Taylor — Insights category filter
   Filters the Insights CMS collection by its referenced Category.

   Multi-select (OR) · no pagination · URL-synced
   e.g. ?category=geo-method,white-label

   ── Webflow hooks — attribute-driven ─────────────────────────
   Add these custom attributes in the Designer (Element Settings →
   Custom attributes). data-category may sit on the hooked element OR
   on a descendant, so you can put data-filter-chip on the Collection
   Item and leave data-category bound on the inner link.

     [data-filter-bar]     the filter row wrapper                 (required)
     [data-filter-list]    the posts .w-dyn-items container        (required)
     [data-filter-item]    each post card  (the Collection Item)   (required)
     [data-filter-chip]    each category chip / Collection Item     (required)
     [data-filter-clear]   the "Clear" chip (resets to show all)    (optional)
     [data-category]       slug — on every chip AND every card, or a descendant
     [data-filter-empty]   optional empty-state element

   ── Extra (attribute on [data-filter-bar]) ───────────────────
     [data-filter-debug]   verbose per-render console logging.

   Paste inside <script defer> in
   Page Settings → Custom Code → Before </body>, or load from CDN.
   ============================================================ */

(function () {
  'use strict';

  var TAG      = '[insights-filter]';
  var PARAM    = 'category';
  var ACTIVE   = 'cc-selected';      // combo class on a selected chip's .chip face
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

  // data-category may be on the hooked element itself or on a descendant
  // (Webflow binds it to the inner link, while the filter hook sits on the
  // Collection Item wrapper). Check both before falling back to visible text.
  function readCategoryAttr(el) {
    if (el.hasAttribute('data-category')) return el.getAttribute('data-category');
    var inner = el.querySelector('[data-category]');
    return inner ? inner.getAttribute('data-category') : null;
  }

  // Returns an array — an item may carry more than one category if the
  // reference field ever becomes multi-reference. Falls back to eyebrow text.
  function categoriesOf(el) {
    var explicit = readCategoryAttr(el);
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

  // The element that actually carries the .chip styling — the hook may be on
  // a wrapper, so state classes must land on the styled child, not the wrapper.
  function faceOf(el) {
    if (el.classList.contains('chip')) return el;
    return el.querySelector('.chip') || el;
  }

  // The anchor to rewrite / focus, if the chip is (or wraps) a link.
  function anchorOf(el) {
    if (el.tagName === 'A') return el;
    return el.querySelector('a');
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
  var chips = Array.prototype.slice.call(bar.querySelectorAll('[data-filter-chip]'));
  if (!chips.length) {
    chips = Array.prototype.slice.call(bar.querySelectorAll('.chip'));
    if (chips.length) debug('Using .chip fallback — add [data-filter-chip] for reliability.');
  }
  chips = chips.filter(function (chip) {
    return chip !== clearChip && !chip.contains(clearChip);
  });

  // Prefer explicit [data-filter-item]; fall back to .w-dyn-item.
  var items = Array.prototype.slice.call(list.querySelectorAll('[data-filter-item]'));
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
  chips.forEach(function (chip) {
    var slug = firstCategoryOf(chip);
    if (slug) known[slug] = true;
  });

  // Loud warning for the most common real-world break: chips and cards
  // slugify to different strings, so nothing ever matches.
  var orphanItems = index.filter(function (entry) {
    return !entry.categories.some(function (slug) { return known[slug]; });
  }).length;
  if (orphanItems === items.length) {
    warn('None of the ' + items.length + ' items carry a category slug that matches any chip. ' +
         'Check that [data-category] resolves to the SAME slug on both chips and cards.');
  }

  /* --- state -------------------------------------------------- */

  var selected = [];   // empty === show everything

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
      var on = isSelected(firstCategoryOf(chip));
      faceOf(chip).classList.toggle(ACTIVE, on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    if (clearChip) {
      faceOf(clearChip).classList.toggle(DISABLED, none);
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

  // Click is bound on the hooked element so clicks on the inner link bubble up
  // (and get preventDefault'd). Keyboard/role are added only when the focus
  // target isn't a native anchor, to avoid double-firing on Enter.
  function bind(el, target, handler) {
    target = target || el;
    var isAnchor = target.tagName === 'A';
    if (!isAnchor) {
      target.setAttribute('role', 'button');
      target.setAttribute('tabindex', '0');
      target.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handler();
        }
      });
    }
    el.addEventListener('click', function (event) {
      event.preventDefault();
      handler();
    });
  }

  chips.forEach(function (chip) {
    var slug   = firstCategoryOf(chip);
    var anchor = anchorOf(chip);

    // Static href = "this category on its own", so middle-click and
    // open-in-new-tab still land somewhere sensible.
    if (anchor) {
      anchor.setAttribute('href', '?' + PARAM + '=' + encodeURIComponent(slug));
    }

    bind(chip, anchor || faceOf(chip), function () {
      toggle(slug);
      commit();
    });
  });

  if (clearChip) {
    bind(clearChip, anchorOf(clearChip) || faceOf(clearChip), function () {
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
       (clearChip ? '' : ' (no Clear chip found)'));
})();
