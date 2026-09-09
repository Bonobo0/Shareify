/*
 * LiveEditor save regression tests.
 *
 * These tests intentionally keep the test-only renderer and Babel/jsdom
 * dependencies outside the application package. Run them with:
 *
 * NODE_PATH=/tmp/shareify-editor-tests/node_modules:$PWD/node_modules \
 *   node tests/liveEditor.save.test.cjs
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

// Use the Babel compiler bundled with Next so the test only needs jsdom as an
// additional dependency. LiveEditor is the only application JSX module that
// this harness loads; its server and browser-only imports are mocked below.
const babel = require("next/dist/compiled/babel/core");
const nextBabelModule = require("next/babel");
const nextBabel = nextBabelModule.default || nextBabelModule;
require.extensions[".jsx"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const transformed = babel.transformSync(source, {
    filename: path.resolve(filename),
    sourceType: "unambiguous",
    presets: [nextBabel],
  });
  module._compile(transformed.code, filename);
};

const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "MutationObserver",
  "File",
  "Blob",
  "FileReader",
  "CustomEvent",
  "Event",
  "KeyboardEvent",
]) {
  if (dom.window[key]) global[key] = dom.window[key];
}

global.IS_REACT_ACT_ENVIRONMENT = true;
global.requestAnimationFrame = (callback) => callback();
global.cancelAnimationFrame = () => {};
window.requestAnimationFrame = global.requestAnimationFrame;
window.cancelAnimationFrame = global.cancelAnimationFrame;

const realSetTimeout = global.setTimeout;
const realClearTimeout = global.clearTimeout;

const timerState = {
  now: 0,
  nextId: 1,
  timers: new Map(),
};

function fakeSetTimeout(callback, delay = 0, ...args) {
  const id = timerState.nextId++;
  timerState.timers.set(id, {
    callback,
    args,
    due: timerState.now + Math.max(0, Number(delay) || 0),
  });
  return id;
}

function fakeClearTimeout(id) {
  timerState.timers.delete(id);
}

function installFakeTimers() {
  timerState.now = 0;
  timerState.nextId = 1;
  timerState.timers.clear();
  global.setTimeout = fakeSetTimeout;
  global.clearTimeout = fakeClearTimeout;
  window.setTimeout = fakeSetTimeout;
  window.clearTimeout = fakeClearTimeout;
}

function restoreRealTimers() {
  global.setTimeout = realSetTimeout;
  global.clearTimeout = realClearTimeout;
  window.setTimeout = realSetTimeout;
  window.clearTimeout = realClearTimeout;
  timerState.timers.clear();
}

async function flushMicrotasks() {
  // React state updates and the mocked async server actions each need a
  // separate microtask turn. A real timer lets React flush scheduled work.
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
    await new Promise((resolve) => realSetTimeout(resolve, 0));
  }
}

async function advanceTime(milliseconds) {
  const target = timerState.now + milliseconds;

  while (true) {
    const dueTimers = [...timerState.timers.entries()]
      .filter(([, timer]) => timer.due <= target)
      .sort(([, a], [, b]) => a.due - b.due);

    if (dueTimers.length === 0) break;

    const [id, timer] = dueTimers[0];
    timerState.timers.delete(id);
    timerState.now = timer.due;
    timer.callback(...timer.args);
    await flushMicrotasks();
  }

  timerState.now = target;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const mockState = {
  editor: null,
  editorSaveCalls: 0,
  prepareCalls: 0,
  completeCalls: 0,
  encryptCalls: 0,
  encryptedPasswords: [],
  uploadCalls: [],
  prepareImpl: async () => ({
    success: true,
    uploadUrl: "https://upload.test/document",
  }),
  encryptImpl: async () => ({
    success: true,
    encryptedFile: new Blob(["encrypted"], {
      type: "application/octet-stream",
    }),
  }),
};

function resetMockState() {
  mockState.editor = null;
  mockState.editorSaveCalls = 0;
  mockState.prepareCalls = 0;
  mockState.completeCalls = 0;
  mockState.encryptCalls = 0;
  mockState.encryptedPasswords = [];
  mockState.uploadCalls = [];
  mockState.prepareImpl = async () => ({
    success: true,
    uploadUrl: "https://upload.test/document",
  });
  mockState.encryptImpl = async () => ({
    success: true,
    encryptedFile: new Blob(["encrypted"], {
      type: "application/octet-stream",
    }),
  });
}

function responseForDocument() {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        time: 1,
        blocks: [{ type: "paragraph", data: { text: "initial" } }],
      }),
    blob: async () => new Blob(["uploaded"]),
  };
}

global.fetch = async (url, options = {}) => {
  if (options.method === "PUT") {
    mockState.uploadCalls.push({ url, options });
    return { ok: true, status: 200 };
  }
  return responseForDocument();
};
window.fetch = global.fetch;

function MockEditorJS({ defaultValue, onInitialize, onChange, readOnly }) {
  const dataRef = React.useRef(defaultValue);
  const changeHandlerRef = React.useRef(onChange);
  const editorRef = React.useRef(null);
  changeHandlerRef.current = onChange;

  if (!editorRef.current) {
    editorRef.current = {
      save: async () => {
        mockState.editorSaveCalls += 1;
        return clone(dataRef.current);
      },
      setData(nextData) {
        dataRef.current = nextData;
        changeHandlerRef.current?.();
      },
    };
  }

  React.useEffect(() => {
    dataRef.current = defaultValue;
  }, [defaultValue]);

  React.useEffect(() => {
    mockState.editor = editorRef.current;
    onInitialize?.(editorRef.current);
    return () => {
      if (mockState.editor === editorRef.current) mockState.editor = null;
    };
  }, [onInitialize]);

  return React.createElement(
    "div",
    { "data-testid": "mock-editor", "data-readonly": String(readOnly) },
    "mock editor",
  );
}

function createReactEditorJS() {
  return MockEditorJS;
}

const filesMock = {
  prepareFileUpdate: async (...args) => {
    mockState.prepareCalls += 1;
    return mockState.prepareImpl(...args);
  },
  completeFileUpdate: async (...args) => {
    mockState.completeCalls += 1;
    return { success: true, args };
  },
  uploadEditorMedia: async () => ({ error: "unused" }),
  completeEditorMediaUpload: async () => ({ error: "unused" }),
  getEditorMediaUrl: async () => ({ error: "unused" }),
};

const aiMock = {
  aiDeleteFile: async () => ({ success: true }),
  aiUploadComplete: async () => ({ success: true }),
};

const encryptionMock = {
  encryptFile: async (file, password) => {
    mockState.encryptCalls += 1;
    mockState.encryptedPasswords.push(password);
    return mockState.encryptImpl(file, password);
  },
};

const iconMock = new Proxy(
  {},
  {
    get: (_target, property) => property,
  },
);

const moduleMocks = new Map([
  ["react-editor-js", { createReactEditorJS }],
  ["@editorjs/header", class Header {}],
  ["@editorjs/list", class List {}],
  ["@editorjs/checklist", class Checklist {}],
  ["@editorjs/quote", class Quote {}],
  ["@editorjs/code", class CodeTool {}],
  ["@editorjs/delimiter", class Delimiter {}],
  ["@editorjs/inline-code", class InlineCode {}],
  ["@editorjs/marker", class Marker {}],
  ["@editorjs/table", class Table {}],
  ["@editorjs/image", class ImageTool {}],
  ["@fortawesome/react-fontawesome", {
    FontAwesomeIcon: () => React.createElement("span"),
  }],
  ["@fortawesome/free-solid-svg-icons", iconMock],
  ["jszip", class JSZip {}],
  ["file-saver", { saveAs: () => {} }],
  ["@/actions/files", filesMock],
  ["@/app/actions/ai", aiMock],
  ["@/lib/crypto/encryption", encryptionMock],
]);

const originalModuleLoad = Module._load;
Module._load = function loadWithMocks(request, parent, isMain) {
  if (moduleMocks.has(request)) return moduleMocks.get(request);
  if (request.startsWith("@babel/runtime/")) {
    return originalModuleLoad.call(
      this,
      `next/dist/compiled/${request}`,
      parent,
      isMain,
    );
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};

const LiveEditorModule = require("../src/app/components/liveEditor.jsx");
const LiveEditor = LiveEditorModule.default;
const {
  blocksToHtml,
  sanitizeEditorData,
  sanitizeMediaUrl,
} = LiveEditorModule;

let root;
let container;

async function mountLiveEditor({ file, fileUrl = "mock://document", ...props } = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  const defaultFile = {
    id: "file-1",
    originalName: "document.ejtxt",
    isEncrypted: false,
  };

  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(LiveEditor, {
        file: file || defaultFile,
        fileUrl,
        ...props,
      }),
    );
    await flushMicrotasks();
  });

  assert.ok(mockState.editor, "the mocked EditorJS instance should initialize");
}

async function unmountLiveEditor() {
  if (root) {
    await act(async () => {
      root.unmount();
      await flushMicrotasks();
    });
  }
  root = null;
  container?.remove();
  container = null;
}

function saveButton() {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent.includes("저장"),
  );
}

async function editDocument(text) {
  await act(async () => {
    mockState.editor.setData({
      time: 2,
      blocks: [{ type: "paragraph", data: { text } }],
    });
    await flushMicrotasks();
  });
}

async function clickSave() {
  await act(async () => {
    saveButton().click();
    await flushMicrotasks();
  });
}

async function pressControlS() {
  await act(async () => {
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "s",
        code: "KeyS",
        ctrlKey: true,
        bubbles: true,
      }),
    );
    await flushMicrotasks();
  });
}

test.beforeEach(() => {
  resetMockState();
  installFakeTimers();
});

test.afterEach(async () => {
  await unmountLiveEditor();
  restoreRealTimers();
});

test("the first edit reaches autosave after 30 seconds", async () => {
  await mountLiveEditor();
  await editDocument("changed once");

  await act(async () => {
    await advanceTime(29999);
  });
  assert.equal(mockState.prepareCalls, 0);

  await act(async () => {
    await advanceTime(1);
    await flushMicrotasks();
  });
  assert.equal(mockState.prepareCalls, 1);
  assert.equal(mockState.completeCalls, 1);
});

test("changes during a long save stay dirty and schedule another autosave", async () => {
  const firstPrepare = deferred();
  mockState.prepareImpl = () => firstPrepare.promise;

  await mountLiveEditor();
  await editDocument("first snapshot");
  await clickSave();
  assert.equal(mockState.prepareCalls, 1);

  await editDocument("newer snapshot while saving");
  await act(async () => {
    await advanceTime(30000);
  });
  assert.equal(
    mockState.prepareCalls,
    1,
    "the timer that expires during an in-flight save must not duplicate it",
  );

  mockState.prepareImpl = async () => ({
    success: true,
    uploadUrl: "https://upload.test/document-2",
  });
  firstPrepare.resolve({
    success: true,
    uploadUrl: "https://upload.test/document-1",
  });
  await act(async () => {
    await flushMicrotasks();
  });

  assert.match(container.textContent, /수정됨/);

  await act(async () => {
    await advanceTime(29999);
  });
  assert.equal(mockState.prepareCalls, 1);

  await act(async () => {
    await advanceTime(1);
    await flushMicrotasks();
  });
  assert.equal(mockState.prepareCalls, 2);
  assert.equal(mockState.completeCalls, 2);
});

test("Ctrl+S while saving does not start a duplicate request", async () => {
  const pendingPrepare = deferred();
  mockState.prepareImpl = () => pendingPrepare.promise;

  await mountLiveEditor();
  await editDocument("save once");
  await clickSave();
  assert.equal(mockState.prepareCalls, 1);

  await pressControlS();
  assert.equal(mockState.prepareCalls, 1);

  mockState.prepareImpl = async () => ({
    success: true,
    uploadUrl: "https://upload.test/document",
  });
  pendingPrepare.resolve({
    success: true,
    uploadUrl: "https://upload.test/document",
  });
  await act(async () => {
    await flushMicrotasks();
  });
  assert.equal(mockState.completeCalls, 1);
});

test("Ctrl+S in read-only mode performs no writes", async () => {
  await mountLiveEditor({ readOnly: true });
  await pressControlS();

  assert.equal(mockState.prepareCalls, 0);
  assert.equal(mockState.completeCalls, 0);
  assert.equal(mockState.uploadCalls.length, 0);
});

test("an encrypted document without a password cannot be saved as plaintext", async () => {
  await mountLiveEditor({
    file: {
      id: "encrypted-1",
      originalName: "secret.ejtxt",
      isEncrypted: true,
    },
  });
  await pressControlS();

  assert.equal(mockState.prepareCalls, 0);
  assert.equal(mockState.encryptCalls, 0);
  assert.equal(mockState.uploadCalls.length, 0);
  assert.match(container.textContent, /오류/);
});

test("encrypted saves preserve the original password string", async () => {
  const password = "  keep surrounding spaces  ";
  await mountLiveEditor({
    file: {
      id: "encrypted-2",
      originalName: "secret.ejtxt",
      isEncrypted: true,
    },
    encryptionPassword: password,
  });
  await editDocument("encrypted content");
  await clickSave();

  assert.deepEqual(mockState.encryptedPasswords, [password]);
  assert.equal(mockState.prepareCalls, 1);
  assert.equal(mockState.completeCalls, 1);
  assert.equal(mockState.uploadCalls.length, 1);
});

test("sanitizes rich text fields while preserving code and inline formatting", () => {
  const code = '<script>window.__codeMarker = 1</script> && <tag>';
  const sanitized = sanitizeEditorData({
    time: 1,
    blocks: [
      {
        type: "paragraph",
        data: {
          text: '<strong>kept</strong><img src=x onerror="window.__auditMarker=1"><script>window.__auditMarker=2</script><a href="javascript:alert(1)">link</a>',
        },
      },
      {
        type: "list",
        data: {
          style: "unordered",
          items: [
            {
              content: "parent",
              items: ["<em>child</em><svg onload=alert(1) />"],
            },
          ],
        },
      },
      {
        type: "checklist",
        data: { items: [{ text: "<u>task</u><iframe src=x></iframe>", checked: false }] },
      },
      {
        type: "quote",
        data: { text: "<mark>quote</mark>", caption: "<b>caption</b><script>bad()</script>" },
      },
      {
        type: "table",
        data: { content: [["<b>head</b>"], ["<i>cell</i><object data=x></object>"]] },
      },
      { type: "code", data: { code } },
    ],
  });

  const paragraph = sanitized.blocks[0].data.text;
  assert.match(paragraph, /<strong>kept<\/strong>/);
  assert.doesNotMatch(paragraph, /script|onerror|javascript:/i);
  assert.equal(sanitized.blocks[5].data.code, code);
  assert.match(sanitized.blocks[1].data.items[0].items[0], /<em>child<\/em>/);
  assert.doesNotMatch(sanitized.blocks[1].data.items[0].items[0], /svg|onload/i);
  assert.match(sanitized.blocks[2].data.items[0].text, /<u>task<\/u>/);
  assert.doesNotMatch(sanitized.blocks[2].data.items[0].text, /iframe/i);
  assert.match(sanitized.blocks[3].data.caption, /<b>caption<\/b>/);
  assert.doesNotMatch(sanitized.blocks[3].data.caption, /script/i);
  assert.match(sanitized.blocks[4].data.content[0][0], /<b>head<\/b>/);
  assert.doesNotMatch(sanitized.blocks[4].data.content[1][0], /object/i);

  const host = document.createElement("div");
  host.innerHTML = paragraph;
  assert.equal(host.querySelector("script"), null);
  assert.equal(host.querySelector("[onerror]"), null);
  assert.equal(global.__auditMarker, undefined);
  assert.equal(window.__auditMarker, undefined);
});

test("HTML export escapes code and rejects executable image URLs", () => {
  const code = '<script>window.__exportMarker = 1</script>';
  const html = blocksToHtml([
    { type: "code", data: { code } },
    {
      type: "image",
      data: {
        file: { url: "javascript:window.__exportMarker=2" },
        caption: '<img src=x onerror="window.__exportMarker=3">caption',
      },
    },
  ]);
  const host = document.createElement("div");
  host.innerHTML = html;

  assert.equal(host.querySelector("script"), null);
  assert.equal(host.querySelector("pre code").textContent, code);
  assert.equal(host.querySelector("img").getAttribute("src"), null);
  assert.match(host.querySelector("figcaption").textContent, /caption/);
  assert.equal(sanitizeMediaUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeMediaUrl("data:image/svg+xml;base64,PHN2Zz4="), "");
  assert.equal(window.__exportMarker, undefined);
});
