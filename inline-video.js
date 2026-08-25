/* ============================================================
   Hey Taylor — Inline video controls
   Autoplaying muted video with two always-visible overlay buttons:
   play/pause and mute/unmute. Each button holds both of its state
   icons in the markup; this script shows one and hides the other.

   No markup changes needed · works with any number of videos
   per page · never touches data-w-id, so Webflow IX2 hover
   animations on the buttons keep working.

   ── Webflow hooks — attribute-driven ─────────────────────────
   Add these custom attributes in the Designer (Element Settings →
   Custom attributes). Either the button wrapper or its inner <a>
   may carry the attribute — both are handled.

     [data-video-play]     the play / pause button          (optional)
     [data-video-mute]     the mute / unmute button         (optional)

   Falling back to classes when the attributes are absent:

     .play_button-wrapper            a button wrapper
       + .cc-sound                   marks it as the mute button

   ── Required structure ───────────────────────────────────────
     .u-position-relative    wrapper around buttons + video  (required)
     .video-component        the <video> element             (required)
     .icon-color             wrapper around each icon        (optional)

   Each button is expected to contain both of its icons:

     play button    .ph-play             shown while paused
                    .ph-pause            shown while playing
     mute button    .ph-speaker-simple-high    shown while unmuted
                    .ph-speaker-simple-slash   shown while muted

   Icons are hidden by adding .htv-hide to their .icon-color parent
   (falling back to the icon itself). Nothing else on the icon is
   touched, so ph-fill, size variants and colour survive intact.

   ── Behaviour ────────────────────────────────────────────────
     click play button   → toggles play / pause
     click mute button   → toggles muted
     click video         → toggles play / pause

   ── Autoplay ─────────────────────────────────────────────────
   The <video> needs autoplay + muted + playsinline, and a preload
   other than "none". Browsers refuse to autoplay unmuted video. If
   autoplay is blocked the play icon simply stays showing and the
   first click starts it — no special-casing required.

   ── Extra (attribute on the wrapper) ─────────────────────────
     [data-video-debug]   verbose per-video console logging.

   Paste inside <script defer> in
   Site Settings → Custom Code → Before </body>, or load from CDN.
   ============================================================ */

(function () {
  'use strict';

  var TAG   = '[inline-video]';
  var WRAP  = '.u-position-relative';
  var VIDEO = '.video-component';
  var FACE  = '.icon-color';
  var HIDE  = 'htv-hide';
  var BOUND = 'htvBound';          // guards against double-binding

  var A_PLAY = '[data-video-play]';
  var A_MUTE = '[data-video-mute]';
  var BTN    = '.play_button-wrapper';
  var SOUND  = 'cc-sound';

  var I_PLAY  = '.ph-play';
  var I_PAUSE = '.ph-pause';
  var I_ON    = '.ph-speaker-simple-high';
  var I_OFF   = '.ph-speaker-simple-slash';

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  /* --- styles --------------------------------------------------
     Only the hide rule and a cursor hint. Both buttons stay visible
     in every state, so nothing here fights an IX2 animation on them. */
  function injectCss() {
    if (document.getElementById('ht-video-css')) return;
    var s = document.createElement('style');
    s.id = 'ht-video-css';
    /* !important because Webflow styles the icon wrapper with a more
       specific selector (e.g. .button .icon-color{display:flex}), which
       a bare .htv-hide would lose to. display is not animated by IX2,
       so forcing it cannot interfere with the buttons' hover states. */
    s.textContent =
      '.' + HIDE + '{display:none!important}' +
      VIDEO + '{cursor:pointer}';
    (document.head || document.documentElement).appendChild(s);
  }

  /* Hide the icon by its .icon-color parent so layout collapses
     cleanly; fall back to the icon itself if the wrapper is absent. */
  function face(icon) {
    return icon.closest(FACE) || icon;
  }

  /* Show one icon of a pair, hide the other. */
  function swap(btn, showSel, hideSel) {
    if (!btn) return;
    var on  = btn.querySelector(showSel);
    var off = btn.querySelector(hideSel);
    if (on)  face(on).classList.remove(HIDE);
    if (off) face(off).classList.add(HIDE);
  }

  /* The attribute may sit on the wrapper or on the <a> itself. Bind the
     click to the anchor where there is one, so its href is suppressed. */
  function clickTarget(el) {
    if (el.tagName === 'A') return el;
    return el.querySelector('a') || el;
  }

  function control(wrap, attr, classFilter) {
    var el = wrap.querySelector(attr);
    if (el) return el;

    var found = null;
    each(wrap.querySelectorAll(BTN), function (b) {
      if (classFilter(b)) found = b;
    });
    return found;
  }

  /* --- diagnostics ---------------------------------------------
     A missing hook used to be indistinguishable from "script never
     loaded", so each failure says which element it could not find. */
  function bind(video, debug) {
    if (video[BOUND]) return;
    video[BOUND] = true;

    var wrap = video.closest(WRAP);
    if (!wrap) {
      console.warn(TAG, 'no ' + WRAP + ' ancestor — skipping', video);
      return;
    }

    var playBtn = control(wrap, A_PLAY, function (b) {
      return !b.classList.contains(SOUND);
    });
    var muteBtn = control(wrap, A_MUTE, function (b) {
      return b.classList.contains(SOUND);
    });

    if (!playBtn && !muteBtn) {
      console.warn(TAG, 'found neither ' + A_PLAY + ' nor ' + A_MUTE + ' — skipping', wrap);
      return;
    }

    function paint() {
      var playing = !video.paused && !video.ended;
      if (playing) swap(playBtn, I_PAUSE, I_PLAY);
      else         swap(playBtn, I_PLAY,  I_PAUSE);

      if (video.muted) swap(muteBtn, I_OFF, I_ON);
      else             swap(muteBtn, I_ON,  I_OFF);
    }

    function togglePlay() {
      if (video.paused) video.play();
      else video.pause();
    }

    if (playBtn) {
      clickTarget(playBtn).addEventListener('click', function (e) {
        e.preventDefault();          // <a href="#"> would jump to top
        togglePlay();
      });
    }

    if (muteBtn) {
      clickTarget(muteBtn).addEventListener('click', function (e) {
        e.preventDefault();
        video.muted = !video.muted;  // fires volumechange → paint()
      });
    }

    video.addEventListener('click', togglePlay);

    video.addEventListener('play',         paint);
    video.addEventListener('pause',        paint);
    video.addEventListener('ended',        paint);
    video.addEventListener('volumechange', paint);

    paint();                         // autoplay may not have started yet

    if (debug) {
      console.log(TAG, 'bound', {
        src:  video.currentSrc || video.src,
        play: !!playBtn,
        mute: !!muteBtn
      });
    }
  }

  function init() {
    injectCss();
    var videos = document.querySelectorAll(VIDEO);
    if (!videos.length) return;

    var debug = !!document.querySelector('[data-video-debug]');
    if (debug) console.log(TAG, videos.length + ' video(s) found');

    each(videos, function (v) { bind(v, debug); });
  }

  /* Run on every opportunity rather than picking one. init() and bind()
     are both idempotent (guarded by the style-tag id and video[BOUND]),
     so repeat calls are free — and playback then works no matter when
     the file lands or how the <script> tag is written. */
  init();
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
})();
