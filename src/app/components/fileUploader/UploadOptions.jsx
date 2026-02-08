"use client";

import React from "react";

export default function UploadOptions({
  enableE2EE,
  onE2EEToggle,
  showPasswordInput,
  encryptionPassword,
  onPasswordChange,
  isWebGLBuild,
  onWebGLToggle,
  uploading,
}) {
  return (
    <>
      {/* E2EE 옵션 */}
      <div className="border-t pt-4">
        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text">
              <span className="font-semibold">종단간 암호화 (E2EE)</span>
              <br />
              <span className="text-sm text-gray-500">
                파일이 디바이스에서 암호화되어 서버에 저장됩니다
              </span>
            </span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={enableE2EE}
              onChange={(e) => onE2EEToggle(e.target.checked)}
              disabled={uploading}
            />
          </label>
        </div>

        {showPasswordInput && (
          <div className="mt-3">
            <label className="label">
              <span className="label-text">암호화 키</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder="암호화에 사용할 비밀번호를 입력하세요"
              value={encryptionPassword}
              onChange={(e) => onPasswordChange(e.target.value)}
              disabled={uploading}
            />
            <label className="label">
              <span className="label-text-alt text-warning">
                ⚠️ 이 비밀번호를 잊으면 파일을 복구할 수 없습니다
              </span>
            </label>
          </div>
        )}
      </div>

      {/* WebGL 빌드 옵션 */}
      <div className="border-t pt-4">
        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text">
              <span className="font-semibold">Unity WebGL 빌드</span>
              <br />
              <span className="text-sm text-gray-500">
                이 파일이 Unity WebGL 빌드 압축 파일인 경우 체크하세요
              </span>
            </span>
            <input
              type="checkbox"
              className="toggle toggle-secondary"
              checked={isWebGLBuild}
              onChange={(e) => onWebGLToggle(e.target.checked)}
              disabled={uploading}
            />
          </label>
        </div>
      </div>
    </>
  );
}
