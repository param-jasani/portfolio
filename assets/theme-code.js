/* Easter egg: type the secret code anywhere (or into any text box) to cycle
   to the next site theme. Pure static, no backend. */
(function () {
  'use strict';

  var CODE = 'e502ma-zerobook';
  // Order of the cycle, relative to the site root.
  var THEMES = ['index.html', 'themes/siem/index.html', 'themes/broadsheet/index.html'];

  var me = document.currentScript && document.currentScript.src;
  if (!me) return;
  var root = me.replace(/assets\/theme-code\.js(\?.*)?$/, '');

  function currentIndex() {
    var here = location.href.split(/[?#]/)[0];
    for (var i = THEMES.length - 1; i > 0; i--) {
      if (here.indexOf(root + THEMES[i].replace('index.html', '')) === 0) return i;
    }
    return 0;
  }

  var fired = false;
  function unlock() {
    if (fired) return;
    fired = true;
    var next = THEMES[(currentIndex() + 1) % THEMES.length];
    var toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.textContent = '> access granted: switching theme…';
    toast.style.cssText = 'position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:2147483647;' +
      'background:#000;color:#fff;border:1px solid #fff;padding:10px 16px;' +
      'font:600 14px/1.4 ui-monospace,Consolas,monospace;letter-spacing:.02em;';
    document.body.appendChild(toast);
    setTimeout(function () { location.href = root + next; }, 700);
  }

  // Physical keyboards: rolling buffer of the last typed characters.
  var buf = '';
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-CODE.length);
    if (buf === CODE) unlock();
  }, true);

  // Mobile keyboards often don't report keys, so also watch text fields.
  document.addEventListener('input', function (e) {
    var v = e.target && typeof e.target.value === 'string' ? e.target.value.toLowerCase() : '';
    if (v.indexOf(CODE) !== -1) unlock();
  }, true);
})();
