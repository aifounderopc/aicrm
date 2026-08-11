import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppState, Opportunity, OperationLog, Notification,
  ChannelPartner, RenewalRequest, ProgressReport, OpportunityStage
} from '../types'
import { seedData } from './seed'
import { generateId, formatDate, addDays, editDistance, validatePassword, roleName } from '../utils'
import type { User } from '../types'
import { authApi, opportunityApi, userApi, channelApi, notificationApi, logApi, ApiError } from '../api'

// API 模式开关：VITE_USE_API=true 时走真实后端，否则用本地 localStorage（演示模式）
const USE_API = import.meta.env.VITE_USE_API === 'true'

// ── API 写穿透辅助 ──
// 先做本地乐观更新（保持原有 UX），再异步调后端并刷新对应集合（最终一致）
async function refetchOpps() {
  try { const p = await opportunityApi.list({ pageSize: 100 }); useStore.setState({ opportunities: p.items as Opportunity[] }) } catch { /* 忽略 */ }
}
async function refetchUsers() {
  try { const u = await userApi.list(); useStore.setState({ users: u as unknown as User[] }) } catch { /* 忽略 */ }
}
async function refetchChannels() {
  try { const c = await channelApi.list(); useStore.setState({ channels: c as unknown as ChannelPartner[] }) } catch { /* 忽略 */ }
}
async function refetchNotifs() {
  try { const n = await notificationApi.list(); useStore.setState({ notifications: n as Notification[] }) } catch { /* 忽略 */ }
}
// 在 API 模式下执行后端写操作并刷新；失败时回滚刷新保证一致
function writeThrough(call: Promise<unknown>, refetch: () => Promise<void>) {
  if (!USE_API) return
  call.then(() => refetch()).catch(() => refetch())
}

interface Store extends AppState {
  // auth
  authUserId: string | null   // 真实登录的账号；null = 未登录
  bootstrapped: boolean        // 是否已从后端拉取过数据
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void | Promise<void>
  switchUser: (userId: string) => Promise<{ success: boolean; error?: string }>
  bootstrap: () => Promise<void>   // 登录后/启动时从后端加载数据

  // opportunities
  addOpportunity: (opp: Omit<Opportunity, 'id' | 'reportedAt' | 'updatedAt' | 'releaseAt' | 'progressReports' | 'renewalRequests' | 'isFrozen' | 'lockedPermanently'>) => { success: boolean; collision?: Opportunity; similar?: Opportunity[] }
  updateStage: (id: string, stage: OpportunityStage, signingInfo?: { contractNo: string; signedDate: string; signedAmount: number; contractFileUrl?: string }) => Promise<void>
  releaseOpportunity: (id: string, reason: string) => void
  deleteOpportunity: (id: string) => void
  freezeOpportunity: (id: string, reason: string) => void
  approveEvidence: (id: string) => void
  rejectEvidence: (id: string, reason: string) => void

  // renewal
  requestRenewal: (opportunityId: string) => void
  approveRenewal: (requestId: string, opportunityId: string) => void
  rejectRenewal: (requestId: string, opportunityId: string, reason: string) => void

  // progress reports
  addProgressReport: (report: Omit<ProgressReport, 'id' | 'createdAt'>) => void

  // notifications
  markNotificationRead: (id: string) => void
  addNotification: (n: Omit<Notification, 'id' | 'createdAt'>) => void

  // channels
  addChannel: (c: Omit<ChannelPartner, 'id' | 'createdAt'>, account?: { name: string; email: string; password: string }, jdAccount?: { name: string; email: string; password: string }) => void
  updateChannel: (channelId: string, updates: Partial<Pick<ChannelPartner, 'name' | 'fullName' | 'contactName' | 'phone' | 'jdManagerName'>>) => { success: boolean; error?: string }
  toggleChannel: (id: string) => void
  createChannelAccount: (channelId: string, account: { name: string; email: string; password: string }) => { success: boolean; error?: string }
  updateChannelAccount: (userId: string, updates: { name?: string; email?: string; password?: string }) => { success: boolean; error?: string }
  toggleUserDisabled: (userId: string) => void
  createUser: (info: { name: string; email: string; password: string; role: 'sales' | 'admin' | 'channel_admin' | 'sales_admin'; group?: string }) => { success: boolean; error?: string }
  updateUser: (userId: string, updates: { name?: string; email?: string; password?: string; group?: string }) => { success: boolean; error?: string }
  deleteUser: (userId: string) => void
  deleteChannel: (channelId: string) => void

