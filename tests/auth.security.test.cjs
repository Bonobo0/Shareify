/* Security regression tests for reset/email tokens and MFA setup. */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')

const projectRoot = path.resolve(__dirname, '..')
const authPath = path.resolve(projectRoot, 'src/actions/auth.js')
const verificationPath = path.resolve(projectRoot, 'src/actions/verification.js')
const actionPaths = new Set([authPath, verificationPath])
const babel = require('next/dist/compiled/babel/core')
const nextBabelModule = require('next/babel')
const nextBabel = nextBabelModule.default || nextBabelModule

const currentUserId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
let connectCalls = 0
let rateLimitCalls = 0
let findOneCalls = []
let findByIdCalls = []
let saveCalls = 0
let mailCalls = 0
let mfaUser = { twoFactorEnabled: false }

function query(value) {
  const promise = Promise.resolve(value)
  return {
    select: () => query(value),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  }
}

const userModel = {
  findOne(filter) {
    findOneCalls.push(filter)
    return query(null)
  },
  findById(id) {
    findByIdCalls.push(id)
    return query({
      ...mfaUser,
      save: async () => {
        saveCalls += 1
      },
    })
  },
}

const mockedModules = {
  '@/lib/db/mongodb': {
    connectToDatabase: async () => {
      connectCalls += 1
    },
  },
  '@/models/User': userModel,
  '@/lib/auth/serverAuth': {
    requireAuthenticatedUser: async () => currentUserId,
  },
  '@/lib/auth/jwt': {
    generateTokenPair: async () => ({}),
    verifyToken: async () => null,
    verifyAccessToken: async () => null,
    rotateRefreshToken: async () => null,
  },
  '@/lib/redis/client': {
    invalidateRefreshToken: async () => {},
    invalidateAllUserRefreshTokens: async () => {},
    invalidateAllUserRefreshTokensExcept: async () => {},
    listUserRefreshTokenSessions: async () => [],
  },
  'next/headers': {
    cookies: async () => ({ get: () => undefined, set: () => {} }),
    headers: async () => ({ get: () => undefined }),
  },
  '@/lib/email/emailService': {
    generateVerificationToken: () => 'a'.repeat(64),
    sendVerificationEmail: async () => {
      mailCalls += 1
      return { success: true }
    },
    send2FASetupEmail: async () => {
      mailCalls += 1
      return { success: true }
    },
    sendPasswordResetEmail: async () => {
      mailCalls += 1
      return { success: true }
    },
  },
  '@/lib/auth/twoFactor': {
    verify2FAToken: () => true,
    verifyBackupCode: () => ({ valid: false, index: -1 }),
    generate2FASecret: () => ({ secret: 'SECRET', otpauth_url: 'otpauth://test' }),
    generateQRCode: async () => ({ success: true, qrCode: 'data:' }),
    generateBackupCodes: () => [],
  },
  '@/lib/actionRateLimit': {
    checkActionRateLimit: async () => {
      rateLimitCalls += 1
      return { allowed: true }
    },
  },
  '@/lib/validation': {
    validatePassword: () => ({ valid: true }),
    validateEmail: () => ({ valid: true }),
  },
  '@/lib/security/tokens.mjs': {
    isHexToken: (value) =>
      typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value),
  },
}

const originalLoad = Module._load
const originalJsLoader = require.extensions['.js']
const bundledBabelRuntime = path.resolve(
  projectRoot,
  'node_modules/next/dist/compiled/@babel/runtime',
)

require.extensions['.js'] = (module, filename) => {
  if (!actionPaths.has(path.resolve(filename))) {
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
    return originalLoad(
      path.resolve(bundledBabelRuntime, request.slice('@babel/runtime/'.length)),
      parent,
      isMain,
    )
  }
  return originalLoad(request, parent, isMain)
}

const {
  verifyPasswordResetToken,
  resetPassword,
} = require(authPath)
const { verifyEmail, enable2FA } = require(verificationPath)

function resetState() {
  connectCalls = 0
  rateLimitCalls = 0
  findOneCalls = []
  findByIdCalls = []
  saveCalls = 0
  mailCalls = 0
  mfaUser = { twoFactorEnabled: false }
}

test.beforeEach(resetState)

test('reset and verification reject Mongo-shaped or malformed tokens before DB access', async () => {
  const invalidTokens = [
    undefined,
    null,
    { $ne: null },
    'a'.repeat(63),
    'a'.repeat(65),
    `${'a'.repeat(63)}z`,
  ]

  for (const token of invalidTokens) {
    const resetCheck = await verifyPasswordResetToken(token === null ? null : { token })
    const reset = await resetPassword({
      token,
      newPassword: 'valid-password',
      confirmPassword: 'valid-password',
    })
    const email = await verifyEmail(token === null ? null : { token })

    assert.ok(resetCheck.error)
    assert.ok(reset.error)
    assert.ok(email.error)
  }

  assert.equal(connectCalls, 0)
  assert.equal(findOneCalls.length, 0)
  assert.equal(saveCalls, 0)
  assert.equal(mailCalls, 0)
  assert.equal(rateLimitCalls, invalidTokens.length)
})

test('a 32-byte hex token is passed as an exact scalar query value', async () => {
  const token = '0123456789abcdef'.repeat(4)

  const result = await verifyPasswordResetToken({ token })

  assert.ok(result.error)
  assert.equal(connectCalls, 1)
  assert.equal(findOneCalls.length, 1)
  assert.equal(findOneCalls[0].passwordResetToken, token)
})

test('enable2FA cannot replace an already-enabled authenticator', async () => {
  mfaUser = { twoFactorEnabled: true, twoFactorSecret: 'old-secret' }

  const result = await enable2FA({ token: '123456', secret: 'new-secret' })

  assert.match(result.error, /이미 2단계 인증/)
  assert.equal(findByIdCalls.length, 1)
  assert.equal(saveCalls, 0)
  assert.equal(mailCalls, 0)
})
