(function () {
  'use strict';

  var root = document.documentElement;
  var EMAIL = 'param_jasani@rediffmail.com';

  // ---------- Theme toggle (label names the theme you'd switch to) ----------
  var themeBtn = document.getElementById('theme-toggle');
  var themeLabel = document.getElementById('theme-label');
  function currentTheme() {
    return root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }
  function syncTheme() { themeLabel.textContent = currentTheme() === 'dark' ? 'light' : 'dark'; }
  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncTheme();
    window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    return next;
  }
  themeBtn.addEventListener('click', toggleTheme);
  syncTheme();

  var motion = root.classList.contains('motion');

  // ---------- Boot screen: skip on any key / click, then retire it ----------
  function booted() { root.classList.add('booted'); }
  if (root.classList.contains('boot')) {
    document.addEventListener('keydown', booted, { once: true });
    document.addEventListener('pointerdown', booted, { once: true });
    setTimeout(booted, 1500);
  }

  // ---------- Smooth scroll (Lenis) synced with GSAP ScrollTrigger ----------
  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (gsap && ST) gsap.registerPlugin(ST);
  var lenis = null;
  if (motion && window.Lenis && window.matchMedia('(pointer: fine)').matches) {
    try {
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
      if (gsap && ST) {
        lenis.on('scroll', ST.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
      } else {
        var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
    } catch (e) { lenis = null; }
  }
  function headerOffset() { return window.innerWidth <= 720 ? -88 : -64; }
  function scrollToY(y, instant) {
    if (lenis) lenis.scrollTo(y, { immediate: !!instant });
    else window.scrollTo(0, y);
  }
  function scrollByY(dy) {
    if (lenis) lenis.scrollTo(window.scrollY + dy);
    else window.scrollBy(0, dy);
  }
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: headerOffset() });
    else el.scrollIntoView();
  }
  if (lenis) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      var id = a.getAttribute('href').slice(1);
      var el = id ? document.getElementById(id) : null;
      if (!el && id !== 'top') return;
      e.preventDefault();
      if (id === 'top') scrollToY(0); else scrollToEl(el);
      history.pushState(null, '', '#' + id);
      if (el && id === 'main') { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
    });
  }

  // ---------- Hero: Mumbai clock ----------
  var clock = document.getElementById('clock');
  if (clock) {
    var fmt;
    try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); } catch (e) { fmt = null; }
    var tick = function () { if (fmt) { var s = fmt.format(new Date()); clock.textContent = s; clock.setAttribute('datetime', s); } };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- Hero name: split into masked characters ----------
  var heroName = document.querySelector('.hero-name');
  var chars = [];
  if (heroName) {
    heroName.setAttribute('aria-label', heroName.textContent.replace(/\s+/g, ' ').trim());
    heroName.querySelectorAll(':scope > span').forEach(function (w) {
      var text = w.textContent;
      w.textContent = '';
      w.className = 'word';
      w.setAttribute('aria-hidden', 'true');
      text.split('').forEach(function (c) {
        var s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        w.appendChild(s);
        chars.push(s);
      });
    });
  }

  // ---------- GSAP choreography ----------
  if (motion && gsap && ST) {
    var bootDelay = root.classList.contains('boot') && !root.classList.contains('booted') ? 1.45 : 0.15;

    var intro = gsap.timeline({ delay: bootDelay, defaults: { ease: 'expo.out' } });
    intro
      .from(chars, { yPercent: 115, rotate: 6, duration: 1.3, stagger: 0.045 })
      .from('.hero-whatis, .hero-top, .hero-foot', { y: 18, opacity: 0, duration: 1, stagger: 0.08 }, '-=0.9');

    // the hero name drifts up and apart as you leave it
    gsap.to('.hero-name .word:first-child', { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-name .word:last-child', { xPercent: 8, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-inner', { opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'center top', end: 'bottom top', scrub: true } });

    // section heads wipe in, bodies rise
    document.querySelectorAll('.page .sec').forEach(function (sec) {
      var sh = sec.querySelector('.sh');
      var tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 82%', once: true } });
      if (sh) tl.from(sh, { clipPath: 'inset(0 100% 0 0)', duration: 0.6, ease: 'steps(' + Math.max(4, sh.textContent.length) + ')' });
      var body = sec.querySelectorAll(':scope > .body > *');
      if (body.length) tl.from(body, { y: 26, opacity: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' }, 0.1);
    });

    // list rows slide in as they arrive
    ST.batch('.log > li, .projects > li, .files li, .see > div, .exit tr, .opts > div, .env > div', {
      start: 'top 90%',
      once: true,
      onEnter: function (els) { gsap.from(els, { x: -18, opacity: 0, duration: 0.7, stagger: 0.05, ease: 'power3.out' }); }
    });

    // alert bars fill
    gsap.from('.alerts .al-bar', {
      clipPath: 'inset(0 100% 0 0)', duration: 1.1, stagger: 0.04, ease: 'steps(18)',
      scrollTrigger: { trigger: '.alerts', start: 'top 80%', once: true }
    });

    // counters
    document.querySelectorAll('.count').forEach(function (c) {
      var end = parseInt(c.textContent, 10), o = { v: 0 };
      if (!end) return;
      gsap.to(o, {
        v: end, duration: 1.4, ease: 'power3.out',
        scrollTrigger: { trigger: c, start: 'top 90%', once: true },
        onStart: function () { c.textContent = '0'; },
        onUpdate: function () { c.textContent = Math.round(o.v); }
      });
    });

    // credential ID decrypts
    var cred = document.querySelector('.cred');
    if (cred) {
      var real = cred.textContent, HEX = '0123456789ABCDEF';
      ST.create({
        trigger: cred, start: 'top 90%', once: true,
        onEnter: function () {
          var o = { p: 0 };
          gsap.to(o, {
            p: 1, duration: 1.2, ease: 'none',
            onUpdate: function () {
              var n = Math.floor(o.p * real.length), s = real.slice(0, n);
              for (var i = n; i < real.length; i++) s += HEX[(Math.random() * 16) | 0];
              cred.textContent = s;
            },
            onComplete: function () { cred.textContent = real; }
          });
        }
      });
    }

    // magnetic controls
    if (window.matchMedia('(pointer: fine)').matches) {
      document.querySelectorAll('.hero-down, .flag, .theme, .mail a, .hero-whatis a').forEach(function (el) {
        var xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
        var yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.35);
          yTo((e.clientY - r.top - r.height / 2) * 0.5);
        });
        el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
      });

      // cursor ring
      var cur = document.getElementById('cursor');
      if (cur) {
        var cx = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3.out' });
        var cy = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3.out' });
        window.addEventListener('pointermove', function (e) {
          if (e.pointerType === 'touch') return;
          cur.classList.add('is-on');
          cx(e.clientX); cy(e.clientY);
          var t = e.target.closest && e.target.closest('a, button, input, .shell');
          cur.classList.toggle('is-link', !!t && !t.matches('input, .shell'));
        }, { passive: true });
        document.addEventListener('pointerleave', function () { cur.classList.remove('is-on'); });
      }
    }

    window.addEventListener('load', function () { ST.refresh(); });
  }

  // ---------- Project filters ----------
  var flags = document.querySelectorAll('.cmd .flag');
  var projects = document.querySelectorAll('.projects > li');
  flags.forEach(function (flag) {
    flag.addEventListener('click', function () {
      var f = flag.getAttribute('data-filter');
      flags.forEach(function (x) {
        x.classList.toggle('is-on', x === flag);
        x.setAttribute('aria-pressed', String(x === flag));
      });
      projects.forEach(function (p) {
        var show = f === 'all' || p.getAttribute('data-cat').split(' ').indexOf(f) !== -1;
        p.classList.toggle('is-hidden', !show);
      });
    });
  });

  // ---------- Copy email ----------
  var copyBtn = document.getElementById('copy-email');
  var copied = document.getElementById('copied');
  function copyEmail(cb) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(EMAIL).then(function () { cb(true); }, function () { cb(false); });
    } else {
      cb(false);
    }
  }
  copyBtn.addEventListener('click', function () {
    copyEmail(function (ok) {
      copied.textContent = ok ? 'copied.' : EMAIL;
      setTimeout(function () { copied.textContent = ''; }, 2000);
    });
  });

  // ---------- Current section in the top bar ----------
  if ('IntersectionObserver' in window) {
    var tocLinks = {};
    document.querySelectorAll('.toc a').forEach(function (a) { tocLinks[a.hash.slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || !tocLinks[e.target.id]) return;
        Object.keys(tocLinks).forEach(function (k) { tocLinks[k].classList.remove('is-here'); });
        tocLinks[e.target.id].classList.add('is-here');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(tocLinks).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) obs.observe(el);
    });
  }

  // ---------- less(1) status line ----------
  var lessLine = document.getElementById('less-line');
  var lessPct = document.getElementById('less-pct');
  var LINE = 25.5; // 15px * 1.7 line-height
  var ticking = false;
  function updateLess() {
    ticking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var y = window.scrollY;
    lessLine.textContent = Math.floor(y / LINE) + 1;
    lessPct.textContent = max > 0 ? Math.min(100, Math.round((y / max) * 100)) : 100;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateLess); }
  }, { passive: true });
  updateLess();

  // ---------- Key help dialog + less-style shortcuts ----------
  var keys = document.getElementById('keys');
  var keysClose = document.getElementById('keys-close');
  var lastFocus = null;
  function openKeys() { lastFocus = document.activeElement; keys.hidden = false; keysClose.focus(); }
  function closeKeys() { keys.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  keysClose.addEventListener('click', closeKeys);

  var shellInput = document.getElementById('shell-input');

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

    if (!keys.hidden) {
      if (e.key === 'q' || e.key === 'Escape' || e.key === '?') { e.preventDefault(); closeKeys(); }
      return;
    }
    var step = LINE * 3;
    switch (e.key) {
      case 'j': scrollByY(step); break;
      case 'k': scrollByY(-step); break;
      case ' ':
        if (!lenis) return;
        e.preventDefault();
        scrollByY((e.shiftKey ? -1 : 1) * (window.innerHeight - 80));
        break;
      case 'g': scrollToY(0); break;
      case 'G': scrollToY(document.documentElement.scrollHeight); break;
      case 't': toggleTheme(); break;
      case '?': e.preventDefault(); openKeys(); break;
      case '/':
        e.preventDefault();
        scrollToEl(document.getElementById('examples'));
        shellInput.focus({ preventScroll: true });
        break;
      default: return;
    }
  });

  // ---------- EXAMPLES: tiny shell ----------
  var out = document.getElementById('shell-out');
  var form = document.getElementById('shell-form');
  document.getElementById('shell').addEventListener('click', function (e) {
    if (e.target.tagName !== 'A') shellInput.focus();
  });

  var LINKS = {
    github: 'https://github.com/param-jasani',
    linkedin: 'https://www.linkedin.com/in/param-jasani/',
    tryhackme: 'https://tryhackme.com/p/CVE',
    htb: 'https://app.hackthebox.com/users/2094726',
    letsdefend: 'https://app.letsdefend.io/user/ZeroCVE',
    hackerone: 'https://hackerone.com/zero_cve',
    grayswan: 'https://app.grayswan.ai/arena/user/6a9b10f5c5fda2fee8dce6c5',
    soc: 'https://ctf.haxnation.org/soc/practice',
    ctf: 'https://ctf.haxnation.org/',
    blog: 'https://blog.haxnation.org/authors',
    writeups: 'https://param-jasani.github.io/sec-writeups',
    sc200: 'https://learn.microsoft.com/api/credentials/share/en-us/param-jasani/E00BD7D30616360C',
    mslearn: 'https://learn.microsoft.com/en-us/users/param-jasani/',
    linktree: 'https://linktr.ee/ParamJasani'
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function link(url, text) {
    return '<a href="' + url + '" target="_blank" rel="noopener">' + esc(text || url) + '</a>';
  }

  var COMMANDS = {
    help: function () {
      return [
        'available commands:',
        '  whoami          who is this',
        '  ls [dir]        list things (try: ls projects, ls soc)',
        '  cat <file>      about | certs | contact | motto | skills',
        '  open <name>     ' + Object.keys(LINKS).join(' '),
        '  stats           the numbers',
        '  theme           toggle light / dark',
        '  history         previous commands',
        '  clear           clear the screen',
        '  sudo hire param you know you want to'
      ].join('\n');
    },
    whoami: function () {
      return 'param-jasani (20), Mumbai. security & systems engineer, SC-200 certified.\ndetection engineering, infrastructure, rust. CTF developer @ HaxNation. handle: CVE';
    },
    ls: function (args) {
      var dir = (args[0] || '').replace(/\/$/, '').replace(/^~\//, '');
      if (!dir || dir === '~') return 'about.txt  certs.txt  contact.txt  motto.txt  skills.txt  projects/  soc/  writing/';
      if (dir === 'projects') return 'k8s-homelab/  soc-lab/  qualys-vmdr-lab/  elk-siem-pipeline/  enterprise-ad-lab/\nmayajal-core/  dispenser/  dz6/  libmagic-rs/  secureroute/';
      if (dir === 'soc') return '14 scenarios, 321 alerts, all authored by param:\nromcom  kimsuky  cobalt-kitty  midnight-blizzard  silent-tide  midnight-cipher\nazure-echo  silent-echo  emotet-cascade  arctic-echo  phantom-receipt\nkongtuke  ghost-script  ghost-shell\n→ ' + link(LINKS.soc);
      if (dir === 'writing') return '10 posts on the HaxNation blog, 4 DFIR / SOC writeups.\n→ ' + link(LINKS.blog) + '\n→ ' + link(LINKS.writeups);
      return 'ls: cannot access \'' + esc(dir) + '\': No such file or directory';
    },
    cat: function (args) {
      var f = (args[0] || '').replace(/\.txt$/, '');
      if (f === 'about') return 'I learn by building: a 19-node k8s cluster, a Splunk SOC, an ELK SIEM, an AD lab.\nI write SOC scenarios and CTF challenges, and Rust tools when I get bored.';
      if (f === 'certs') return 'Microsoft Certified: Security Operations Analyst Associate (SC-200)\nissued 2026-09 · expires 2027-09 · id E00BD7D30616360C\n→ ' + link(LINKS.sc200, 'verify on learn.microsoft.com');
      if (f === 'contact') return link('mailto:' + EMAIL, EMAIL);
      if (f === 'motto') return '"Until death, all defeat is psychological."';
      if (f === 'skills') return esc('soc:     sentinel defender-xdr kql splunk elk google-secops sysmon suricata yara qualys att&ck caldera\ninfra:   kubernetes rook-ceph haproxy docker terraform azure active-directory/entra\nlang:    rust (tokio russh) python c java sql bash powershell\nbackend: django fastapi flask oracle postgresql mongodb');
      if (!f) return 'cat: missing file operand';
      return 'cat: ' + esc(f) + ': No such file or directory';
    },
    open: function (args) {
      var k = (args[0] || '').toLowerCase();
      if (!LINKS[k]) return 'open: unknown target. try: ' + Object.keys(LINKS).join(' ');
      window.open(LINKS[k], '_blank', 'noopener');
      return 'opening ' + link(LINKS[k]) + ' …';
    },
    stats: function () {
      return 'sc-200         microsoft certified · ' + link(LINKS.sc200, 'E00BD7D30616360C') + '\ntryhackme      top 1% · 296 rooms · 47 badges\nsoc-simulator  14 scenarios · 321 alerts\nhomelab        19 nodes · 7.5 TB ceph\nwriting        10 posts on the haxnation blog\ngoogle-skills  diamond league · 14 badges';
    },
    theme: function () { return 'theme set to ' + toggleTheme() + '.'; },
    history: function () { return hist.map(function (h, i) { return '  ' + (i + 1) + '  ' + esc(h); }).join('\n') || '(empty)'; },
    clear: function () { out.innerHTML = ''; return null; },
    echo: function (args) { return esc(args.join(' ')); },
    date: function () { return new Date().toString(); },
    pwd: function () { return '/home/guest'; },
    exit: function () { return 'there is no exit. there is only ' + link('mailto:' + EMAIL, 'contact') + '.'; },
    sudo: function (args) {
      if (args.join(' ') === 'hire param') {
        setTimeout(function () { window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Hiring: Param Jasani'); }, 700);
        return '[sudo] password for guest: ********\naccess granted. opening mail client…';
      }
      return 'guest is not in the sudoers file. This incident will be reported.';
    },
    rm: function (args) {
      if (args.indexOf('-rf') !== -1) return 'ALERT SOC-0001 [critical] destructive command by guest. analyst notified. nice try.';
      return 'rm: permission denied';
    },
  };
  COMMANDS.dir = COMMANDS.ls;
  COMMANDS.man = function () { return 'you are reading it.'; };

  var hist = [];
  var hIdx = 0;

  function print(cmd, result) {
    var p = document.createElement('p');
    p.className = 'gap';
    p.innerHTML = '<span class="ps">guest@param:~$</span> ' + esc(cmd);
    out.appendChild(p);
    if (result) {
      var r = document.createElement('p');
      r.innerHTML = result;
      out.appendChild(r);
    }
    out.scrollTop = out.scrollHeight;
  }

  function run(raw) {
    var line = raw.trim();
    if (!line) { print('', null); return; }
    hist.push(line);
    hIdx = hist.length;
    var parts = line.split(/\s+/);
    var name = parts[0].toLowerCase().replace(/,$/, '');
    var fn = COMMANDS[name];
    var result = fn ? fn(parts.slice(1)) : esc(name) + ': command not found. try <b>help</b>';
    if (name === 'clear') return;
    print(line, result);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    run(shellInput.value);
    shellInput.value = '';
  });

  shellInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') {
      if (hIdx > 0) { hIdx--; shellInput.value = hist[hIdx]; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (hIdx < hist.length - 1) { hIdx++; shellInput.value = hist[hIdx]; } else { hIdx = hist.length; shellInput.value = ''; }
      e.preventDefault();
    } else if (e.key === 'Tab') {
      var v = shellInput.value;
      var parts = v.split(' ');
      var pool = parts.length === 1 ? Object.keys(COMMANDS)
        : parts[0] === 'open' ? Object.keys(LINKS)
        : parts[0] === 'cat' ? ['about', 'certs', 'contact', 'motto', 'skills']
        : parts[0] === 'ls' ? ['projects', 'soc', 'writing'] : [];
      var last = parts[parts.length - 1];
      var hits = pool.filter(function (c) { return c.indexOf(last) === 0; });
      if (hits.length === 1) {
        parts[parts.length - 1] = hits[0];
        shellInput.value = parts.join(' ') + (parts.length === 1 ? ' ' : '');
      }
      if (last || parts.length > 1) e.preventDefault();
    } else if (e.key === 'Escape') {
      shellInput.blur();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      out.innerHTML = '';
    }
  });
})();
