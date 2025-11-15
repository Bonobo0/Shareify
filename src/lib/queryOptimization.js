/**
 * Query optimization utilities for better database performance
 */

/**
 * 사용자의 파일 접근 권한 필터를 생성하는 헬퍼 함수
 * @param {string} userId - 사용자 ID
 * @param {string} directoryId - 디렉토리 ID (선택적)
 * @returns {Object} MongoDB 필터 객체
 */
export function buildFileAccessFilter(userId, directoryId = null) {
  const mongoose = require("mongoose");
  const ObjectId = mongoose.Types.ObjectId;

  if (directoryId) {
    // 특정 디렉토리의 파일들
    return {
      parentDirectory: new ObjectId(directoryId),
      deleted: { $ne: true },
    };
  }

  // 루트 디렉토리의 파일들
  return {
    $or: [
      // 소유한 파일 중 루트에 있는 것들
      {
        owner: new ObjectId(userId),
        parentDirectory: null,
      },
      // 직접 공유받은 파일들
      {
        shared: {
          $elemMatch: {
            userId: new ObjectId(userId),
          },
        },
        parentDirectory: null,
      },
    ],
    deleted: { $ne: true },
  };
}

/**
 * 사용자의 디렉토리 접근 권한 필터를 생성하는 헬퍼 함수
 * @param {string} userId - 사용자 ID
 * @param {string} parentId - 부모 디렉토리 ID (선택적)
 * @param {string} shareLinkHash - 공유 링크 해시 (선택적)
 * @returns {Object} MongoDB 필터 객체
 */
export function buildDirectoryAccessFilter(
  userId,
  parentId = null,
  shareLinkHash = null
) {
  const mongoose = require("mongoose");
  const ObjectId = mongoose.Types.ObjectId;

  const orConditions = [
    { owner: new ObjectId(userId) },
    {
      shared: {
        $elemMatch: {
          userId: new ObjectId(userId),
        },
      },
    },
  ];

  if (shareLinkHash) {
    orConditions.push({
      shareLinks: { $elemMatch: { hash: shareLinkHash } },
    });
  }

  return {
    $or: orConditions,
    parent: parentId ? new ObjectId(parentId) : null,
    deleted: { $ne: true },
  };
}

/**
 * 파일 populate 옵션 (일관성 있는 populate를 위한 재사용 가능한 설정)
 */
export const filePopulateOptions = [
  {
    path: "owner",
    select: "name email",
  },
  {
    path: "parentDirectory",
    select: "name owner",
    populate: {
      path: "owner",
      select: "name email",
    },
  },
  {
    path: "shared.userId",
    select: "name email",
  },
];

/**
 * 디렉토리 populate 옵션
 */
export const directoryPopulateOptions = [
  {
    path: "owner",
    select: "name email",
  },
  {
    path: "shared.userId",
    select: "name email",
  },
];

/**
 * 정렬 옵션을 생성하는 헬퍼 함수
 * @param {string} sortBy - 정렬 기준 필드
 * @param {string} sortOrder - 정렬 순서 (asc/desc)
 * @returns {Object} MongoDB 정렬 객체
 */
export function buildSortOptions(sortBy = "createdAt", sortOrder = "desc") {
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
  return sortOptions;
}

/**
 * 페이지네이션 계산 헬퍼
 * @param {number} page - 현재 페이지
 * @param {number} limit - 페이지당 항목 수
 * @returns {Object} skip과 limit 값
 */
export function buildPaginationOptions(page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return { skip, limit };
}
