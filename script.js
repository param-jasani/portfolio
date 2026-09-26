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
    return next;
  }
  themeBtn.addEventListener('click', toggleTheme);
  syncTheme();

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
      case 'j': window.scrollBy(0, step); break;
      case 'k': window.scrollBy(0, -step); break;
      case 'g': window.scrollTo(0, 0); break;
      case 'G': window.scrollTo(0, document.documentElement.scrollHeight); break;
      case 't': toggleTheme(); break;
      case '?': e.preventDefault(); openKeys(); break;
      case '/':
        e.preventDefault();
        document.getElementById('examples').scrollIntoView();
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
    blog: 'https://haxnation.org/blog/authors',
    writeups: 'https://param-jasani.github.io/sec-writeups',
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
        '  cat <file>      about | contact | motto | skills',
        '  open <name>     ' + Object.keys(LINKS).join(' '),
        '  stats           the numbers',
        '  theme           toggle light / dark',
        '  history         previous commands',
        '  clear           clear the screen',
        '  sudo hire param you know you want to'
      ].join('\n');
    },
    whoami: function () {
      return 'param-jasani (20), Mumbai. blue team / SOC engineer, backend developer,\nSOC scenario & CTF author @ HaxNation. handle: CVE';
    },
    ls: function (args) {
      var dir = (args[0] || '').replace(/\/$/, '').replace(/^~\//, '');
      if (!dir || dir === '~') return 'about.txt  contact.txt  motto.txt  skills.txt  projects/  soc/  writing/';
      if (dir === 'projects') return 'k8s-homelab/  soc-lab/  qualys-vmdr-lab/  elk-siem-pipeline/  enterprise-ad-lab/\nmayajal-core/  dispenser/  libmagic-rs/  secureroute/';
      if (dir === 'soc') return '14 scenarios, 321 alerts, all authored by param:\nromcom  kimsuky  cobalt-kitty  midnight-blizzard  silent-tide  midnight-cipher\nazure-echo  silent-echo  emotet-cascade  arctic-echo  phantom-receipt\nkongtuke  ghost-script  ghost-shell\n→ ' + link(LINKS.soc);
      if (dir === 'writing') return '10+ posts on the HaxNation blog, 4 DFIR / SOC writeups.\n→ ' + link(LINKS.blog) + '\n→ ' + link(LINKS.writeups);
      return 'ls: cannot access \'' + esc(dir) + '\': No such file or directory';
    },
    cat: function (args) {
      var f = (args[0] || '').replace(/\.txt$/, '');
      if (f === 'about') return 'I learn by building: a 19-node k8s cluster, a Splunk SOC, an ELK SIEM, an AD lab.\nI write SOC scenarios and CTF challenges, and Rust tools when I get bored.';
      if (f === 'contact') return link('mailto:' + EMAIL, EMAIL);
      if (f === 'motto') return '"Until death, all defeat is psychological."';
      if (f === 'skills') return 'soc:     splunk elk google-secops sysmon suricata qualys att&ck caldera\ninfra:   kubernetes rook-ceph haproxy docker terraform active-directory\nlang:    rust python java sql bash powershell\nbackend: django fastapi flask oracle mongodb';
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
      return 'tryhackme      top 1% · 296 rooms · 47 badges\nsoc-simulator  14 scenarios · 321 alerts\nhomelab        19 nodes · 7.5 TB ceph\nwriting        10+ posts\ngoogle-skills  diamond league';
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
        : parts[0] === 'cat' ? ['about', 'contact', 'motto', 'skills']
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
