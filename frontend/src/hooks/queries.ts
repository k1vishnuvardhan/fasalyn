import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFarms, getPlots, getDashboard, uploadScan, getRisk, getTraps } from '../services/api';

export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn: getFarms,
  });
}

export function usePlots(farmId: string) {
  return useQuery({
    queryKey: ['plots', farmId],
    queryFn: () => getPlots(farmId),
    enabled: !!farmId,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });
}

export function useRiskAssessment(plotId: string) {
  return useQuery({
    queryKey: ['risk', plotId],
    queryFn: () => getRisk(plotId),
    enabled: !!plotId,
  });
}

export function useTraps(plotId: string) {
  return useQuery({
    queryKey: ['traps', plotId],
    queryFn: () => getTraps(plotId),
    enabled: !!plotId,
  });
}

export function useUploadScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
