/**
 * 비밀번호 유효성 검사
 * - 최소 8자 이상
 * - 대문자, 소문자, 숫자, 특수문자 각각 1개 이상 포함
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: "비밀번호는 최소 8자 이상이어야 합니다." };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "비밀번호에 대문자를 1개 이상 포함해야 합니다.",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "비밀번호에 소문자를 1개 이상 포함해야 합니다.",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "비밀번호에 숫자를 1개 이상 포함해야 합니다.",
    };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return {
      valid: false,
      error: "비밀번호에 특수문자를 1개 이상 포함해야 합니다.",
    };
  }
  return { valid: true };
}

/**
 * 이메일 유효성 검사
 * @param {string} email
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEmail(email) {
  if (!email) {
    return { valid: false, error: "이메일을 입력해주세요." };
  }
  // RFC 5322 간소화 정규식
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "유효한 이메일 주소를 입력해주세요." };
  }
  return { valid: true };
}
