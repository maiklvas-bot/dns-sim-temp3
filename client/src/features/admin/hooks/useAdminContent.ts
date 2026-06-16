import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";

interface UseAdminContentOptions {
  resultStatusFilter: string;
  resultParticipantFilter: string;
  selectedResultId: number | null;
  comparisonSelection: number[];
  comparisonEnabled: boolean;
}

export function useAdminContent({
  resultStatusFilter,
  resultParticipantFilter,
  selectedResultId,
  comparisonSelection,
  comparisonEnabled,
}: UseAdminContentOptions) {
  const queryClient = useQueryClient();
  const staffQuery = useQuery({
    queryKey: ["/api/staff/me"],
    queryFn: getQueryFn<any>({ on401: "returnNull" }),
  });
  const contentQuery = useQuery({
    queryKey: ["/api/staff/content"],
    queryFn: getQueryFn<any>({ on401: "throw" }),
    enabled: !!staffQuery.data,
  });
  const resultsQuery = useQuery({
    queryKey: ["/api/staff/results", resultStatusFilter, resultParticipantFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resultStatusFilter) params.set("status", resultStatusFilter);
      if (resultParticipantFilter) params.set("participantName", resultParticipantFilter);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await apiRequest("GET", `/api/staff/results${suffix}`);
      return response.json();
    },
    enabled: !!staffQuery.data,
  });
  const resultDetailQuery = useQuery({
    queryKey: ["/api/staff/results/detail", selectedResultId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/staff/results/${selectedResultId}`);
      return response.json();
    },
    enabled: !!staffQuery.data && selectedResultId != null,
  });
  const comparisonDetailQueries = useQueries({
    queries: comparisonSelection.map((id) => ({
      queryKey: ["/api/staff/results/detail", id],
      queryFn: async () => {
        const response = await apiRequest("GET", `/api/staff/results/${id}`);
        return response.json();
      },
      enabled: !!staffQuery.data && comparisonEnabled,
    })),
  });

  const invalidateRuntimeContent = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/staff/content"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/simulation-content"] });
  };

  return {
    queryClient,
    staffQuery,
    contentQuery,
    resultsQuery,
    resultDetailQuery,
    comparisonDetailQueries,
    invalidateRuntimeContent,
  };
}