  // collision detection
  detectCollision: (name: string, industry: string, companyName?: string) => { collision?: Opportunity; similar: Opportunity[]; crossIndustry: Opportunity[] }

  // logs
  addLog: (log: Omit<OperationLog, 'id' | 'createdAt'>) => void

  // auto-release
  processAutoReleases: () => void
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...seedData,
      authUserId: null,
      bootstrapped: false,

      login: async (email, password) => {
        if (USE_API) {
          try {
            const { user, authUser } = await authApi.login(email, password)
            set({ currentUser: user as User, authUserId: authUser.id })
            await get().bootstrap()
            return { success: true }
          } catch (e) {
            return { success: false, error: e instanceof ApiError ? e.message : '登录失败' }
          }
        }
        // 本地演示模式
        const e = email.trim().toLowerCase()
        const user = get().users.find(u => u.email.toLowerCase() === e)
        if (!user) return { success: false, error: '账号不存在，请检查邮箱' }
        if (user.disabled) return { success: false, error: '该账号已被停用，请联系管理员' }
        if ((user.password ?? '') !== password) return { success: false, error: '密码错误，请重试' }
        set({ authUserId: user.id, currentUser: user })
        return { success: true }
      },

      logout: async () => {
        if (USE_API) { try { await authApi.logout() } catch { /* 忽略 */ } }
        set({ authUserId: null, bootstrapped: false })
      },

      switchUser: async (userId) => {
        if (USE_API) {
          try {
            const authId = get().authUserId
            if (userId === authId) await authApi.stopImpersonate()
            else await authApi.impersonate(userId)
            const { user, authUser } = await authApi.me()
            set({ currentUser: user as User, authUserId: authUser.id })
            await get().bootstrap()
            return { success: true }
          } catch (e) {
            return { success: false, error: e instanceof ApiError ? e.message : '切换失败' }
          }
        }
        // 本地演示模式
        const authId = get().authUserId
        const authUser = get().users.find(u => u.id === authId)
        const target = get().users.find(u => u.id === userId)
        if (!authUser || !target) return { success: false, error: '账号不存在' }
        if (target.id === authUser.id) { set({ currentUser: target }); return { success: true } }
        const allowed =
          authUser.role === 'admin' ||
          (authUser.role === 'channel_admin' && target.role === 'channel') ||
          (authUser.role === 'sales_admin' && target.role === 'sales')
        if (!allowed) return { success: false, error: '无权代理访问该账号' }
        set({ currentUser: target })
        return { success: true }
      },

      // 从后端加载当前用户可见的数据到本地缓存（仅 API 模式）
      bootstrap: async () => {
        if (!USE_API) { set({ bootstrapped: true }); return }
        try {
          const me = await authApi.me().catch(() => null)
          if (!me) { set({ authUserId: null, bootstrapped: true }); return }
          set({ currentUser: me.user as User, authUserId: me.authUser.id })

          const isAdmin = ['admin', 'channel_admin', 'sales_admin'].includes(me.authUser.role)
          const [oppPage, notifs, users, channels, logs] = await Promise.all([
            opportunityApi.list({ pageSize: 100 }).catch(() => ({ items: [] as Opportunity[] })),
            notificationApi.list().catch(() => [] as Notification[]),
            isAdmin ? userApi.list().catch(() => []) : Promise.resolve([]),
            (me.authUser.role === 'admin' || me.authUser.role === 'channel_admin')
              ? channelApi.list().catch(() => []) : Promise.resolve([]),
            isAdmin ? logApi.list({ pageSize: 100 }).catch(() => ({ items: [] as OperationLog[] })) : Promise.resolve({ items: [] as OperationLog[] }),
          ])
          set({
            opportunities: oppPage.items as Opportunity[],
            notifications: notifs as Notification[],
            users: users as unknown as User[],
            channels: channels as unknown as ChannelPartner[],
            logs: logs.items as OperationLog[],
            bootstrapped: true,
          })
        } catch {
          set({ bootstrapped: true })
        }
      },

