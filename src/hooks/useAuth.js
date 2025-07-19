import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 현재 로그인된 사용자 정보 가져오기
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/user", {
          credentials: "include", // 쿠키 포함
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
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

  // 로그인 함수
  const login = async (email, password) => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 쿠키 포함
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "로그인에 실패했습니다.");
      }

      // 사용자 정보 다시 로드
      const userRes = await fetch("/api/user", {
        credentials: "include", // 쿠키 포함
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // 로그아웃 함수
  const logout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include", // 쿠키 포함
      });
      setUser(null);
      router.push("/user/signin");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
