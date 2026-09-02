/* TakeoffAI — shared behaviour: nav, FAQ, scroll-in, hero animation, CTA tracking */
(function () {
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // Highlight the current page in the nav
  var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(function (a) {
    var h = a.getAttribute('href');
    if (h && h.charAt(0) === '/' && h !== '/' && (path === h || path.indexOf(h + '/') === 0)) a.classList.add('active');
  });

  // Mobile menu
  var burger = document.getElementById('nav-burger'), mobile = document.getElementById('nav-mobile');
  if (burger && mobile) {
    burger.addEventListener('click', function () {
      var open = mobile.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mobile.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { mobile.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); });
    });
  }

  // FAQ accordion (one open per list)
  document.querySelectorAll('.faq-q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.parentElement, was = item.classList.contains('open');
      item.parentElement.querySelectorAll('.faq-item.open').forEach(function (o) { o.classList.remove('open'); });
      if (!was) item.classList.add('open');
    });
  });

  // Fade-in on scroll
  var anims = document.querySelectorAll('.anim');
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    anims.forEach(function (el, i) { el.style.transitionDelay = Math.min((i % 6) * 0.05, 0.3) + 's'; obs.observe(el); });
  } else {
    anims.forEach(function (el) { el.classList.add('visible'); });
  }

  // Hero animation iframe: only play while on screen
  var frame = document.querySelector('iframe[data-anim]');
  if (frame && 'IntersectionObserver' in window) {
    var fo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { try { frame.contentWindow.postMessage(e.isIntersecting ? 'play' : 'pause', '*'); } catch (err) {} });
    }, { threshold: 0.3 });
    frame.addEventListener('load', function () { fo.observe(frame); });
  }

  // Meta Pixel: count clicks through to the app sign-up so ads can optimise for them
  document.querySelectorAll('a[href*="app.takeoffai.com.au/signup"]').forEach(function (a) {
    a.addEventListener('click', function () { if (window.fbq) { try { fbq('trackCustom', 'SignupClick', { page: path }); } catch (e) {} } });
  });
})();
