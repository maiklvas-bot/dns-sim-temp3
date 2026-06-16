import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import AssessorPage from "./assessor";

export default function EvaluatorPage() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/staff/me"],
    queryFn: getQueryFn<any>({ on401: "returnNull" }),
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0d1117] text-white">Проверка доступа...</div>;
  }

  if (!data || (data.role !== "evaluator" && data.role !== "admin") || error) {
    navigate("/staff-login");
    return null;
  }

  return <AssessorPage staffRole={data.role} />;
}

