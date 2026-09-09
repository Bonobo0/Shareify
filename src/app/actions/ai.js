'use server'

import { requireAuthenticatedUser } from '@/lib/auth/serverAuth'
import { connectToDatabase } from '@/lib/db/mongodb'
import File from '@/models/File'
import Directory from '@/models/Directory'

const AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://localhost:8000'
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i
const READ_PERMISSIONS = new Set(['read', 'write', 'admin'])
const WRITE_PERMISSIONS = new Set(['write', 'admin'])

/**
 * Build common headers for AI backend requests.
 * Attaches AI_CLIENT_TOKEN as a Bearer token when the env var is set.
 */
function aiHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra }
  const token = (process.env.AI_CLIENT_TOKEN || '').trim()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function toId(value) {
  if (value && typeof value === 'object' && value._id) {
    return toId(value._id)
  }
  if (value === null || value === undefined) return null
  return typeof value.toString === 'function' ? value.toString() : null
}

function isSafeFileId(fileId) {
  return typeof fileId === 'string' && OBJECT_ID_PATTERN.test(fileId)
}

function hasSharedPermission(shared, userId, permissions) {
  const userKey = toId(userId)
  if (!userKey || !Array.isArray(shared)) return false

  return shared.some((entry) => {
    if (!entry || toId(entry.userId) !== userKey) return false
    return permissions.has(entry.permission || 'read')
  })
}

function hasDirectPermission(resource, userId, permissions) {
  const userKey = toId(userId)
  if (!userKey || !resource) return false

  return (
    toId(resource.owner) === userKey ||
    hasSharedPermission(resource.shared, userKey, permissions)
  )
}

/**
 * A file inherits access from any ancestor directory. Keep this check on the
 * server: the client-provided filename and permission-shaped filters are not
 * an authorization boundary.
 */
async function hasFilePermission(file, userId, permissions) {
  if (hasDirectPermission(file, userId, permissions)) return true

  let directoryId = toId(file?.parentDirectory)
  const visited = new Set()

  while (directoryId && !visited.has(directoryId)) {
    visited.add(directoryId)
    const directory = await Directory.findOne({
      _id: directoryId,
      deleted: { $ne: true },
    }).lean()

    if (!directory) break
    if (hasDirectPermission(directory, userId, permissions)) return true
    directoryId = toId(directory.parent)
  }

  return false
}

function fileAccessError(permissions) {
  return permissions === WRITE_PERMISSIONS
    ? '파일을 수정할 권한이 없습니다.'
    : '파일을 조회할 권한이 없습니다.'
}

async function getAuthorizedFile(fileId, userId, permissions) {
  if (!isSafeFileId(fileId)) {
    return { error: '파일을 찾을 수 없습니다.' }
  }

  await connectToDatabase()
  const file = await File.findOne({
    _id: fileId,
    deleted: { $ne: true },
  }).lean()

  if (!file) return { error: '파일을 찾을 수 없습니다.' }
  if (!(await hasFilePermission(file, userId, permissions))) {
    return { error: fileAccessError(permissions) }
  }

  return { file }
}

function getIndexabilityError(file) {
  if (file?.isEncrypted) {
    return { error: '암호화된 파일은 AI 인덱싱을 지원하지 않습니다.' }
  }
  if (file?.uploaded !== true) {
    return { error: '파일 업로드가 완료되지 않았습니다.' }
  }
  if (typeof file?.originalName !== 'string' || typeof file?.mimetype !== 'string') {
    return { error: '파일 메타데이터를 확인할 수 없습니다.' }
  }
  return null
}

async function getAuthorizedSearchFiles(fileIds, userId) {
  const safeFileIds = [
    ...new Set(fileIds.filter((fileId) => isSafeFileId(fileId))),
  ]
  if (safeFileIds.length === 0) return new Map()

  await connectToDatabase()
  const files = await File.find({
    _id: { $in: safeFileIds },
    deleted: { $ne: true },
  }).lean()
  const authorizedFiles = new Map()

  for (const file of files) {
    if (file?.isEncrypted || file?.uploaded !== true) continue
    if (await hasFilePermission(file, userId, READ_PERMISSIONS)) {
      const fileId = toId(file._id)
      if (fileId) authorizedFiles.set(fileId, file)
    }
  }

  return authorizedFiles
}

async function getAiUser() {
  const userId = await requireAuthenticatedUser()
  if (!userId) return { error: '로그인이 필요합니다.' }
  return { userId }
}

