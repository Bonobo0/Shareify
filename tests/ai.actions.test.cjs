/*
 * AI action authorization regression tests.
 *
 * The action is loaded through the Babel compiler bundled with Next. Database,
 * auth, and the AI backend are mocked so these tests exercise the actual
 * action code without requiring a running MongoDB or AI service.
 */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')

const projectRoot = path.resolve(__dirname, '..')
const actionPath = path.resolve(projectRoot, 'src/app/actions/ai.js')
const babel = require('next/dist/compiled/babel/core')
const nextBabelModule = require('next/babel')
const nextBabel = nextBabelModule.default || nextBabelModule

const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const otherUserId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const fileId = '111111111111111111111111'
const otherFileId = '222222222222222222222222'
const encryptedFileId = '333333333333333333333333'
const directoryId = '444444444444444444444444'
const ancestorDirectoryId = '555555555555555555555555'

let currentUserId = userId
let backendCalls = []
let connectCalls = 0
const files = new Map()
const directories = new Map()

function query(value) {
  return { lean: async () => value }
}

function fileMatches(record, filter) {
  if (!record || !filter) return false
  if (filter._id && String(record._id) !== String(filter._id)) return false
  if (filter.deleted?.$ne === true && record.deleted === true) return false
  return true
}

const fileModel = {
  findOne(filter) {
    return query([...files.values()].find((file) => fileMatches(file, filter)))
  },
  find(filter) {
    const ids = filter?._id?.$in
    const selected = [...files.values()].filter((file) => {
      if (Array.isArray(ids) && !ids.some((id) => String(id) === String(file._id))) {
        return false
      }
      return filter.deleted?.$ne === true ? file.deleted !== true : true
    })
    return query(selected)
  },
}

const directoryModel = {
  findOne(filter) {
    return query(directories.get(String(filter?._id)))
  },
}

const mockedModules = {
  '@/lib/auth/serverAuth': {
    requireAuthenticatedUser: async () => currentUserId,
  },
  '@/lib/db/mongodb': {
    connectToDatabase: async () => {
      connectCalls += 1
    },
  },
  '@/models/File': fileModel,
  '@/models/Directory': directoryModel,
}

const originalLoad = Module._load
const originalJsLoader = require.extensions['.js']
const bundledBabelRuntime = path.resolve(
  projectRoot,
  'node_modules/next/dist/compiled/@babel/runtime',
)
require.extensions['.js'] = (module, filename) => {
  if (path.resolve(filename) !== actionPath) {
    return originalJsLoader(module, filename)
  }

  const source = fs.readFileSync(filename, 'utf8')
  const transformed = babel.transformSync(source, {
    filename,
    sourceType: 'unambiguous',
    presets: [nextBabel],
  })
  module._compile(transformed.code, filename)
}
Module._load = (request, parent, isMain) => {
  if (mockedModules[request]) return mockedModules[request]
  if (request.startsWith('@babel/runtime/')) {
    const runtimeModule = path.resolve(
      bundledBabelRuntime,
      request.slice('@babel/runtime/'.length),
    )
    return originalLoad(runtimeModule, parent, isMain)
  }
  return originalLoad(request, parent, isMain)
}

process.env.AI_BACKEND_URL = 'http://ai.test'
const {
  aiUploadComplete,
  aiFileStatus,
  aiSearch,
  aiDeleteFile,
  aiTopics,
} = require(actionPath)

function makeFile(id = fileId, overrides = {}) {
  return {
    _id: id,
    owner: otherUserId,
    originalName: 'database-name.pdf',
    mimetype: 'application/pdf',
    uploaded: true,
    isEncrypted: false,
    shared: [],
    parentDirectory: null,
    deleted: false,
    ...overrides,
  }
}

function resetFixtures() {
  currentUserId = userId
  backendCalls = []
  connectCalls = 0
  files.clear()
  directories.clear()
  files.set(fileId, makeFile())
}

