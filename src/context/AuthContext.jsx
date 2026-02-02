"use client";

import { createContext, useState, useEffect, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 사용자 정보 로드
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const session = await authClient.getSession();

        if (session?.data?.user) {
          setUser({
            id: session.data.user.id,
            email: session.data.user.email,
            name: session.data.user.name,
            isVerified: session.data.user.emailVerified,
            twoFactorEnabled: session.data.user.twoFactorEnabled,
            role: session.data.user.role || "user",
            storageLimit: session.data.user.storageLimit,
            storageUsed: session.data.user.storageUsed,
            profileImage: session.data.user.profileImage,
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("사용자 정보 로드 오류:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // 로그인 함수 (이메일/비밀번호)
  const login = async (...args) => {
    try {
      let email, password, twoFactorCode, isBackupCode;

      if (args.length === 1 && args[0] instanceof FormData) {
        // FormData가 직접 전달된 경우 (2FA 포함)
        const formData = args[0];
        email = formData.get("email");
        password = formData.get("password");
        twoFactorCode = formData.get("twoFactorCode");
        isBackupCode = formData.get("isBackupCode") === "true";
      } else if (args.length >= 2) {
        // email, password 형태로 전달된 경우
        [email, password] = args;
      } else {
        throw new Error("올바르지 않은 로그인 파라미터입니다.");
      }

      // 2FA 코드가 있는 경우
      if (twoFactorCode) {
        const result = await authClient.twoFactor.verifyTotp({
          code: twoFactorCode,
        });

        if (result.error) {
          return {
            success: false,
            error: result.error.message || "잘못된 인증 코드입니다.",
            requiresTwoFactor: true,
          };
        }

        // 세션 새로고침
        const session = await authClient.getSession();
        if (session?.data?.user) {
          setUser({
            id: session.data.user.id,
            email: session.data.user.email,
            name: session.data.user.name,
            isVerified: session.data.user.emailVerified,
            twoFactorEnabled: session.data.user.twoFactorEnabled,
            role: session.data.user.role || "user",
          });
        }
        return { success: true };
      }

      // 일반 로그인
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        // 2FA 필요 여부 확인
        if (result.error.message?.includes("two-factor") || result.error.code === "TWO_FACTOR_REQUIRED") {
          return {
            success: false,
            error: "2단계 인증 코드가 필요합니다.",
            requiresTwoFactor: true,
          };
        }
        return {
          success: false,
          error: result.error.message || "로그인에 실패했습니다.",
        };
      }

      // 로그인 성공 시 사용자 정보 업데이트
      if (result.data?.user) {
        setUser({
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.name,
          isVerified: result.data.user.emailVerified,
          twoFactorEnabled: result.data.user.twoFactorEnabled,
          role: result.data.user.role || "user",
        });
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // Keycloak 소셜 로그인 함수 (genericOAuth 사용)
  const loginWithKeycloak = async () => {
    try {
      const result = await authClient.signIn.oauth2({
        providerId: "keycloak",
        callbackURL: "/dashboard",
      });

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // 회원가입 함수
  const signup = async (email, password, name) => {
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: name || email.split("@")[0],
      });

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      if (result.data?.user) {
        setUser({
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.name,
          isVerified: result.data.user.emailVerified,
          twoFactorEnabled: false,
          role: "user",
        });
        return {
          success: true,
          message: "회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해주세요.",
          emailSent: true,
        };
      }

      return { success: false, error: "회원가입에 실패했습니다." };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // 사용자 정보 새로고침 함수
  const refreshUser = async () => {
    try {
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setUser({
          id: session.data.user.id,
          email: session.data.user.email,
          name: session.data.user.name,
          isVerified: session.data.user.emailVerified,
          twoFactorEnabled: session.data.user.twoFactorEnabled,
          role: session.data.user.role || "user",
        });
        return { success: true };
      } else {
        setUser(null);
        return { success: false };
      }
    } catch (error) {
      console.error("사용자 정보 새로고침 오류:", error);
      setUser(null);
      return { success: false, error: error.message };
    }
  };

  // 로그아웃 함수
  const logout = async () => {
    try {
      await authClient.signOut();
      setUser(null);
      router.push("/");
      return { success: true };
    } catch (error) {
      console.error("로그아웃 오류:", error);
      setUser(null);
      router.push("/");
      return { success: true };
    }
  };

  // Context value를 메모이제이션하여 불필요한 re-render 방지
  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      loginWithKeycloak,
      signup,
      logout,
      refreshUser,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
