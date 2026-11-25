// Tests for nightdeck-ui. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

// objects made inside jsdom come from another "realm", so compare plain copies
const plain = (x) => JSON.parse(JSON.stringify(x));
const code = readFileSync(new URL("../dist/nightdeck.js", import.meta.url), "utf8");

function setup(options) {
  const dom = new JSDOM('<!DOCTYPE html><div id="app"></div>', { runScripts: "outside-only" });
  dom.window.eval(code);
  const N = dom.window.Nightdeck;
  const panel = options ? N.create("#app", options) : null;
  return { dom, N, panel, doc: dom.window.document };
}

const config = () => ({
  title: "Test",
  tabs: {
    one: [
      { type: "toggle", id: "a", label: "toggle a", value: true },
      { type: "slider", id: "s", label: "slider", value: 40, min: 0, max: 50 },
      { type: "select", id: "q", label: "quality", options: ["low", "high"], value: "low" },
      { type: "text", id: "t", label: "name", value: "x" }
    ],
    two: [
      { type: "meter", id: "m", label: "meter", value: 10 },
      { type: "info", id: "i", label: "info", value: "hello" },
      { type: "button", id: "b", label: "press" }
    ]
  },
  presets: { max: { s: 50, q: "high" } }
});

test("exposes create and a version", () => {
  const { N } = setup();
  assert.equal(typeof N.create, "function");
  assert.match(N.version, /^\d+\.\d+\.\d+$/);
});

test("builds tabs, panes and items", () => {
  const { doc } = setup(config());
  assert.equal(doc.querySelectorAll(".nd-tab").length, 2);
  assert.equal(doc.querySelectorAll('[role="tabpanel"]').length, 2);
  assert.equal(doc.querySelector(".nd-title").textContent, "Test");
});

test("exposes a labelled switch with native checked state", () => {
  const { doc, panel } = setup(config());
  const input = doc.querySelector('input[role="switch"]');
  assert.ok(input);
  assert.equal(input.type, "checkbox");
  assert.equal(input.labels[0].textContent, "toggle a");
  assert.equal(input.checked, true);
  input.click();
  assert.equal(input.checked, false);
  assert.equal(panel.get("a"), false);
});

test("get, set and values", () => {
  const { panel } = setup(config());
  assert.deepEqual(plain(panel.values()), { a: true, s: 40, q: "low", t: "x" });
  panel.set("a", false).set("q", "high").set("t", "y");
  assert.equal(panel.get("a"), false);
  assert.equal(panel.get("q"), "high");
  assert.equal(panel.get("t"), "y");
});

test("sliders stay inside min and max", () => {
  const { panel } = setup(config());
  panel.set("s", 500);
  assert.equal(panel.get("s"), 50);
  panel.set("s", -5);
  assert.equal(panel.get("s"), 0);
});

test("change events fire only when a value really changes", () => {
  const { panel } = setup(config());
  const seen = [];
  panel.on("change", (id, value) => seen.push([id, value]));
  panel.set("a", true);           // already true
  panel.set("a", false);
  panel.set("s", 10, { silent: true });
  assert.deepEqual(seen, [["a", false]]);
});

test("presets and reset report each changed value", () => {
  const { panel } = setup(config());
  const seen = [];
  panel.on("change", (id) => seen.push(id));
  panel.preset("max");
  assert.deepEqual(seen.sort(), ["q", "s"]);
  seen.length = 0;
  panel.reset();
  assert.deepEqual(plain(panel.values()), { a: true, s: 40, q: "low", t: "x" });
  assert.deepEqual(seen.sort(), ["q", "s"]);
});

test("meters and info rows update and change colour", () => {
  const { panel, doc } = setup(config());
  panel.set("m", 75, { text: "busy" });
  const meter = panel.item("m");
  assert.ok(meter.classList.contains("nd-warn"));
  assert.equal(meter.querySelector("output").textContent, "busy");
  panel.set("m", 100);
  assert.ok(meter.classList.contains("nd-full"));
  panel.set("i", "world");
  assert.equal(panel.item("i").querySelector("output").textContent, "world");
});

test("buttons fire action events", () => {
  const { panel } = setup(config());
  let got = null;
  panel.on("action", (id) => { got = id; });
  panel.item("b").click();
  assert.equal(got, "b");
});

test("tabs switch by click and arrow keys", () => {
  const { panel, doc, dom } = setup(config());
  assert.equal(panel.tab, "one");
  doc.querySelectorAll(".nd-tab")[1].click();
  assert.equal(panel.tab, "two");
  const tabs = doc.querySelector(".nd-tabs");
  tabs.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  assert.equal(panel.tab, "one");
  tabs.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  assert.equal(panel.tab, "two");
});

test("clear errors for mistakes", () => {
  const { N, doc } = setup();
  assert.throws(() => N.create("#nope", {}), /target not found/);
  assert.throws(() => N.create("#app", { tabs: { a: [{ id: "x" }, { id: "x" }] } }), /duplicate id/);
  assert.throws(() => N.create("#app", { tabs: { a: [{ type: "wheel", id: "w" }] } }), /unknown item type/);
  const p = N.create("#app", config());
  assert.throws(() => p.set("missing", 1), /no item/);
  assert.throws(() => p.preset("missing"), /no preset/);
});

test("labels are shown as text, not HTML", () => {
  const { doc } = setup({ tabs: { "<b>x</b>": [{ id: "a", label: "<img src=x onerror=alert(1)>" }] } });
  assert.equal(doc.querySelector("img"), null);
  assert.equal(doc.querySelector(".nd-tab").textContent, "<b>x</b>");
});

test("the console keeps at most maxLog lines", () => {
  const { panel, doc } = setup({ ...config(), maxLog: 5 });
  for (let i = 0; i < 20; i++) panel.log("line " + i);
  assert.equal(doc.querySelectorAll(".nd-line").length, 5);
});

test("destroy empties the target", () => {
  const { panel, doc } = setup(config());
  panel.destroy();
  assert.equal(doc.getElementById("app").children.length, 0);
});

test("the short forms from older versions still work", () => {
  const { panel } = setup({ tabs: { a: [{ id: "on", label: "x", on: true }, { id: "r", label: "y", range: 30 }] } });
  assert.deepEqual(plain(panel.values()), { on: true, r: 30 });
});