      detectCollision: (name, industry, companyName) => {
        const active = get().opportunities.filter(o => !['released', 'closed'].includes(o.stage))

        const SUFFIXES = ['有限公司', '股份有限公司', '集团有限公司', '科技有限公司', '技术有限公司', '集团', '科技', '技术', '电子', '信息', '网络', '控股', '企业', '公司']
        const CITIES = ['北京', '上海', '深圳', '广州', '杭州', '成都', '南京', '武汉', '西安', '重庆', '天津', '苏州', '宁波', '青岛', '厦门', '长沙', '郑州', '合肥', '济南', '福州']

        const stripSuffix = (s: string) => {
          for (const sfx of SUFFIXES) {
            if (s.endsWith(sfx) && s.length > sfx.length) return s.slice(0, s.length - sfx.length)
          }
          return s
        }

        // Strip leading city prefix, then strip suffix → pure brand core
        const normalize = (s: string) => {
          let r = stripSuffix(s)
          for (const city of CITIES) {
            if (r.startsWith(city) && r.length > city.length) { r = r.slice(city.length); break }
          }
          return r
        }

        const prefixMatch = (a: string, b: string) => {
          const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
          return shorter.length >= 2 && longer.startsWith(shorter)
        }

        const coreMatch = (a: string, b: string) => {
          const ca = stripSuffix(a), cb = stripSuffix(b)
          if (ca === cb || prefixMatch(ca, cb)) return true
          // Also compare after stripping city prefixes (e.g. "深圳华为技术" vs "华为技术有限公司")
          const na = normalize(a), nb = normalize(b)
          return na === nb || prefixMatch(na, nb)
        }

        const strictMatch = (a: string, b: string) => {
          if (a === b) return true
          if (coreMatch(a, b)) return true
          if (prefixMatch(a, b)) return true
          const dist = editDistance(a, b)
          const maxLen = Math.max(a.length, b.length)
          const threshold = maxLen <= 4 ? 1 : Math.floor(maxLen * 0.15)
          return dist <= threshold
        }

        const looseMatch = (a: string, b: string) => {
          if (strictMatch(a, b)) return true
          const dist = editDistance(a, b)
          const maxLen = Math.max(a.length, b.length)
          return dist <= Math.floor(maxLen * 0.25)
        }

        const subsidiaryConflict = (o: Opportunity) => {
          if (companyName && o.companyName) return strictMatch(companyName, o.companyName)
          return true
        }

        const collision = active.find(o =>
          strictMatch(o.customerName, name) && o.industry === industry && subsidiaryConflict(o)
        )
        const similar = collision ? [] : active.filter(o =>
          looseMatch(o.customerName, name) && o.industry === industry && subsidiaryConflict(o)
        )
        // Cross-industry: same customer name locked in a different industry (漏洞1)
        const crossIndustry = (collision || similar.length > 0) ? [] : active.filter(o =>
          strictMatch(o.customerName, name) && o.industry !== industry && subsidiaryConflict(o)
        )
        return { collision, similar, crossIndustry }
      },

