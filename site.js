/* Progressive enhancement only. With this file blocked or failing, both pages
   remain fully readable and the FAQ still opens — <details> is native. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Matches --dur-accordion in style.css, plus a little slack so the panel is
     never torn down mid-transition. */
  var ACCORDION_MS = 240;
  var ACCORDION_SETTLE_MS = ACCORDION_MS + 40;

  function supportsScrollTimeline() {
    return !!(window.CSS && CSS.supports &&
              CSS.supports('animation-timeline', 'scroll(root block)'));
  }

  /* ---- Scroll reveal --------------------------------------------------
     Elements are hidden by CSS only under `html.js`, which is set inline in
     the head. If IntersectionObserver is missing, show everything at once
     rather than leaving the page blank. */
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var pending = [];
    var observer;

    function reveal(el, order) {
      el.style.setProperty('--reveal-i', reduceMotion ? 0 : Math.min(order, 4));
      el.classList.add('is-visible');
      observer.unobserve(el);
      var i = pending.indexOf(el);
      if (i !== -1) pending.splice(i, 1);
    }

    /* An instant jump — a #fragment on load, scroll restoration on back, or
       any in-page link once `scroll-behavior` is auto under reduced motion —
       moves straight past elements without ever intersecting them, so they
       report no change and would stay invisible for good. Anything now fully
       above the viewport has been skipped; show it. */
    function sweepSkipped() {
      pending.slice().forEach(function (el) {
        if (el.getBoundingClientRect().bottom < 0) reveal(el, 0);
      });
    }

    observer = new IntersectionObserver(function (entries) {
      // Stagger within a batch, so a group arriving together cascades
      // instead of appearing as one block.
      var shown = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target, shown);
        shown += 1;
      });
      sweepSkipped();
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    items.forEach(function (el) {
      // Anything already on screen at load shouldn't fade in behind the fold.
      var box = el.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.9) {
        el.classList.add('is-visible');
      } else {
        pending.push(el);
        observer.observe(el);
      }
    });

    // Covers scroll restoration that lands after this ran.
    window.addEventListener('pageshow', sweepSkipped);
  }

  /* ---- Table of contents highlighting --------------------------------- */
  function initTOC() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var byId = {};
    var targets = [];
    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (!section) return;
      byId[id] = link;
      targets.push(section);
    });
    if (!targets.length) return;

    var visible = [];

    function setCurrent(id) {
      links.forEach(function (link) {
        if (link.getAttribute('href') === '#' + id) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var id = entry.target.id;
        var index = visible.indexOf(id);
        if (entry.isIntersecting && index === -1) visible.push(id);
        if (!entry.isIntersecting && index !== -1) visible.splice(index, 1);
      });

      if (!visible.length) return;
      // Whichever visible heading sits highest wins.
      var top = visible.slice().sort(function (a, b) {
        return document.getElementById(a).getBoundingClientRect().top -
               document.getElementById(b).getBoundingClientRect().top;
      })[0];
      if (byId[top]) setCurrent(top);
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });

    targets.forEach(function (section) { observer.observe(section); });
  }

  /* ---- FAQ accordions --------------------------------------------------
     <details> already opens and closes by itself; this only adds the height
     transition. The panel's grid row has to be pinned at its collapsed size
     *before* `open` is set, otherwise there is no start value to animate from
     — which is why the click is intercepted and the attribute flipped by hand.

     With this file blocked, or under reduced motion, none of it runs: the
     browser's own toggle takes over and the CSS lands on the correct end
     state immediately. */
  function initAccordions() {
    if (reduceMotion) return;
    var list = Array.prototype.slice.call(document.querySelectorAll('details.faq'));
    if (!list.length) return;

    list.forEach(function (details) {
      var summary = details.querySelector('summary');
      var panel = details.querySelector('.faq-panel');
      if (!summary || !panel) return;

      var expanded = details.open;
      var timer = null;

      function settle() {
        timer = null;
        details.classList.remove('is-collapsed', 'is-expanded');
        details.open = expanded;
      }

      summary.addEventListener('click', function (event) {
        event.preventDefault();

        if (timer) {
          clearTimeout(timer);
          timer = null;
        } else {
          // Nothing in flight, so trust the DOM — something other than a
          // click (find-in-page, say) may have opened it.
          expanded = details.open;
        }

        expanded = !expanded;

        if (expanded) {
          if (!details.open) {
            details.classList.add('is-collapsed');
            details.open = true;
            void panel.offsetHeight; // flush layout so 0fr is the start value
          }
          details.classList.remove('is-collapsed');
          details.classList.add('is-expanded');
        } else {
          details.classList.remove('is-expanded');
          details.classList.add('is-collapsed');
        }

        timer = setTimeout(settle, ACCORDION_SETTLE_MS);
      });
    });
  }

  /* ---- Reading progress ------------------------------------------------
     Chrome and Safari drive the bar from a CSS scroll timeline, off the main
     thread, and this does nothing there. Firefox has no scroll timelines, so
     it gets the same transform from a passive, rAF-throttled listener. */
  function initProgress() {
    var bar = document.querySelector('.progress');
    if (!bar || reduceMotion || supportsScrollTimeline()) return;

    var ticking = false;

    function paint() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var offset = window.pageYOffset || doc.scrollTop || 0;
      var ratio = max > 0 ? Math.min(1, Math.max(0, offset / max)) : 0;
      bar.style.transform = 'scaleX(' + ratio + ')';
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
  }

  function init() {
    initReveal();
    initTOC();
    initAccordions();
    initProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