export async function aiUploadComplete(fileId) {
  const auth = await getAiUser()
  if (auth.error) return auth

  try {
    const access = await getAuthorizedFile(fileId, auth.userId, WRITE_PERMISSIONS)
    if (access.error) return access

    const indexabilityError = getIndexabilityError(access.file)
    if (indexabilityError) return indexabilityError

    // Always use metadata loaded from the database. Client-supplied values are
    // intentionally ignored because this action is a server-side trust
    // boundary.
    const response = await fetch(`${AI_BACKEND_URL}/upload-complete`, {
      method: 'POST',
      headers: aiHeaders(),
      body: JSON.stringify({
        fileId,
        filename: access.file.originalName,
        mimetype: access.file.mimetype,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return { error: `AI 인덱싱 요청 실패: ${response.status} ${text}` }
    }

    const data = await response.json()
    return { success: true, fileId: data.fileId ?? fileId, status: data.status ?? 'processing' }
  } catch (err) {
    return { error: `AI 백엔드 연결 실패: ${err.message}` }
  }
}

export async function aiFileStatus(fileId) {
  const auth = await getAiUser()
  if (auth.error) return auth

  try {
    const access = await getAuthorizedFile(fileId, auth.userId, READ_PERMISSIONS)
    if (access.error) return access

    const indexabilityError = getIndexabilityError(access.file)
    if (indexabilityError) return indexabilityError

    const response = await fetch(`${AI_BACKEND_URL}/file-status/${encodeURIComponent(fileId)}`, {
      method: 'GET',
      headers: aiHeaders(),
    })

    if (!response.ok) {
      const text = await response.text()
      return { error: `상태 확인 실패: ${response.status} ${text}` }
    }

    const data = await response.json()
    return { success: true, fileId, status: data.status, progress: data.progress }
  } catch (err) {
    return { error: `AI 백엔드 연결 실패: ${err.message}` }
  }
}

export async function aiSearch(query, filters = {}) {
  const auth = await getAiUser()
  if (auth.error) return auth

  try {
    const safeFilters = filters && typeof filters === 'object' ? filters : {}
    const response = await fetch(`${AI_BACKEND_URL}/search`, {
      method: 'POST',
      headers: aiHeaders(),
      body: JSON.stringify({ query, filters: safeFilters, userId: auth.userId }),
    })

    if (!response.ok) {
      const text = await response.text()
      return { error: `AI 검색 실패: ${response.status} ${text}` }
    }

    const data = await response.json()
    // snake_case → camelCase 변환 및 fileId 기준 중복 제거 (가장 높은 score 유지)
    const seen = new Map()
    for (const r of Array.isArray(data.results) ? data.results : []) {
      const fileId = r?.fileId ?? r?.file_id
      if (!isSafeFileId(fileId)) continue
      const normalized = { ...r, fileId, file_id: undefined }
      const prev = seen.get(fileId)
      if (!prev || (r.score ?? 0) > (prev.score ?? 0)) {
        seen.set(fileId, normalized)
      }
    }
    let results = [...seen.values()]
    // 음수 score 결과 제거
    results = results.filter((r) => (r.score ?? 0) >= 0)

    // AI 백엔드의 결과는 신뢰하지 않고, 현재 사용자의 DB 권한을 다시
    // 확인한다. 암호화 파일은 인덱싱 대상이 아니므로 결과에서도 제외한다.
    const authorizedFiles = await getAuthorizedSearchFiles(
      results.map((result) => result.fileId),
      auth.userId,
    )
    results = results
      .filter((result) => authorizedFiles.has(result.fileId))
      .map((result) => {
        const file = authorizedFiles.get(result.fileId)
        return {
          ...result,
          filename: file.originalName,
          mimetype: file.mimetype,
        }
      })

    // 파일 타입(확장자) 필터 적용 (AI 백엔드가 처리하지 않으므로 직접 필터링)
    if (Array.isArray(safeFilters.fileTypes) && safeFilters.fileTypes.length > 0) {
      const exts = new Set(safeFilters.fileTypes.map((type) => String(type).toLowerCase()))
      results = results.filter((result) => {
        const ext = result.filename?.split('.').pop()?.toLowerCase()
        return ext && exts.has(ext)
      })
    }
    return { success: true, results }
  } catch (err) {
    return { error: `AI 백엔드 연결 실패: ${err.message}` }
  }
}

export async function aiDeleteFile(fileId) {
  const auth = await getAiUser()
  if (auth.error) return auth

  try {
    const access = await getAuthorizedFile(fileId, auth.userId, WRITE_PERMISSIONS)
    if (access.error) return access

    const indexabilityError = getIndexabilityError(access.file)
    if (indexabilityError) return indexabilityError

    const response = await fetch(`${AI_BACKEND_URL}/file/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: aiHeaders(),
    })
    if (!response.ok) {
      const text = await response.text()
      return { error: `AI 인덱스 삭제 실패: ${response.status} ${text}` }
    }
    return { success: true }
  } catch (err) {
    return { error: `AI 백엔드 연결 실패: ${err.message}` }
  }
}

export async function aiTopics() {
  const auth = await getAiUser()
  if (auth.error) return auth

  try {
    const response = await fetch(`${AI_BACKEND_URL}/topics`, {
      method: 'GET',
      headers: aiHeaders(),
    })

    if (!response.ok) {
      const text = await response.text()
      return { error: `토픽 목록 조회 실패: ${response.status} ${text}` }
    }

    const data = await response.json()
    return { success: true, topics: data.topics ?? [] }
  } catch (err) {
    return { error: `AI 백엔드 연결 실패: ${err.message}` }
  }
}
