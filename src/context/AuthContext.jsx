"use client";

import { createContext, useState, useEffect, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, signOut, verifyAuth } from "@/actions/auth";
import { getUserInfo } from "@/actions/user";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 사용자 정보 로드
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const result = await verifyAuth();

        if (result.authenticated) {
          setUser(result.user);
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

  // 로그인 함수 (2FA 지원)
  const login = async (...args) => {
    try {
      let formData;

      if (args.length === 1 && args[0] instanceof FormData) {
        // FormData가 직접 전달된 경우 (2FA 포함)
        formData = args[0];
      } else if (args.length >= 2) {
        // email, password 형태로 전달된 경우
        const [email, password] = args;
        formData = new FormData();
        formData.append("email", email);
        formData.append("password", password);
      } else {
        throw new Error("올바르지 않은 로그인 파라미터입니다.");
      }

      const result = await signIn(formData);

      if (result.error) {
        return {
          success: false,
          error: result.error,
          requiresTwoFactor: result.requiresTwoFactor,
        };
      }

      if (result.success) {
        // 로그인 성공 시 사용자 정보 즉시 새로고침
        const authResult = await verifyAuth();
        if (authResult.authenticated) {
          setUser(authResult.user);
        } else {
          setUser(result.user);
        }
        return { success: true };
      }

      return { success: false, error: "로그인에 실패했습니다." };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // 회원가입 함수
  const signup = async (email, password, name) => {
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      if (name) formData.append("name", name);

      const result = await signUp(formData);

      if (result.error) {
        return { success: false, error: result.error };
      }

      if (result.success) {
        // 회원가입 성공 시 사용자 상태 즉시 업데이트
        setUser(result.user);
        return {
          success: true,
          message: result.message,
          emailSent: result.emailSent,
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
      const result = await verifyAuth();
      if (result.authenticated) {
        setUser(result.user);
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
      await signOut();
      setUser(null);
      router.push("/"); // 클라이언트 사이드에서 리다이렉션
      return { success: true };
    } catch (error) {
      console.error("로그아웃 오류:", error);
      // redirect 오류는 무시하고 상태만 업데이트
      if (error.message && error.message.includes("NEXT_REDIRECT")) {
        setUser(null);
        router.push("/");
        return { success: true };
      }
      return { success: false, error: error.message };
    }
  };

  // Context value를 메모이제이션하여 불필요한 re-render 방지
  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
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
