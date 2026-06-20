"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faCheckCircle,
  faXmarkCircle,
} from "@fortawesome/free-solid-svg-icons";
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
  const [passwordValidation, setPasswordValidation] = useState({
    isValid: true,
    errors: [],
  });
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

    const strength =
      passwordValidation.errors.length === 0 && encryptionPassword.length >= 12
        ? "strong"
        : passwordValidation.errors.length <= 1
          ? "medium"
          : "weak";

    const strengthLabels = {
      strong: {
        text: "강함",
        color: "text-success",
        icon: faCheckCircle,
      },
      medium: {
        text: "보통",
        color: "text-warning",
        icon: faTriangleExclamation,
      },
      weak: { text: "약함", color: "text-error", icon: faXmarkCircle },
    };

    const label = strengthLabels[strength];

    return (
      <div className="mt-1 flex items-center gap-1 text-xs">
        <FontAwesomeIcon icon={label.icon} className={label.color} />
        <span className={label.color}>비밀번호 강도: {label.text}</span>
      </div>
    );
  };

  return (
    <>
      {/* E2EE option */}
      <div className="divider-subtle pt-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-primary mt-0.5"
            checked={enableE2EE}
            onChange={(e) => onE2EEToggle(e.target.checked)}
            disabled={uploading}
          />
          <div>
            <span className="text-sm font-medium">종단간 암호화 (E2EE)</span>
            <p className="text-xs text-base-content/40">
              파일이 디바이스에서 암호화되어 서버에 저장됩니다
            </p>
          </div>
        </label>

        {showPasswordInput && (
          <div className="mt-4 space-y-3 rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-base-content/60">
                암호화 키
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="암호화에 사용할 비밀번호"
                value={encryptionPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                disabled={uploading}
                autoComplete="new-password"
                minLength={12}
              />
              {renderPasswordStrength()}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-base-content/60">
                암호화 키 확인
              </label>
              <input
                type="password"
                className={`input-field ${
                  !passwordsMatch && confirmPassword
                    ? "border-error focus:border-error focus:ring-error/20"
                    : ""
                }`}
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                disabled={uploading}
                autoComplete="new-password"
              />
              {!passwordsMatch && confirmPassword && (
                <p className="mt-1 text-xs text-error">
                  비밀번호가 일치하지 않습니다
                </p>
              )}
            </div>

            <div className="text-xs text-base-content/40">
              <p className="mb-1 font-medium text-base-content/50">
                비밀번호 요구사항:
              </p>
              <ul className="space-y-0.5 pl-3">
                <li
                  className={
                    encryptionPassword.length >= 12 ? "text-success" : ""
                  }
                >
                  최소 12자 이상
                </li>
                <li
                  className={
                    /[A-Z]/.test(encryptionPassword) &&
                    /[a-z]/.test(encryptionPassword)
                      ? "text-success"
                      : ""
                  }
                >
                  대소문자 조합
                </li>
              </ul>
            </div>

            <p className="flex items-center gap-1 text-xs text-warning">
              <FontAwesomeIcon icon={faTriangleExclamation} />
              이 비밀번호를 잊으면 파일을 복구할 수 없습니다
            </p>
          </div>
        )}
      </div>

      {/* WebGL option */}
      <div className="divider-subtle pt-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-secondary mt-0.5"
            checked={isWebGLBuild}
            onChange={(e) => onWebGLToggle(e.target.checked)}
            disabled={uploading}
          />
          <div>
            <span className="text-sm font-medium">Unity WebGL 빌드</span>
            <p className="text-xs text-base-content/40">
              이 파일이 Unity WebGL 빌드 압축 파일인 경우 체크하세요
            </p>
          </div>
        </label>
      </div>
    </>
  );
}
