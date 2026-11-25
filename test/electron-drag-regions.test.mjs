import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const code = readFileSync(new URL("../dist/nightdeck.js", import.meta.url), "utf8");
const assets = ["src/nightdeck.css", "dist/nightdeck.css", "dist/nightdeck.min.css", "docs/lib/nightdeck.min.css"];

for (const asset of assets) {
  test(`${asset}: interactive regions exclude Electron window dragging`, () => {
    const dom = new JSDOM('<div id="app"></div><button id="outside">Outside</button>', { runScripts: "outside-only" });
    try {
      const { document } = dom.window;
      dom.window.eval(code);
      dom.window.Nightdeck.create("#app", {
        tabs: { Main: [
          { type: "toggle", id: "toggle" },
          { type: "slider", id: "slider" },
          { type: "select", id: "select", options: ["a", "b"] },
          { type: "text", id: "text" },
          { type: "button", id: "button" }
        ] },
        presets: { Default: {} }
      });
      const style = document.createElement("style");
      style.textContent = readFileSync(new URL("../" + asset, import.meta.url), "utf8");
      document.head.append(style);
      // jsdom checks the actual stylesheet selectors, not native Electron hit testing.
      const exclusions = Array.from(style.sheet.cssRules).filter(rule =>
        rule.selectorText && rule.style.getPropertyValue("-webkit-app-region") === "no-drag"
      );
      const excluded = element => exclusions.some(rule => element.matches(rule.selectorText));
      for (const selector of [".nd-tab", ".nd-opt", ".nd-slider", ".nd-field", ".nd-opt input",
        ".nd-slider input", ".nd-field select", '.nd-field input[type="text"]',
        ".nd-item-btn", ".nd-foot button", ".nd-console"]) {
        const elements = document.querySelectorAll(selector);
        assert.ok(elements.length, selector + " exists");
        for (const element of elements) assert.ok(excluded(element), selector + " must be no-drag");
      }
      assert.equal(excluded(document.querySelector("#outside")), false);
      assert.equal(excluded(document.querySelector(".nd-title")), false);
      assert.equal(excluded(document.querySelector(".nd-root")), false);
    } finally {
      dom.window.close();
    }
  });
}
