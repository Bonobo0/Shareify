"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation, faCheckCircle, faXmarkCircle } from "@fortawesome/free-solid-svg-icons";
import { validatePasswordStrength } from "@/lib/crypto/encryption";

export default function UploadOptions({
  enableE2EE,
  onE2EEToggle,
  showPasswordInput,
  encryptionPassword,
  onPasswordChange,
  onPasswordValidation,
  isWebGLBuild,
  onWebGLToggle,
  uploading,
}) {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordValidation, setPasswordValidation] = useState({ isValid: true, errors: [] });
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  const handlePasswordChange = (value) => {
    onPasswordChange(value);
    setConfirmPassword("");
    setPasswordsMatch(true);
    
    if (value.length >= 1) {
      const validation = validatePasswordStrength(value);
      setPasswordValidation(validation);
      onPasswordValidation?.(validation.isValid);
    } else {
      setPasswordValidation({ isValid: true, errors: [] });
      onPasswordValidation?.(false);
    }
  };

  const handleConfirmPasswordChange = (value) => {
    setConfirmPassword(value);
    setPasswordsMatch(value === encryptionPassword);
  };

  const renderPasswordStrength = () => {
    if (!encryptionPassword) return null;

    const strength = passwordValidation.errors.length === 0 && encryptionPassword.length >= 12 ? "strong" :
                     passwordValidation.errors.length <= 1 ? "medium" : "weak";

    const strengthLabels = {
      strong: { text: "강함", color: "text-success", icon: faCheckCircle },
      medium: { text: "보통", color: "text-warning", icon: faTriangleExclamation },
      weak: { text: "약함", color: "text-error", icon: faXmarkCircle },
    };

    const label = strengthLabels[strength];

    return (
      <div className="flex items-center gap-1 mt-1 text-xs">
        <FontAwesomeIcon icon={label.icon} className={label.color} />
        <span className={label.color}>비밀번호 강도: {label.text}</span>
      </div>
    );
  };

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
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">
                <span className="label-text">암호화 키</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="암호화에 사용할 비밀번호를 입력하세요"
                value={encryptionPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                disabled={uploading}
                autoComplete="new-password"
                minLength={12}
              />
              {renderPasswordStrength()}
            </div>

            <div>
              <label className="label">
                <span className="label-text">암호화 키 확인</span>
              </label>
              <input
                type="password"
                className={`input input-bordered w-full ${!passwordsMatch && confirmPassword ? "input-error" : ""}`}
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                disabled={uploading}
                autoComplete="new-password"
              />
              {!passwordsMatch && confirmPassword && (
                <div className="label">
                  <span className="label-text-alt text-error">
                    비밀번호가 일치하지 않습니다
                  </span>
                </div>
              )}
            </div>

            {/* 비밀번호 요구사항 표시 */}
            <div className="text-xs text-gray-500 space-y-1">
              <div className="font-semibold">비밀번호 요구사항:</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li className={encryptionPassword.length >= 12 ? "text-success" : ""}>
                  최소 12자 이상
                </li>
                <li className={/[A-Z]/.test(encryptionPassword) && /[a-z]/.test(encryptionPassword) || /[0-9]/.test(encryptionPassword) || /[!@#$%^&*(),.?":{}|<>]/.test(encryptionPassword) ? "text-success" : ""}>
                  2종 이상의 문자 조합 (대소문자/숫자/특수문자)
                </li>
              </ul>
            </div>

            <label className="label">
              <span className="label-text-alt text-warning">
                <FontAwesomeIcon icon={faTriangleExclamation} /> 이 비밀번호를 잊으면 파일을 복구할 수 없습니다
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