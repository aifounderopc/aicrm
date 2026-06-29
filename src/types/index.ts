export type UserRole = 'sales' | 'channel' | 'admin' | 'channel_admin' | 'sales_admin'
// admin = 超级管理员（全局最大权限）；channel_admin = 渠道管理员；sales_admin = 直客销售管理员

export interface User {
  id: string
  name: string
  role: UserRole
  email: string
  password?: string   // hashed in real system; stored plaintext for demo
  channelId?: string  // for channel partners
  group?: string      // sales team group
  createdAt?: string
  disabled?: boolean
  isJdManager?: boolean // 京东渠道经理账号（与渠道伙伴账号区分，同样关联 channelId）
}

export type OpportunityStage =
  | 'reporting'   // 报备中
  | 'signing'     // 签约中
  | 'delivery'    // 项目交付
  | 'signed'      // 已签约
  | 'released'    // 已释放

export type IndustryType =
  | '3C / 数码'
  | '家电 / 智能硬件'
  | '美妆 / 护肤'
  | '食品 / 饮料'
  | '酒水'
  | '母婴 / 儿童'
  | '大健康 / 医疗'
  | '汽车 / 出行'
  | '服装 / 时尚'
  | '家居 / 家装'
  | '宠物'
  | '运动 / 户外'
  | '餐饮 / 本地生活'
  | '互联网 / 科技'
  | '金融 / 保险'
  | '教育 / 培训'
  | '旅游 / 酒店'
  | '娱乐 / 游戏'
  | '奢侈品'
  | '工业 / 制造'
  | '房产 / 物业'
  | '其他'

export type CustomerSource = 'direct' | 'channel'

export type AmountRange = 'under5' | '5to10' | '10to20' | '20to50' | 'above50'

export type ContactLevel = '决策层' | '执行层' | '技术评估层'

export type ProgressStatus = 'normal' | 'evaluating' | 'paused' | 'blocked'

export interface ProgressReport {
  id: string
  opportunityId: string
  reporterId: string
  status: ProgressStatus
  lastContactDate: string
  description: string
  estimatedSignDate: string
  needsSupport: boolean
  createdAt: string
}

export interface RenewalRequest {
  id: string
  opportunityId: string
  requesterId: string
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
  rejectionReason?: string
  createdAt: string
  processedAt?: string
  processedBy?: string
}

export interface EvidenceFile {
  id: string
  name: string
  url: string
  size?: number
  uploadedAt: string
  uploadedBy: string
}

export interface Contact {
  level: ContactLevel
  department: string
  contactTypes: ('phone' | 'email' | 'wechat')[]
  // encrypted fields (only visible to owner + admin)
  encryptedName?: string
  encryptedContact?: string
  phoneHash?: string // SHA-256 hash for dedup
}

export interface Opportunity {
  id: string
  customerName: string
  companyName?: string
  industry: IndustryType
  source: CustomerSource
  channelId?: string
  channelName?: string
  channelManagerName?: string
  saOwnerId: string
  saOwnerName: string
  salesOwnerId: string
  salesOwnerName: string
  stage: OpportunityStage
  reportedAt: string
  updatedAt: string
  releaseAt: string // auto: reportedAt + 30 days; extended on renewal
  lockedPermanently: boolean // true once in signing/delivery/signed

  contact: Contact
  firstContactDate: string
  requirementDescription: string
  amountRange: AmountRange
  evidenceFiles: EvidenceFile[]

  // signing stage fields
  contractNo?: string
  signedDate?: string
  signedAmount?: number
  contractFileId?: string

  // admin fields
  frozenReason?: string
  isFrozen: boolean
  releaseReason?: string
  releasedBy?: string
  releasedAt?: string

  // subsidiary flag
  isSubsidiary?: boolean
  parentCompanyName?: string

  progressReports: ProgressReport[]
  renewalRequests: RenewalRequest[]

  // notifications
  lastReportReminderSent?: string
}

export interface OperationLog {
  id: string
  opportunityId: string
  operatorId: string
  operatorName: string
  action: string
  detail: string
  ip: string
  device: string
  createdAt: string
}

export interface ChannelPartner {
  id: string
  name: string          // 渠道名称（简称）
  fullName?: string     // 渠道伙伴公司全称
  contactName: string
  email: string
  phone: string
  status: 'active' | 'disabled'
  createdAt: string
  jdManagerName?: string   // 对接的京东渠道业务经理
  jdManagerEmail?: string  // 京东渠道经理登录邮箱（如已开通独立账号）
}

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  type: 'info' | 'warning' | 'success' | 'error'
  read: boolean
  createdAt: string
  opportunityId?: string
}

export interface AppState {
  currentUser: User
  users: User[]
  opportunities: Opportunity[]
  channels: ChannelPartner[]
  logs: OperationLog[]
  notifications: Notification[]
}
