'use server'

import { requireAuthenticatedUser } from '@/lib/auth/serverAuth'

const AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://localhost:8000'

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

export async function aiUploadComplete(fileId, filename, mimetype) {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/upload-complete`, {
      method: 'POST',
      headers: aiHeaders(),
      body: JSON.stringify({ fileId, filename, mimetype }),
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
  try {
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
  try {
    const userId = await requireAuthenticatedUser()

    const response = await fetch(`${AI_BACKEND_URL}/search`, {
      method: 'POST',
      headers: aiHeaders(),
      body: JSON.stringify({ query, filters, userId }),
    })

    if (!response.ok) {
      const text = await response.text()
      return { error: `AI 검색 실패: ${response.status} ${text}` }
    }

    const data = await response.json()
    // snake_case → camelCase 변환 및 fileId 기준 중복 제거 (가장 높은 score 유지)
    const seen = new Map()
    for (const r of data.results ?? []) {
      const fileId = r.fileId ?? r.file_id
      if (!fileId) continue
      const normalized = { ...r, fileId, file_id: undefined }
      const prev = seen.get(fileId)
      if (!prev || (r.score ?? 0) > (prev.score ?? 0)) {
        seen.set(fileId, normalized)
      }
    }
    let results = [...seen.values()]
    // 파일 타입(확장자) 필터 적용 (AI 백엔드가 처리하지 않으므로 직접 필터링)
    if (filters.fileTypes?.length > 0) {
      const exts = new Set(filters.fileTypes.map(t => t.toLowerCase()))
      results = results.filter(r => {
        const ext = r.filename?.split('.').pop()?.toLowerCase()
        return ext && exts.has(ext)
      })
    }
    return { success: true, results }
  } catch (err) {
    return { error: `AI 백엔드 연결 실패: ${err.message}` }
  }
}

export async function aiDeleteFile(fileId) {
  try {
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