function responseFor(url) {
  if (url.endsWith('/search')) {
    return {
      results: [
        { file_id: fileId, filename: 'backend-spoof.txt', score: 0.9 },
        { file_id: otherFileId, filename: 'private.txt', score: 0.8 },
        { file_id: encryptedFileId, filename: 'secret.txt', score: 0.7 },
      ],
    }
  }
  if (url.endsWith('/topics')) return { topics: ['one'] }
  if (url.includes('/file-status/')) return { status: 'ready', progress: 100 }
  return { fileId, status: 'processing' }
}

global.fetch = async (url, options = {}) => {
  backendCalls.push({ url: String(url), options })
  return {
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => responseFor(String(url)),
  }
}

test.beforeEach(() => {
  resetFixtures()
})

test('unauthenticated AI actions never call the backend', async () => {
  currentUserId = null

  const results = await Promise.all([
    aiUploadComplete(fileId, 'client.txt', 'text/plain'),
    aiFileStatus(fileId),
    aiDeleteFile(fileId),
    aiTopics(),
    aiSearch('secret'),
  ])

  assert.equal(backendCalls.length, 0)
  assert.equal(connectCalls, 0)
  for (const result of results) assert.match(result.error, /로그인/)
})

test('upload requires write access and sends database metadata', async () => {
  const file = files.get(fileId)
  file.shared = [{ userId, permission: 'write' }]

  const result = await aiUploadComplete(fileId, 'client-spoof.txt', 'text/plain')

  assert.equal(result.success, true)
  assert.equal(backendCalls.length, 1)
  const request = JSON.parse(backendCalls[0].options.body)
  assert.deepEqual(request, {
    fileId,
    filename: 'database-name.pdf',
    mimetype: 'application/pdf',
  })
})

test('write and read permissions inherit through ancestor directories', async () => {
  const file = files.get(fileId)
  file.parentDirectory = directoryId
  directories.set(directoryId, {
    _id: directoryId,
    owner: otherUserId,
    shared: [],
    parent: ancestorDirectoryId,
    deleted: false,
  })
  directories.set(ancestorDirectoryId, {
    _id: ancestorDirectoryId,
    owner: otherUserId,
    shared: [{ userId, permission: 'write' }],
    parent: null,
    deleted: false,
  })

  const upload = await aiUploadComplete(fileId)
  const status = await aiFileStatus(fileId)

  assert.equal(upload.success, true)
  assert.equal(status.success, true)
  assert.equal(backendCalls.length, 2)
})

test('files without write permission cannot be indexed or deleted', async () => {
  const upload = await aiUploadComplete(fileId)
  const deletion = await aiDeleteFile(fileId)

  assert.match(upload.error, /수정할 권한/)
  assert.match(deletion.error, /수정할 권한/)
  assert.equal(backendCalls.length, 0)
})

test('encrypted files never reach AI indexing endpoints', async () => {
  files.set(encryptedFileId, makeFile(encryptedFileId, {
    owner: userId,
    isEncrypted: true,
    originalName: 'secret.pdf',
  }))

  const upload = await aiUploadComplete(encryptedFileId)
  const status = await aiFileStatus(encryptedFileId)
  const deletion = await aiDeleteFile(encryptedFileId)

  assert.match(upload.error, /암호화된 파일/)
  assert.match(status.error, /암호화된 파일/)
  assert.match(deletion.error, /암호화된 파일/)
  assert.equal(backendCalls.length, 0)
})

test('search filters backend results by database access and metadata', async () => {
  files.set(fileId, makeFile(fileId, { owner: userId }))
  files.set(otherFileId, makeFile(otherFileId, { owner: otherUserId }))
  files.set(encryptedFileId, makeFile(encryptedFileId, {
    owner: userId,
    isEncrypted: true,
  }))

  const result = await aiSearch('report')

  assert.equal(result.success, true)
  assert.equal(result.results.length, 1)
  assert.equal(result.results[0].fileId, fileId)
  assert.equal(result.results[0].filename, 'database-name.pdf')
  assert.equal(result.results[0].mimetype, 'application/pdf')
})

test('status requires read access before contacting the backend', async () => {
  const file = files.get(fileId)
  file.shared = [{ userId, permission: 'read' }]

  const result = await aiFileStatus(fileId)

  assert.equal(result.success, true)
  assert.equal(backendCalls.length, 1)
  assert.match(backendCalls[0].url, /file-status/)
})
