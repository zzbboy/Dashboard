/* ============================================================
 * 公共访问门禁 (auth) —— 由 build_web.py 注入 PW_HASH 后生成
 * 行为:
 *   1. 页面加载即锁定 (body 隐藏 + 全屏遮罩)
 *   2. 未输入正确密码不得查看任何内容
 *   3. 密码错误时弹窗无法关闭 (无关闭按钮 / 点遮罩不关 / ESC 不关)
 *   4. 顶级页面验证通过后写入 sessionStorage 标记
 *   5. 处于 iframe 内且父页面已验证 -> 自动放行 (index 仅需自身弹窗)
 * ============================================================ */
(function () {
  "use strict";

  var PW_HASH = "c2e9f099aaf8777f04a1c958b7afa72c137a0d7e87d54e935c93cc6cdb6c2668";   // 由 build_web.py 注入 (sha256 hex)

  /* ---------- 纯 JS SHA-256 (无外部依赖, 兼容 file:// 与 https) ---------- */
  function sha256(ascii) {
    function r(x, n) { return (x >>> n) | (x << (32 - n)); }
    function a(x, y) { return (x + y) | 0; }
    function m(x, y) { return (x & y) ^ (~x & y); }
    function s(x, y) { return (x & y) ^ (x & ~y); }
    var K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var msg = [];
    for (var i = 0; i < ascii.length; i++) {
      var c = ascii.charCodeAt(i);
      if (c < 0x80) msg.push(c);
      else if (c < 0x800) { msg.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else if (c < 0xd800 || c >= 0xe000) { msg.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
      else { i++; c = 0x10000 + (((c & 0x3ff) << 10) | (ascii.charCodeAt(i) & 0x3ff));
        msg.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    var l = msg.length;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var bits = l * 8;
    // 64 位大端长度: 高 32 位在前 (短消息恒为 0), 低 32 位在后
    msg.push(0, 0, 0, 0, (bits >>> 24) & 0xff, (bits >>> 16) & 0xff, (bits >>> 8) & 0xff, bits & 0xff);
    for (var off = 0; off < msg.length; off += 64) {
      var w = [];
      for (var t = 0; t < 16; t++) w[t] = (msg[off + 4*t] << 24) | (msg[off + 4*t+1] << 16) | (msg[off + 4*t+2] << 8) | msg[off + 4*t+3];
      for (t = 16; t < 64; t++) {
        var x = w[t-15], y = w[t-2];
        w[t] = a(a(a(w[t-16], (r(x,7) ^ r(x,18) ^ (x >>> 3)) >>> 0), w[t-7]), (r(y,17) ^ r(y,19) ^ (y >>> 10)) >>> 0);
      }
      var a0=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for (t = 0; t < 64; t++) {
        var T1 = a(a(a(h, (r(e,6) ^ r(e,11) ^ r(e,25)) >>> 0), (e & f) ^ (~e & g)), a(K[t], w[t]));
        var T2 = a((r(a0,2) ^ r(a0,13) ^ r(a0,22)) >>> 0, (a0 & b) ^ (a0 & c) ^ (b & c));
        h=g; g=f; f=e; e=a(d, T1); d=c; c=b; b=a0; a0=a(T1, T2);
      }
      H[0]=a(H[0],a0);H[1]=a(H[1],b);H[2]=a(H[2],c);H[3]=a(H[3],d);
      H[4]=a(H[4],e);H[5]=a(H[5],f);H[6]=a(H[6],g);H[7]=a(H[7],h);
    }
    var out = "";
    for (var k = 0; k < 8; k++) out += ("00000000" + (H[k] >>> 0).toString(16)).slice(-8);
    return out;
  }

  /* ---------- DOM 辅助 ---------- */
  var doc = document, root = doc.documentElement;
  function el(tag, cls, html) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function lock() {
    root.classList.add("kq-locked");
  }

  function unlock() {
    root.classList.remove("kq-locked");
    var ov = doc.getElementById("kqOverlay");
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    try { sessionStorage.setItem("kq_auth_ok", "1"); } catch (e) {}
    window.__kq_authed = true;
    try { window.dispatchEvent(new Event("kq:auth-ok")); } catch (e) {}
  }

  function inIframe() { try { return window.self !== window.top; } catch (e) { return false; } }
  function parentAuthed() {
    // 读自己的 sessionStorage 即可: HTTP 下同 origin 与 index 共享; file:// 下同 tab 内 Chrome/Edge 也共享
    try { return inIframe() && sessionStorage.getItem("kq_auth_ok") === "1"; }
    catch (e) { return false; }
  }

  function showOverlay() {
    var css =
      "html.kq-locked,html.kq-locked body{height:100%;overflow:hidden}" +
      "html.kq-locked body{visibility:hidden}" +
      "#kqOverlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
      "background:linear-gradient(135deg,#1e293b 0%,#334155 60%,#0f172a 100%);font-family:'Microsoft YaHei','Segoe UI',sans-serif}" +
      "#kqOverlay *{visibility:visible}" +
      ".kq-card{background:rgba(255,255,255,.97);border-radius:14px;padding:34px 38px;width:340px;max-width:88vw;" +
      "box-shadow:0 24px 60px rgba(0,0,0,.45);text-align:center}" +
      ".kq-card h2{margin:0 0 6px;font-size:19px;color:#1e293b}" +
      ".kq-card p{margin:0 0 18px;font-size:13px;color:#64748b;line-height:1.6}" +
      ".kq-card input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd5e1;border-radius:8px;" +
      "font-size:15px;outline:none;transition:border-color .15s}" +
      ".kq-card input:focus{border-color:#38bdf8}" +
      ".kq-card button{margin-top:16px;width:100%;padding:11px 12px;border:none;border-radius:8px;background:#38bdf8;" +
      "color:#fff;font-size:15px;cursor:pointer;transition:background .15s}" +
      ".kq-card button:hover{background:#0ea5e9}" +
      ".kq-card .kq-err{margin-top:12px;color:#ef4444;font-size:13px;min-height:18px;opacity:0;transition:opacity .2s}" +
      ".kq-card .kq-err.show{opacity:1}" +
      ".kq-shake{animation:kqShake .4s}" +
      "@keyframes kqShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-9px)}40%{transform:translateX(8px)}" +
      "60%{transform:translateX(-6px)}80%{transform:translateX(4px)}}";
    var st = el("style"); st.textContent = css; doc.head.appendChild(st);

    var ov = el("div"); ov.id = "kqOverlay";
    var card = el("div", "kq-card");
    card.innerHTML =
      "<h2>🔒 访问验证</h2>" +
      "<p>请输入访问密码以查看数据看板</p>" +
      "<input id='kqPw' type='password' placeholder='访问密码' autocomplete='off' />" +
      "<button id='kqBtn' type='button'>进入看板</button>" +
      "<div class='kq-err' id='kqErr'>密码错误，请重试</div>";
    ov.appendChild(card);
    root.appendChild(ov);

    var input = doc.getElementById("kqPw");
    var err = doc.getElementById("kqErr");
    var btn = doc.getElementById("kqBtn");

    setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);

    function fail() {
      err.classList.add("show");
      card.classList.remove("kq-shake"); void card.offsetWidth; card.classList.add("kq-shake");
      input.value = ""; try { input.focus(); } catch (e) {}
    }
    function submit() {
      var v = input.value || "";
      if (!v) { fail(); return; }
      var h; try { h = sha256(v); } catch (e) { fail(); return; }
      if (h === PW_HASH) { unlock(); }
      else { fail(); }
    }

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });
    // 密码错误 / 未验证时弹窗无法关闭: 拦截 ESC、禁止点遮罩关闭
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); }
    });
    ov.addEventListener("mousedown", function (e) {
      if (e.target === ov) e.preventDefault();   // 点遮罩空白处不关闭
    });
  }

  /* ---------- 入口 ---------- */
  lock();
  if (parentAuthed()) {
    unlock();          // iframe 内且父已验证 -> 直接放行
  } else {
    showOverlay();
  }
})();
