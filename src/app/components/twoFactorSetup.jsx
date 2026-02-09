"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { setup2FA, enable2FA, disable2FA } from "@/actions/verification";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";

export default function TwoFactorSetup() {
  const { user } = useAuth();
  const [step, setStep] = useState("initial"); // initial, setup, verify
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  const startSetup = async () => {
    if (!user?.isVerified) {
      setError("2단계 인증을 설정하려면 먼저 이메일 인증을 완료해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await setup2FA();
      if (result.success) {
        setQrCode(result.qrCode);
        setSecret(result.secret);
        setStep("setup");
        setSuccess("");
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError("2FA 설정 초기화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("6자리 인증 코드를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await enable2FA({
        token: verificationCode,
        secret: secret,
      });

      if (result.success) {
        setBackupCodes(result.backupCodes);
        setShowBackupCodes(true);
        setStep("verify");
        setSuccess(result.message);
        setVerificationCode("");
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError("2FA 활성화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await disable2FA({ password: disablePassword });
      if (result.success) {
        setSuccess(result.message);
        setStep("initial");
        setDisablePassword("");
        // 페이지 새로고침을 통해 사용자 정보 업데이트
        window.location.reload();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError("2FA 비활성화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join("\n");
    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shareify-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setSuccess("백업 코드가 클립보드에 복사되었습니다.");
  };

  return (
    <div className="card bg-base-200 p-6 mt-6">
      <h2 className="text-xl font-bold mb-4">2단계 인증 설정</h2>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success mb-4">
          <span>{success}</span>
        </div>
      )}

      {!user?.isVerified && (
        <div className="alert alert-warning mb-4">
          <span>2단계 인증을 사용하려면 먼저 이메일 인증을 완료해주세요.</span>
        </div>
      )}

      {/* 초기 상태 - 2FA 비활성화 */}
      {step === "initial" && !user?.twoFactorEnabled && (
        <div className="space-y-4">
          <p className="text-gray-600">
            2단계 인증을 활성화하여 계정 보안을 강화하세요. Google
            Authenticator, Authy 등의 인증 앱이 필요합니다.
          </p>
          <button
            className={`btn btn-primary ${loading ? "loading" : ""}`}
            onClick={startSetup}
            disabled={loading || !user?.isVerified}
          >
            {loading ? "설정 중..." : "2단계 인증 설정하기"}
          </button>
        </div>
      )}

      {/* QR 코드 스캔 단계 */}
      {step === "setup" && (
        <div className="space-y-4">
          <p className="text-gray-600">
            1. 인증 앱(Google Authenticator, Authy 등)에서 아래 QR 코드를
            스캔하세요.
          </p>

          {qrCode && (
            <div className="flex justify-center">
              <img src={qrCode} alt="QR Code" className="border rounded" />
            </div>
          )}

          <p className="text-gray-600">
            2. 인증 앱에서 생성된 6자리 코드를 입력하세요.
          </p>

          <input
            type="text"
            placeholder="6자리 인증 코드"
            className="input input-bordered w-full"
            value={verificationCode}
            onChange={(e) =>
              setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            maxLength={6}
          />

          <div className="flex gap-2">
            <button
              className={`btn btn-primary ${loading ? "loading" : ""}`}
              onClick={verifyAndEnable}
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? "확인 중..." : "인증하고 활성화"}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                setStep("initial");
                setError("");
                setVerificationCode("");
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 백업 코드 표시 */}
      {showBackupCodes && backupCodes.length > 0 && (
        <div className="space-y-4">
          <div className="alert alert-warning">
            <div>
              <strong>중요: 백업 코드를 안전한 곳에 보관하세요!</strong>
              <br />
              인증 앱에 접근할 수 없을 때 이 코드들로 로그인할 수 있습니다.
            </div>
          </div>

          <div className="bg-base-300 p-4 rounded font-mono text-sm">
            {backupCodes.map((code, index) => (
              <div key={index}>{code}</div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-secondary btn-sm"
              onClick={downloadBackupCodes}
            >
              다운로드
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={copyBackupCodes}
            >
              복사
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowBackupCodes(false);
                window.location.reload(); // 사용자 정보 새로고침
              }}
            >
              완료
            </button>
          </div>
        </div>
      )}

      {/* 2FA 활성화 상태 */}
      {user?.twoFactorEnabled && step === "initial" && (
        <div className="space-y-4">
          <div className="alert alert-success">
            <span><FontAwesomeIcon icon={faCircleCheck} /> 2단계 인증이 활성화되어 있습니다.</span>
          </div>

          <p className="text-gray-600">
            2단계 인증을 비활성화하려면 비밀번호를 입력하세요.
          </p>

          <input
            type="password"
            placeholder="현재 비밀번호"
            className="input input-bordered w-full"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
          />

          <button
            className={`btn btn-error ${loading ? "loading" : ""}`}
            onClick={handleDisable2FA}
            disabled={loading || !disablePassword}
          >
            {loading ? "비활성화 중..." : "2단계 인증 비활성화"}
          </button>
        </div>
      )}
    </div>
  );
}
