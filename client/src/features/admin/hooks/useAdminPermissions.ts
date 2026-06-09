import { useEffect } from "react";
import { useLocation } from "wouter";

export function useAdminPermissions(staff: { role?: string } | null | undefined, isLoading: boolean) {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && (!staff || staff.role !== "admin")) {
      navigate("/staff-login");
    }
  }, [staff, isLoading, navigate]);

  return {
    isAdmin: staff?.role === "admin",
  };
}
