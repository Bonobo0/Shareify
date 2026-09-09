/*
 * Server-action authorization regression tests.
 *
 * This loads the real files action through Next's Babel compiler while
 * replacing only authentication, database, rate-limit, and R2 boundaries.
 * No MongoDB or object storage service is contacted.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const actionPath = path.resolve(projectRoot, "src/actions/files.js");
const babel = require("next/dist/compiled/babel/core");
const nextBabelModule = require("next/babel");
const nextBabel = nextBabelModule.default || nextBabelModule;
const identifiers = {
  isFileHash: (value) =>
    typeof value === "string" && /^[0-9a-f]{32}$/i.test(value),
  isObjectIdString: (value) =>
    typeof value === "string" && /^[0-9a-f]{24}$/i.test(value),
  isShareLinkHash: (value) =>
    typeof value === "string" && /^[0-9a-f]{40}$/i.test(value),
};

const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ownerId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const parentId = "cccccccccccccccccccccccc";
const childDirectoryId = "dddddddddddddddddddddddd";
const ancestorDirectoryId = "eeeeeeeeeeeeeeeeeeeeeeee";
const fileHash = "f".repeat(32);

let mode = "media";
let currentUserId = null;
let mediaFile;
let parentFile;
let updateFile;
let childDirectory;
let ancestorDirectory;
let findOneCalls;
let directoryFindOneCalls;
let findByIdCalls;
let downloadUrlCalls;
let saveCalls;
let storageUpdateCalls;

function query(value) {
  const chain = {
    populate() {
      return chain;
    },
    select() {
      return chain;
    },
    lean: async () => value,
    exec: async () => value,
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return chain;
}

function resetFixtures() {
  mode = "media";
  currentUserId = null;
  findOneCalls = [];
  directoryFindOneCalls = [];
  findByIdCalls = [];
  downloadUrlCalls = 0;
  saveCalls = 0;
  storageUpdateCalls = 0;

  mediaFile = {
    _id: "111111111111111111111111",
    hash: fileHash,
    parentFile: parentId,
    path: "media-object",
    fileName: "media-object",
    deleted: false,
    uploaded: true,
  };
  parentFile = {
    _id: parentId,
    owner: ownerId,
    shared: [],
    parentDirectory: null,
    isPublic: false,
    deleted: false,
    uploaded: true,
  };
  updateFile = {
    _id: "222222222222222222222222",
    owner: ownerId,
    shared: [],
    parentDirectory: childDirectoryId,
    size: 100,
    path: "document-object",
    fileName: "document-object",
    deleted: false,
    save: async () => {
      saveCalls += 1;
    },
  };
  childDirectory = {
    _id: childDirectoryId,
    owner: ownerId,
    shared: [],
    parent: ancestorDirectoryId,
    shareLinks: [],
    deleted: false,
  };
  ancestorDirectory = {
    _id: ancestorDirectoryId,
    owner: ownerId,
    shared: [],
    parent: null,
    shareLinks: [],
    deleted: false,
  };
}

const fileModel = {
  findOne(filter) {
    findOneCalls.push(filter);
    if (mode === "media") {
      if (filter?.hash) {
        const matchesParent = String(filter.parentFile) === parentId;
        const requiresUploaded = filter.uploaded === true;
        return query(matchesParent && requiresUploaded ? mediaFile : null);
      }
      if (String(filter?._id) === parentId) return query(parentFile);
      return query(null);
    }
    return query(String(filter?._id) === updateFile._id ? updateFile : null);
  },
};

const directoryModel = {
  findOne(filter) {
    directoryFindOneCalls.push(filter);
    const id = String(filter?._id);
    if (mode === "media") {
      if (id === childDirectoryId) return query(childDirectory);
      if (id === ancestorDirectoryId) return query(ancestorDirectory);
      return query(null);
    }

    // completeFileUpdate asks for a directory with the caller's write/admin
    // share. Return the ancestor only when the fixture grants that permission.
    if (id === childDirectoryId) {
      // The first lookup loads the directory before its permission is checked;
      // only the query carrying $or represents the authorization check.
      if (!Array.isArray(filter?.$or)) return query(childDirectory);
      const hasWrite = childDirectory.shared?.some(
        (share) =>
          share.userId === userId && ["write", "admin"].includes(share.permission),
      );
      return query(hasWrite ? childDirectory : null);
    }
    if (id === ancestorDirectoryId) {
      if (!Array.isArray(filter?.$or)) return query(ancestorDirectory);
      const hasWrite = ancestorDirectory.shared?.some(
        (share) =>
          share.userId === userId && ["write", "admin"].includes(share.permission),
      );
      return query(hasWrite ? ancestorDirectory : null);
    }
    return query(null);
  },
  findById(id) {
    findByIdCalls.push(id);
    const value =
      String(id) === childDirectoryId
        ? childDirectory
        : String(id) === ancestorDirectoryId
          ? ancestorDirectory
          : null;
    return query(value);
  },
};

const userModel = {
  findByIdAndUpdate(...args) {
    storageUpdateCalls += 1;
    return Promise.resolve(args);
  },
};

const mockedModules = {
  "@/lib/auth/serverAuth": {
    getAuthenticatedUser: async () => currentUserId,
    requireAuthenticatedUser: async () => currentUserId,
  },
  "@/lib/db/mongodb": {
    connectToDatabase: async () => {},
  },
  "@/lib/actionRateLimit": {
    checkActionRateLimit: async () => ({ allowed: true }),
  },
  "@/models/File": fileModel,
  "@/models/Directory": directoryModel,
  "@/models/User": userModel,
  "@/lib/r2/r2Client": {
    generateUploadUrl: async () => "https://upload.test/object",
    generateDownloadUrl: async () => {
      downloadUrlCalls += 1;
      return "https://download.test/object";
    },
    generateUniqueFilename: (name) => name,
    generateFileHash: () => fileHash,
    deleteObject: async () => {},
  },
  "@/lib/security/identifiers.mjs": identifiers,
};

const originalLoad = Module._load;
const originalJsLoader = require.extensions[".js"];
const bundledBabelRuntime = path.resolve(
  projectRoot,
  "node_modules/next/dist/compiled/@babel/runtime",
);

require.extensions[".js"] = (module, filename) => {
  if (path.resolve(filename) !== actionPath) {
    return originalJsLoader(module, filename);
  }

  const source = fs.readFileSync(filename, "utf8");
  const transformed = babel.transformSync(source, {
    filename,
    sourceType: "unambiguous",
    presets: [nextBabel],
  });
  module._compile(transformed.code, filename);
};

Module._load = (request, parent, isMain) => {
  if (mockedModules[request]) return mockedModules[request];
  if (request.startsWith("@babel/runtime/")) {
    const runtimeModule = path.resolve(
      bundledBabelRuntime,
      request.slice("@babel/runtime/".length),
    );
    return originalLoad(runtimeModule, parent, isMain);
  }
  return originalLoad(request, parent, isMain);
};

const { completeFileUpdate, getEditorMediaUrl, prepareFileUpdate } =
  require(actionPath);

test.beforeEach(() => {
  resetFixtures();
});

test("editor media URL is allowed for a public parent and stays parent-bound", async () => {
  parentFile.isPublic = true;

  const result = await getEditorMediaUrl({
    fileHash,
    parentFileId: parentId,
  });

  assert.deepEqual(result, {
    success: true,
    url: "https://download.test/object",
  });
  assert.deepEqual(findOneCalls[0], {
    hash: fileHash,
    parentFile: parentId,
    deleted: { $ne: true },
    uploaded: true,
  });
  assert.equal(downloadUrlCalls, 1);
});

test("editor media URL denies a private parent to an unauthenticated caller", async () => {
  const result = await getEditorMediaUrl({
    fileHash,
    parentFileId: parentId,
  });

  assert.match(result.error, /접근할 권한/);
  assert.equal(downloadUrlCalls, 0);
});

test("prepareFileUpdate preserves a valid zero original size", async () => {
  mode = "update";
  currentUserId = userId;
  ancestorDirectory.shared = [{ userId, permission: "write" }];
  updateFile.isEncrypted = true;
  updateFile.originalSize = 0;

  const result = await prepareFileUpdate({ fileId: updateFile._id });

  assert.equal(result.success, true);
  assert.equal(result.originalSize, 0);
});

test("completeFileUpdate preserves write access inherited from an ancestor directory", async () => {
  mode = "update";
  currentUserId = userId;
  ancestorDirectory.shared = [{ userId, permission: "write" }];

  const result = await completeFileUpdate({
    fileId: updateFile._id,
    newSize: 120,
  });

  assert.equal(result.success, true);
  assert.equal(saveCalls, 1);
  assert.equal(storageUpdateCalls, 1);
  assert.equal(updateFile.size, 120);
  assert.deepEqual(
    directoryFindOneCalls
      .filter((filter) =>
        [childDirectoryId, ancestorDirectoryId].includes(String(filter?._id)),
      )
      .map((filter) => String(filter._id)),
    [childDirectoryId, childDirectoryId, ancestorDirectoryId, ancestorDirectoryId],
  );
});

test("completeFileUpdate denies a read-only ancestor and does not save", async () => {
  mode = "update";
  currentUserId = userId;
  ancestorDirectory.shared = [{ userId, permission: "read" }];

  const result = await completeFileUpdate({
    fileId: updateFile._id,
    newSize: 120,
  });

  assert.match(result.error, /수정할 권한/);
  assert.equal(saveCalls, 0);
  assert.equal(storageUpdateCalls, 0);
  assert.equal(downloadUrlCalls, 0);
});
