import { api } from './client'

export interface TenantSummary {
  id: string
  name: string
  code: string
  status: 'active' | 'disabled'
  isDefault: boolean
  createdAt: string
  updatedAt: string
  _count: { users: number; channels: number; opportunities: number }
  primaryAdmin: { id: string; name: string; email: string; disabled: boolean } | null
}
export interface CreateTenantInput {
  name: string
  code: string
  adminName: string
  adminEmail: string
  adminPassword: string
}

export const tenantApi = {
  list: () => api.get<TenantSummary[]>('/tenants'),
  create: (input: CreateTenantInput) => api.post<TenantSummary>('/tenants', input),
  update: (id: string, input: Partial<Pick<TenantSummary, 'name' | 'code' | 'status'>>) => api.patch<TenantSummary>(`/tenants/${id}`, input),
}
