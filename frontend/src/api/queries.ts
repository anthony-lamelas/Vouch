import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  MeOut,
  CandidatePage,
  ContactDetail,
  CreateRequestIn,
  FilterOptions,
  RequestDetail,
  RequestPage,
  RoleDetail,
  RoleSummary,
  Stats,
  Status,
  TransitionIn,
} from './types';
import type { CandidateFilters } from '../lib/candidateFilters';

export const keys = {
  roles: ['roles'] as const,
  role: (id: string) => ['roles', id] as const,
  candidates: (roleId: string, filters: CandidateFilters) =>
    ['roles', roleId, 'candidates', filters] as const,
  contact: (id: string) => ['contacts', id] as const,
  filters: ['filters'] as const,
  stats: ['stats'] as const,
  requests: (params: RequestListParams) => ['requests', params] as const,
  request: (id: string) => ['requests', id] as const,
};

export function useMe() {
  return useQuery({
    queryKey: ['me'] as const,
    queryFn: () => api.get<MeOut>('/me'),
    staleTime: 300_000,
  });
}

export function useRoles() {
  return useQuery({ queryKey: keys.roles, queryFn: () => api.get<RoleSummary[]>('/roles') });
}

export function useRole(id: string) {
  return useQuery({ queryKey: keys.role(id), queryFn: () => api.get<RoleDetail>(`/roles/${id}`) });
}

export function useCandidates(roleId: string, filters: CandidateFilters) {
  return useQuery({
    queryKey: keys.candidates(roleId, filters),
    queryFn: ({ signal }) =>
      api.get<CandidatePage>(
        `/roles/${roleId}/candidates`,
        {
          companies: filters.companies,
          schools: filters.schools,
          skills: filters.skills,
          company_tier: filters.companyTier,
          q: filters.q,
          min_score: filters.minScore,
          limit: filters.limit,
          offset: filters.offset,
        },
        signal,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useContact(id: string | null) {
  return useQuery({
    queryKey: keys.contact(id ?? ''),
    queryFn: () => api.get<ContactDetail>(`/contacts/${id ?? ''}`),
    enabled: Boolean(id),
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: keys.filters,
    queryFn: () => api.get<FilterOptions>('/filters'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => api.get<Stats>('/stats') });
}

export interface RequestListParams {
  status?: Status[];
  role_id?: string;
  active_only?: boolean;
  mine?: boolean;
}

export function useRequests(params: RequestListParams) {
  return useQuery({
    queryKey: keys.requests(params),
    queryFn: () =>
      api.get<RequestPage>('/requests', {
        status: params.status,
        role_id: params.role_id,
        active_only: params.active_only,
        mine: params.mine,
        limit: 200,
      }),
    placeholderData: (prev) => prev,
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: keys.request(id),
    queryFn: () => api.get<RequestDetail>(`/requests/${id}`),
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRequestIn) => api.post<RequestDetail>('/requests', body),
    onSuccess: async (data) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['roles'] }),
        qc.invalidateQueries({ queryKey: keys.contact(data.contact.id) }),
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: keys.stats }),
      ]);
    },
  });
}

export function useTransitionRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransitionIn) => api.post<RequestDetail>(`/requests/${id}/transition`, body),
    onSuccess: async (data) => {
      qc.setQueryData(keys.request(id), data);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['roles'] }),
        qc.invalidateQueries({ queryKey: keys.contact(data.contact.id) }),
        qc.invalidateQueries({ queryKey: keys.stats }),
      ]);
    },
  });
}
