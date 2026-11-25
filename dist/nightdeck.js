/*! nightdeck-ui v0.1.0 | (c) 2026 mvhmuod | MIT License */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else if (typeof define === "function" && define.amd) define([], factory);
  else root.Nightdeck = factory();
})(typeof self !== "undefined" ? self : this, function () {
function nightdeckFactory() {
  "use strict";

  var VERSION = "0.1.0";
  var INPUTS = { toggle: 1, slider: 1, select: 1, text: 1 }; // controls that hold a value
  var uid = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  // Short forms from earlier versions: { on: true } is a toggle, { range: 50 } is a slider.
  function normalize(it) {
    var o = {}; for (var k in it) o[k] = it[k];
    if (!o.type) {
      if (o.range !== undefined) { o.type = "slider"; if (o.value === undefined) o.value = o.range; }
      else if (o.options) o.type = "select";
      else o.type = "toggle";
    }
    if (o.type === "toggle" && o.value === undefined) o.value = !!o.on;
    return o;
  }

  function create(target, options) {
    if (typeof document === "undefined") throw new Error("nightdeck-ui: needs a browser (document is not available)");
    var host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host || !host.nodeType) throw new Error("nightdeck-ui: target not found: " + target);
    if (host.__nightdeck) host.__nightdeck.destroy();

    var o = {
      title: "Panel", version: "", tabs: {}, presets: {}, console: true, reset: true, maxLog: 500,
      onChange: null, onAction: null, onSelect: null
    };
    for (var key in options || {}) o[key] = options[key];

    var id = "nd" + (++uid), listeners = {}, controls = {}, defaults = {}, tabNames = Object.keys(o.tabs), current = null;

    // ---- skeleton
    host.classList.add("nd-root");
    host.innerHTML = "";
    var win = el("section", "nd-win nd-menu"), body = el("div", "nd-body"), side = el("div", "nd-side");
    var title = el("h1", "nd-title", o.title), tabsEl = el("div", "nd-tabs"), panes = el("div", "nd-panes");
    tabsEl.setAttribute("role", "tablist"); tabsEl.setAttribute("aria-orientation", "vertical");
    side.append(title, tabsEl); body.append(side, panes); win.append(body);
    var foot = el("div", "nd-foot");
    if (o.reset) foot.append(button("reset", "nd-btn", function () { reset(); }));
    Object.keys(o.presets).forEach(function (p) { foot.append(button(p, "nd-btn", function () { preset(p); })); });
    var footText = el("small", "nd-foot-text", o.version); foot.append(footText); win.append(foot);
    host.append(win);
    var logEl = null;
    if (o.console) {
      var con = el("section", "nd-win nd-console"), inner = el("div", "nd-inner");
      logEl = el("div", "nd-log"); logEl.setAttribute("aria-live", "polite"); logEl.setAttribute("role", "log");
      inner.append(el("h2", "nd-ctitle", typeof o.console === "string" ? o.console : "Console"), logEl);
      con.append(inner); host.append(con);
    }

    function button(label, cls, fn) {
      var b = el("button", cls, label); b.type = "button"; b.addEventListener("click", fn); return b;
    }

    // ---- tabs and controls
    tabNames.forEach(function (name, i) {
      var tid = id + "-tab-" + i, pid = id + "-pane-" + i;
      var t = el("button", "nd-tab", name);
      t.type = "button"; t.id = tid; t.dataset.tab = name;
      t.setAttribute("role", "tab"); t.setAttribute("aria-controls", pid); t.tabIndex = -1;
      tabsEl.append(t);
      var pane = el("div", "nd-pane"); pane.id = pid; pane.dataset.pane = name;
      pane.setAttribute("role", "tabpanel"); pane.setAttribute("aria-labelledby", tid);
      (o.tabs[name] || []).forEach(function (raw) { pane.append(build(normalize(raw))); });
      panes.append(pane);
    });

    function register(c) {
      if (!c.id) throw new Error("nightdeck-ui: every item needs an id (" + (c.label || c.type) + ")");
      if (controls[c.id]) throw new Error("nightdeck-ui: duplicate id \"" + c.id + "\"");
      controls[c.id] = c;
    }

    function build(c) {
      var wrap, input;
      switch (c.type) {
        case "toggle":
          wrap = el("label", "nd-opt");
          input = el("input"); input.type = "checkbox"; input.checked = !!c.value;
          input.setAttribute("role", "switch");
          wrap.append(input, el("span", "nd-box"), document.createTextNode(c.label || c.id));
          c.read = function () { return input.checked; };
          c.write = function (v) { input.checked = !!v; };
          input.addEventListener("change", function () { changed(c.id); });
          break;
        case "slider":
          wrap = el("label", "nd-slider");
          var head = el("div"), out = el("output");
          head.append(document.createTextNode(c.label || c.id), out);
          input = el("input"); input.type = "range";
          c.min = num(c.min, 0); c.max = num(c.max, 100); c.step = num(c.step, 1);
          input.min = c.min; input.max = c.max; input.step = c.step; input.value = clamp(num(c.value, c.min), c.min, c.max);
          var paint = function () {
            input.style.setProperty("--nd-fill", ((input.value - c.min) / (c.max - c.min || 1) * 100) + "%");
            out.textContent = input.value + (c.unit || "");
          };
          wrap.append(head, input); paint();
          c.read = function () { return Number(input.value); };
          c.write = function (v) { input.value = clamp(num(v, c.min), c.min, c.max); paint(); };
          input.addEventListener("input", paint);
          input.addEventListener("change", function () { changed(c.id); });
          break;
        case "select":
          wrap = el("label", "nd-field");
          input = el("select", "nd-input");
          (c.options || []).forEach(function (op) {
            var v = typeof op === "object" ? op.value : op, l = typeof op === "object" ? (op.label != null ? op.label : op.value) : op;
            var e = el("option", null, l); e.value = String(v); input.append(e);
          });
          if (c.value !== undefined) input.value = String(c.value);
          wrap.append(el("span", "nd-label", c.label || c.id), input);
          c.read = function () { return input.value; };
          c.write = function (v) { input.value = String(v); };
          input.addEventListener("change", function () { changed(c.id); });
          break;
        case "text":
          wrap = el("label", "nd-field");
          input = el("input", "nd-input"); input.type = "text"; input.value = c.value != null ? String(c.value) : "";
          if (c.placeholder) input.placeholder = c.placeholder;
          wrap.append(el("span", "nd-label", c.label || c.id), input);
          c.read = function () { return input.value; };
          c.write = function (v) { input.value = v == null ? "" : String(v); };
          input.addEventListener("change", function () { changed(c.id); });
          break;
        case "button":
          wrap = button(c.label || c.id, "nd-btn" + (c.variant ? " nd-" + c.variant : ""), function () {
            log(c.id); emit("action", c.id);
          });
          wrap.classList.add("nd-item-btn");
          break;
        case "meter":
          wrap = el("div", "nd-meter");
          var mh = el("div"), mo = el("output"), bar = el("div", "nd-bar"), fill = el("i");
          mh.append(document.createTextNode(c.label || c.id), mo); bar.append(fill); wrap.append(mh, bar);
          bar.setAttribute("role", "meter"); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "100");
          bar.setAttribute("aria-label", c.label || c.id);
          c.warn = num(c.warn, 50);
          c.show = function (v, text) {
            v = clamp(num(v, 0), 0, 100);
            fill.style.width = v + "%"; bar.setAttribute("aria-valuenow", String(Math.round(v)));
            wrap.classList.toggle("nd-warn", v > c.warn && v < 100); wrap.classList.toggle("nd-full", v >= 100);
            mo.textContent = text != null ? text : Math.round(v) + "%";
          };
          c.show(c.value, c.text);
          break;
        case "info":
          wrap = el("div", "nd-info");
          var io = el("output", null, c.value != null ? c.value : "-");
          wrap.append(el("span", null, c.label || c.id), io);
          c.show = function (v) { io.textContent = v == null ? "-" : String(v); };
          break;
        case "custom":
          wrap = el("div", "nd-custom");
          if (typeof c.render === "function") c.render(wrap, api);
          break;
        default:
          throw new Error("nightdeck-ui: unknown item type \"" + c.type + "\"");
      }
      if (c.wide) wrap.classList.add("nd-wide");
      if (c.id || INPUTS[c.type]) register(c);
      c.el = wrap;
      if (INPUTS[c.type]) defaults[c.id] = c.read();
      return wrap;
    }

    // ---- events
    function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return api; }
    function off(ev, fn) { listeners[ev] = (listeners[ev] || []).filter(function (f) { return f !== fn; }); return api; }
    function emit(ev) {
      var args = [].slice.call(arguments, 1);
      var opt = { change: o.onChange, action: o.onAction, select: o.onSelect }[ev];
      if (opt) opt.apply(api, args);
      (listeners[ev] || []).slice().forEach(function (f) { f.apply(api, args); });
    }
    function show(v) { return v === true ? "on" : v === false ? "off" : v; }
    function changed(cid) { var v = get(cid); log(cid + " = " + show(v)); emit("change", cid, v, values()); }

    // ---- public methods
    function get(cid) { var c = controls[cid]; return c && c.read ? c.read() : undefined; }
    function values() { var v = {}; for (var k in controls) if (controls[k].read) v[k] = controls[k].read(); return v; }
    function set(cid, value, opts) {
      var c = controls[cid];
      if (!c) throw new Error("nightdeck-ui: no item with id \"" + cid + "\"");
      if (c.show) { c.show(value, opts && opts.text); return api; } // meter / info
      if (!c.write) return api;
      var before = c.read(); c.write(value);
      if (!(opts && opts.silent) && c.read() !== before) changed(cid);
      return api;
    }
    function apply(map) { for (var k in map) if (controls[k] && controls[k].write) set(k, map[k]); }
    function reset() { apply(defaults); log("reset to defaults"); emit("reset", values()); return api; }
    function preset(name) {
      if (!o.presets[name]) throw new Error("nightdeck-ui: no preset \"" + name + "\"");
      apply(o.presets[name]); log("preset " + name); emit("preset", name, values()); return api;
    }
    function select(name, focus) {
      if (tabNames.indexOf(name) < 0) return api;
      current = name;
      [].forEach.call(tabsEl.children, function (t) {
        var on = t.dataset.tab === name; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      [].forEach.call(panes.children, function (p) { p.hidden = p.dataset.pane !== name; });
      emit("select", name);
      return api;
    }
    function log(text) {
      if (!logEl) return api;
      var line = el("div", "nd-line"), d = new Date(), t = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return (n < 10 ? "0" : "") + n; }).join(":");
      line.append(el("i", null, "[" + t + "] "), document.createTextNode(String(text)));
      logEl.append(line);
      while (logEl.childNodes.length > o.maxLog) logEl.removeChild(logEl.firstChild);
      logEl.scrollTop = logEl.scrollHeight;
      return api;
    }
    function clearLog() { if (logEl) logEl.textContent = ""; return api; }
    function setFooter(text) { footText.textContent = text == null ? "" : String(text); return api; }
    function destroy() {
      host.innerHTML = ""; host.classList.remove("nd-root"); listeners = {}; controls = {};
      tabsEl.removeEventListener("click", onTabClick); tabsEl.removeEventListener("keydown", onTabKey);
      delete host.__nightdeck;
    }

    // ---- tab interaction: click, arrow keys, Home, End
    function onTabClick(e) { var t = e.target.closest(".nd-tab"); if (t) select(t.dataset.tab); }
    function onTabKey(e) {
      var i = tabNames.indexOf(current), n = tabNames.length, k = e.key;
      if (k === "ArrowDown" || k === "ArrowRight") i = (i + 1) % n;
      else if (k === "ArrowUp" || k === "ArrowLeft") i = (i - 1 + n) % n;
      else if (k === "Home") i = 0;
      else if (k === "End") i = n - 1;
      else return;
      e.preventDefault(); select(tabNames[i], true);
    }
    tabsEl.addEventListener("click", onTabClick);
    tabsEl.addEventListener("keydown", onTabKey);

    var api = {
      get: get, set: set, values: values, reset: reset, preset: preset, select: select,
      log: log, clearLog: clearLog, setFooter: setFooter, on: on, off: off, destroy: destroy,
      item: function (cid) { return controls[cid] ? controls[cid].el : null; },
      get tab() { return current; },
      el: host
    };
    // custom items were rendered before api existed; give them the finished api now
    for (var k in controls) if (controls[k].type === "custom" && typeof controls[k].render === "function" && !controls[k].el.childNodes.length) controls[k].render(controls[k].el, api);
    host.__nightdeck = api;
    if (tabNames.length) select(tabNames[0]);
    return api;
  }

  return { create: create, version: VERSION, escape: esc };
}

  return nightdeckFactory();
});
