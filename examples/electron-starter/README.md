# Electron starter

A minimal Electron app that shows real CPU and memory numbers in a nightdeck-ui panel.

```
npm install
npm start
```

- `main.js` opens the window and reads system numbers with Node's `os` module.
- `preload.js` passes them safely to the page (`contextIsolation` and `sandbox` are on).
- `renderer.js` builds the panel.

## Frameless windows

If you use a frameless window with `-webkit-app-region: drag` on a surrounding element, nightdeck-ui marks its controls and console as `-webkit-app-region: no-drag` so they remain interactive. Keep the title or other non-interactive areas available for dragging. Custom interactive elements that are not standard buttons, inputs or selects may need their own `no-drag` rule.