      addOpportunity: (opp) => {
        const { collision, similar } = get().detectCollision(opp.customerName, opp.industry as string, opp.companyName)
        if (collision) return { success: false, collision }
        const now = new Date().toISOString()
        const newOpp: Opportunity = {
          ...opp,
          id: generateId(),
          reportedAt: now,
          updatedAt: now,
          releaseAt: addDays(now, 30),
          progressReports: [],
          renewalRequests: [],
          isFrozen: false,
          lockedPermanently: false,
        }
        set(s => ({ opportunities: [...s.opportunities, newOpp] }))
        get().addNotification({
          userId: opp.salesOwnerId,
          title: '商机报备成功',
          body: `客户「${opp.customerName}」已成功报备，锁定期至 ${formatDate(newOpp.releaseAt)}`,
          type: 'success',
          read: false,
          opportunityId: newOpp.id,
        })
        get().addLog({
          opportunityId: newOpp.id,
          operatorId: opp.salesOwnerId,
          operatorName: opp.salesOwnerName,
          action: '新建商机',
          detail: `报备客户：${opp.customerName}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(opportunityApi.create({
          customerName: opp.customerName,
          companyName: opp.companyName,
          industry: opp.industry,
          productInterests: opp.productInterests,
          source: opp.source,
          channelId: opp.channelId,
          channelName: opp.channelName,
          channelManagerName: opp.channelManagerName,
          amountRange: opp.amountRange,
          firstContactDate: opp.firstContactDate,
          requirementDescription: opp.requirementDescription,
          contact: {
            level: opp.contact.level,
            department: opp.contact.department,
            contactTypes: opp.contact.contactTypes,
            name: opp.contact.encryptedName ?? '',
            contactValue: opp.contact.encryptedContact,
          },
          isSubsidiary: opp.isSubsidiary,
          parentCompanyName: opp.parentCompanyName,
          evidenceFiles: opp.evidenceFiles,
          // 后端会按服务端身份覆盖报备人；以下为占位满足类型
          saOwnerId: opp.saOwnerId, saOwnerName: opp.saOwnerName,
          salesOwnerId: opp.salesOwnerId, salesOwnerName: opp.salesOwnerName,
          stage: 'reporting',
        } as never), refetchOpps)
        return { success: true, similar }
      },

      updateStage: async (id, stage, signingInfo) => {
        const now = new Date().toISOString()
        const locked = ['signed', 'delivery'].includes(stage)
        const previousOpportunity = get().opportunities.find(opportunity => opportunity.id === id)
        set(s => ({
          opportunities: s.opportunities.map(o =>
            o.id === id
              ? {
                  ...o, stage, updatedAt: now, lockedPermanently: locked || o.lockedPermanently,
                  ...(signingInfo ? {
                    contractNo: signingInfo.contractNo,
                    signedDate: signingInfo.signedDate,
                    signedAmount: signingInfo.signedAmount,
                    contractFileId: signingInfo.contractFileUrl,
                  } : {}),
                }
              : o
          )
        }))
        const user = get().currentUser
        get().addLog({
          opportunityId: id,
          operatorId: user.id,
          operatorName: user.name,
          action: '更新阶段',
          detail: `阶段变更为：${stage}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        if (!USE_API) return
        try {
          await opportunityApi.updateStage(id, stage, signingInfo && {
            contractNo: signingInfo.contractNo, signedDate: signingInfo.signedDate,
            signedAmount: signingInfo.signedAmount, contractFileKey: signingInfo.contractFileUrl,
          })
          await refetchOpps()
        } catch (error) {
          if (previousOpportunity) {
            set(state => ({ opportunities: state.opportunities.map(opportunity => opportunity.id === id ? previousOpportunity : opportunity) }))
          }
          throw error
        }
      },

      deleteOpportunity: (id) => {
        set(s => ({
          opportunities: s.opportunities.filter(o => o.id !== id),
          notifications: s.notifications.filter(n => n.opportunityId !== id),
        }))
        writeThrough(opportunityApi.remove(id), refetchOpps)
      },

      releaseOpportunity: (id, reason) => {
        const now = new Date().toISOString()
        const user = get().currentUser
        const opp = get().opportunities.find(o => o.id === id)
        set(s => ({
          opportunities: s.opportunities.map(o =>
            o.id === id
              ? { ...o, stage: 'released', updatedAt: now, releaseReason: reason, releasedBy: user.name, releasedAt: now }
              : o
          )
        }))
        if (opp) {
          get().addNotification({
            userId: opp.salesOwnerId,
            title: '商机已被释放',
            body: `客户「${opp.customerName}」商机已释放，原因：${reason}`,
            type: 'warning',
            read: false,
            opportunityId: id,
          })
        }
        get().addLog({
          opportunityId: id,
          operatorId: user.id,
          operatorName: user.name,
          action: '手动释放商机',
          detail: `释放原因：${reason}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(opportunityApi.release(id, reason), refetchOpps)
      },

      freezeOpportunity: (id, reason) => {
        const user = get().currentUser
        set(s => ({
          opportunities: s.opportunities.map(o =>
            o.id === id ? { ...o, isFrozen: true, frozenReason: reason, updatedAt: new Date().toISOString() } : o
          )
        }))
        get().addLog({
          opportunityId: id,
          operatorId: user.id,
          operatorName: user.name,
          action: '冻结商机',
          detail: `冻结原因：${reason}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(opportunityApi.freeze(id, reason), refetchOpps)
      },

      approveEvidence: (id) => {
        const user = get().currentUser
        set(s => ({
          opportunities: s.opportunities.map(o =>
            o.id === id ? { ...o, isFrozen: false, frozenReason: undefined, updatedAt: new Date().toISOString() } : o
          )
        }))
        get().addLog({
          opportunityId: id,
          operatorId: user.id,
          operatorName: user.name,
          action: '审核举证通过',
          detail: '举证审核通过，商机解冻',
          ip: '127.0.0.1',
          device: 'Web',
        })
      },

      rejectEvidence: (id, reason) => {
        const now = new Date().toISOString()
        const user = get().currentUser
        const opp = get().opportunities.find(o => o.id === id)
        set(s => ({
          opportunities: s.opportunities.map(o =>
            o.id === id ? { ...o, stage: 'released', releaseReason: reason, releasedBy: user.name, releasedAt: now, updatedAt: now } : o
          )
        }))
        if (opp) {
          get().addNotification({
            userId: opp.salesOwnerId,
            title: '举证被驳回',
            body: `客户「${opp.customerName}」举证驳回，商机已释放。原因：${reason}`,
            type: 'error',
            read: false,
            opportunityId: id,
          })
        }
        get().addLog({
          opportunityId: id,
          operatorId: user.id,
          operatorName: user.name,
          action: '驳回举证',
          detail: `驳回原因：${reason}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
      },

      requestRenewal: (opportunityId) => {
        const user = get().currentUser
        const req: RenewalRequest = {
          id: generateId(),
          opportunityId,
          requesterId: user.id,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }
        set(s => ({
          opportunities: s.opportunities.map(o =>
            o.id === opportunityId
              ? { ...o, renewalRequests: [...o.renewalRequests, req] }
              : o
          )
        }))
        // notify all admins
        get().users.filter(u => u.role === 'admin').forEach(admin => {
          get().addNotification({
            userId: admin.id,
            title: '续期申请待审批',
            body: `${user.name} 申请商机续期，请及时处理`,
            type: 'info',
            read: false,
            opportunityId,
          })
        })
        get().addLog({
          opportunityId,
          operatorId: user.id,
          operatorName: user.name,
          action: '申请续期',
          detail: '申请延长锁定期 30 天',
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(opportunityApi.requestRenewal(opportunityId), refetchOpps)
      },

      approveRenewal: (requestId, opportunityId) => {
        const user = get().currentUser
        const now = new Date().toISOString()
        const opp = get().opportunities.find(o => o.id === opportunityId)
        if (!opp) return
        const newRelease = addDays(opp.releaseAt, 30)
        set(s => ({
          opportunities: s.opportunities.map(o => {
            if (o.id !== opportunityId) return o
            return {
              ...o,
              releaseAt: newRelease,
              updatedAt: now,
              renewalRequests: o.renewalRequests.map(r =>
                r.id === requestId
                  ? { ...r, status: 'approved', processedAt: now, processedBy: user.name }
                  : r
              )
            }
          })
        }))
        const req = opp.renewalRequests.find(r => r.id === requestId)
        if (req) {
          get().addNotification({
            userId: req.requesterId,
            title: '续期申请已批准',
            body: `客户「${opp.customerName}」续期申请已批准，锁定期延长至 ${formatDate(newRelease)}`,
            type: 'success',
            read: false,
            opportunityId,
          })
        }
        get().addLog({
          opportunityId,
          operatorId: user.id,
          operatorName: user.name,
          action: '批准续期',
          detail: `锁定期延长至 ${formatDate(newRelease)}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(opportunityApi.approveRenewal(opportunityId, requestId), refetchOpps)
      },

      rejectRenewal: (requestId, opportunityId, reason) => {
        const user = get().currentUser
        const now = new Date().toISOString()
        const opp = get().opportunities.find(o => o.id === opportunityId)
        set(s => ({
          opportunities: s.opportunities.map(o => {
            if (o.id !== opportunityId) return o
            return {
              ...o,
              updatedAt: now,
              renewalRequests: o.renewalRequests.map(r =>
                r.id === requestId
                  ? { ...r, status: 'rejected', rejectionReason: reason, processedAt: now, processedBy: user.name }
                  : r
              )
            }
          })
        }))
        if (opp) {
          const req = opp.renewalRequests.find(r => r.id === requestId)
          if (req) {
            get().addNotification({
              userId: req.requesterId,
              title: '续期申请已拒绝',
              body: `客户「${opp.customerName}」续期申请被拒绝，原因：${reason}`,
              type: 'error',
              read: false,
              opportunityId,
            })
          }
        }
        get().addLog({
          opportunityId,
          operatorId: user.id,
          operatorName: user.name,
          action: '拒绝续期',
          detail: `拒绝原因：${reason}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(opportunityApi.rejectRenewal(opportunityId, requestId, reason), refetchOpps)
      },

      addProgressReport: (report) => {
        const now = new Date().toISOString()
        const newReport: ProgressReport = { ...report, id: generateId(), createdAt: now }
        set(s => ({
          opportunities: s.opportunities.map(o =>
            o.id === report.opportunityId
              ? { ...o, progressReports: [...o.progressReports, newReport], updatedAt: now }
              : o
          )
        }))
        if (report.needsSupport) {
          get().users.filter(u => u.role === 'admin').forEach(admin => {
            get().addNotification({
              userId: admin.id,
              title: '渠道请求 SA 支持',
              body: `${report.reporterId} 的商机需要 SA 协助`,
              type: 'info',
              read: false,
              opportunityId: report.opportunityId,
            })
          })
        }
        writeThrough(opportunityApi.addProgress(report.opportunityId, {
          status: report.status, lastContactDate: report.lastContactDate,
          description: report.description, estimatedSignDate: report.estimatedSignDate,
          needsSupport: report.needsSupport,
        }), refetchOpps)
      },

      addNotification: (n) => {
        const notif: Notification = { ...n, id: generateId(), createdAt: new Date().toISOString() }
        set(s => ({ notifications: [notif, ...s.notifications] }))
      },

      markNotificationRead: (id) => {
        set(s => ({
          notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n)
        }))
        writeThrough(notificationApi.markRead(id), refetchNotifs)
      },

      addChannel: (c, account, jdAccount) => {
        const now = new Date().toISOString()
        const channelId = generateId()
        const channel: ChannelPartner = { ...c, id: channelId, createdAt: now, jdManagerEmail: jdAccount?.email || c.jdManagerEmail }
        set(s => ({ channels: [...s.channels, channel] }))
        const admin = get().currentUser
        if (account) {
          const user = {
            id: generateId(), name: account.name, role: 'channel' as const,
            email: account.email, password: account.password, channelId, createdAt: now,
          }
          set(s => ({ users: [...s.users, user] }))
          get().addLog({
            opportunityId: '', operatorId: admin.id, operatorName: admin.name,
            action: '新建渠道账号', detail: `渠道：${c.name}，账号：${account.email}`,
            ip: '127.0.0.1', device: 'Web',
          })
        }
        // 京东渠道经理独立登录账号
        if (jdAccount) {
          const jdUser = {
            id: generateId(), name: jdAccount.name, role: 'channel' as const,
            email: jdAccount.email, password: jdAccount.password, channelId, isJdManager: true, createdAt: now,
          }
          set(s => ({ users: [...s.users, jdUser] }))
          get().addLog({
            opportunityId: '', operatorId: admin.id, operatorName: admin.name,
            action: '新建京东渠道经理账号', detail: `渠道：${c.name}，京东渠道经理：${jdAccount.email}`,
            ip: '127.0.0.1', device: 'Web',
          })
        }
        writeThrough(
          channelApi.create({ name: c.name, fullName: c.fullName, contactName: c.contactName, phone: c.phone, jdManagerName: c.jdManagerName } as never, account, jdAccount),
          async () => { await refetchChannels(); await refetchUsers() },
        )
      },

      updateChannel: (channelId, updates) => {
        const channel = get().channels.find(c => c.id === channelId)
        if (!channel) return { success: false, error: '渠道不存在' }
        set(s => ({ channels: s.channels.map(c => c.id === channelId ? { ...c, ...updates } : c) }))
        const admin = get().currentUser
        get().addLog({
          opportunityId: '', operatorId: admin.id, operatorName: admin.name,
          action: '编辑渠道信息', detail: `渠道：${updates.name || channel.name}，更新字段：${Object.keys(updates).join('、')}`,
          ip: '127.0.0.1', device: 'Web',
        })
        writeThrough(channelApi.update(channelId, updates), refetchChannels)
        return { success: true }
      },

      toggleChannel: (id) => {
        const channel = get().channels.find(c => c.id === id)
        const newStatus = channel?.status === 'active' ? 'disabled' : 'active'
        set(s => ({
          channels: s.channels.map(c =>
            c.id === id ? { ...c, status: newStatus } : c
          ),
          // also disable/enable the linked user
          users: s.users.map(u =>
            u.channelId === id ? { ...u, disabled: newStatus === 'disabled' } : u
          ),
        }))
        writeThrough(channelApi.toggle(id), async () => { await refetchChannels(); await refetchUsers() })
      },

      createChannelAccount: (channelId, account) => {
        const existing = get().users.find(u => u.channelId === channelId)
        if (existing) return { success: false, error: '该渠道已有关联账号' }
        const emailTaken = get().users.find(u => u.email === account.email)
        if (emailTaken) return { success: false, error: '该邮箱已被使用' }
        const pv = validatePassword(account.password)
        if (!pv.valid) return { success: false, error: pv.error }
        const now = new Date().toISOString()
        const user = {
          id: generateId(),
          name: account.name,
          role: 'channel' as const,
          email: account.email,
          password: account.password,
          channelId,
          createdAt: now,
        }
        set(s => ({ users: [...s.users, user] }))
        const admin = get().currentUser
        const channel = get().channels.find(c => c.id === channelId)
        get().addLog({
          opportunityId: '',
          operatorId: admin.id,
          operatorName: admin.name,
          action: '补建渠道账号',
          detail: `渠道：${channel?.name}，账号：${account.email}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(channelApi.createAccount(channelId, account), refetchUsers)
        return { success: true }
      },

      updateChannelAccount: (userId, updates) => {
        if (updates.password !== undefined && updates.password !== '') {
          const pv = validatePassword(updates.password)
          if (!pv.valid) return { success: false, error: pv.error }
        }
        if (updates.email) {
          const taken = get().users.find(u => u.email === updates.email && u.id !== userId)
          if (taken) return { success: false, error: '该邮箱已被使用' }
        }
        set(s => ({
          users: s.users.map(u => u.id === userId ? { ...u, ...updates } : u)
        }))
        const admin = get().currentUser
        get().addLog({
          opportunityId: '',
          operatorId: admin.id,
          operatorName: admin.name,
          action: '编辑渠道账号',
          detail: `账号 ID：${userId}，更新字段：${Object.keys(updates).join('、')}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(userApi.update(userId, updates), refetchUsers)
        return { success: true }
      },

      toggleUserDisabled: (userId) => {
        const user = get().users.find(u => u.id === userId)
        if (!user) return
        set(s => ({
          users: s.users.map(u => u.id === userId ? { ...u, disabled: !u.disabled } : u)
        }))
        const admin = get().currentUser
        get().addLog({
          opportunityId: '',
          operatorId: admin.id,
          operatorName: admin.name,
          action: user.disabled ? '启用账号' : '停用账号',
          detail: `账号：${user.email}（${user.name}）`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(userApi.toggleDisabled(userId), refetchUsers)
      },

      createUser: (info) => {
        const { users } = get()
        if (users.some(u => u.email === info.email)) return { success: false, error: '该邮箱已被使用' }
        const pv = validatePassword(info.password)
        if (!pv.valid) return { success: false, error: pv.error }
        const newUser = {
          id: generateId(),
          name: info.name,
          role: info.role,
          email: info.email,
          password: info.password,
          group: info.group,
          createdAt: new Date().toISOString(),
          disabled: false,
        }
        set(s => ({ users: [...s.users, newUser] }))
        const admin = get().currentUser
        get().addLog({
          opportunityId: '',
          operatorId: admin.id,
          operatorName: admin.name,
          action: '新增账号',
          detail: `新增${roleName(info.role)}账号：${info.name}（${info.email}）`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(userApi.create(info), refetchUsers)
        return { success: true }
      },

      updateUser: (userId, updates) => {
        if (updates.password !== undefined && updates.password !== '') {
          const pv = validatePassword(updates.password)
          if (!pv.valid) return { success: false, error: pv.error }
        }
        if (updates.email) {
          const taken = get().users.find(u => u.email === updates.email && u.id !== userId)
          if (taken) return { success: false, error: '该邮箱已被使用' }
        }
        set(s => ({
          users: s.users.map(u => u.id === userId ? { ...u, ...updates } : u)
        }))
        const admin = get().currentUser
        const target = get().users.find(u => u.id === userId)
        get().addLog({
          opportunityId: '',
          operatorId: admin.id,
          operatorName: admin.name,
          action: '编辑账号',
          detail: `修改账号信息：${target?.name}（${target?.email}）`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(userApi.update(userId, updates), refetchUsers)
        return { success: true }
      },

      deleteUser: (userId) => {
        const user = get().users.find(u => u.id === userId)
        if (!user) return
        set(s => ({ users: s.users.filter(u => u.id !== userId) }))
        const admin = get().currentUser
        get().addLog({
          opportunityId: '',
          operatorId: admin.id,
          operatorName: admin.name,
          action: '删除账号',
          detail: `删除账号：${user.name}（${user.email}）`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(userApi.remove(userId), refetchUsers)
      },

      deleteChannel: (channelId) => {
        const channel = get().channels.find(c => c.id === channelId)
        if (!channel) return
        set(s => ({
          channels: s.channels.filter(c => c.id !== channelId),
          users: s.users.filter(u => u.channelId !== channelId),
        }))
        const admin = get().currentUser
        get().addLog({
          opportunityId: '',
          operatorId: admin.id,
          operatorName: admin.name,
          action: '删除渠道',
          detail: `删除渠道：${channel.name}`,
          ip: '127.0.0.1',
          device: 'Web',
        })
        writeThrough(channelApi.remove(channelId), async () => { await refetchChannels(); await refetchUsers() })
      },

      addLog: (log) => {
        const entry: OperationLog = { ...log, id: generateId(), createdAt: new Date().toISOString() }
        set(s => ({ logs: [entry, ...s.logs] }))
      },

      processAutoReleases: () => {
        const now = new Date().toISOString()
        const expired = get().opportunities.filter(
          o => !['released', 'closed'].includes(o.stage) && !o.lockedPermanently && o.releaseAt < now
        )
        if (expired.length === 0) return
        set(s => ({
          opportunities: s.opportunities.map(o => {
            if (['released', 'closed'].includes(o.stage) || o.lockedPermanently || o.releaseAt >= now) return o
            return { ...o, stage: 'released', releasedAt: now, releaseReason: '保护期到期自动释放', releasedBy: 'system', updatedAt: now }
          })
        }))
      },
    }),
    {
      name: 'ai-crm-store-v11',
      // Strip large base64 image data before writing to localStorage
      partialize: (state) => ({
        ...state,
        opportunities: state.opportunities.map(o => ({ ...o, evidenceFiles: [] })),
      }),
    }
  )
)
