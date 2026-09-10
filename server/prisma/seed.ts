// 数据库种子：初始管理员 + 子管理员 + 示例销售/渠道账号（替代前端 seed.ts）
// 运行：npm run seed
import { OpportunityStage, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME } from '../src/tenant.js'

const prisma = new PrismaClient()
const hash = (p: string) => bcrypt.hash(p, 12)
const seedPassword = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`首次初始化缺少环境变量 ${name}`)
  return value
}

async function main() {
  await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: { name: DEFAULT_TENANT_NAME, code: 'joymarketing', status: 'active', isDefault: true },
    create: { id: DEFAULT_TENANT_ID, name: DEFAULT_TENANT_NAME, code: 'joymarketing', status: 'active', isDefault: true },
  })
  const users = [
    { id: 'admin1', name: '张管理', role: 'admin', email: 'admin@joymarketing.com', passwordEnv: 'SEED_ADMIN_PASSWORD' },
    { id: 'cadmin1', name: '李渠道', role: 'channel_admin', email: 'channeladmin@joymarketing.com', passwordEnv: 'SEED_CHANNEL_ADMIN_PASSWORD' },
    { id: 'sadmin1', name: '王直客', role: 'sales_admin', email: 'salesadmin@joymarketing.com', passwordEnv: 'SEED_SALES_ADMIN_PASSWORD' },
    { id: 'u_yd', name: '李天琦', role: 'sales', email: 'tianqi@joymarketing.com', passwordEnv: 'SEED_SALES_PASSWORD' },
  ] as const

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { id: u.id } })
    if (!existing) {
      await prisma.user.create({ data: {
        id: u.id, tenantId: DEFAULT_TENANT_ID, name: u.name, email: u.email, role: u.role,
        isPlatformAdmin: u.role === 'admin',
        passwordHash: await hash(seedPassword(u.passwordEnv)), mustChangePwd: true,
      } })
    } else if (u.role === 'admin' && !existing.isPlatformAdmin) await prisma.user.update({ where: { id: u.id }, data: { isPlatformAdmin: true } })
  }

  const mockOwner = await prisma.user.findUniqueOrThrow({ where: { id: 'u_yd' } })
  const newSalesUsers = [
    { id: 'u_ly', name: '林悦', email: 'linyue@joymarketing.com', groupName: '智能终端组' },
    { id: 'u_zn', name: '周宁', email: 'zhouning@joymarketing.com', groupName: '消费品牌组' },
  ]
  for (const user of newSalesUsers) {
    await prisma.user.upsert({
      where: { id: user.id }, update: {},
      create: { ...user, role: 'sales', passwordHash: mockOwner.passwordHash, mustChangePwd: true },
    })
  }

  const channels = [
    { id: 'c_xlsz', name: '星链数字', fullName: '上海星链数字科技有限公司', contactName: '顾晨', phone: '13900000006', jdManagerName: '潘子恒' },
    { id: 'c_yqkj', name: '云启科技', fullName: '杭州云启智能科技有限公司', contactName: '宋雨', phone: '13900000007', jdManagerName: '马思源' },
  ]
  for (const channel of channels) {
    await prisma.channel.upsert({ where: { id: channel.id }, update: {}, create: channel })
  }

  const channelUsers = [
    { id: 'ch_xlsz', name: '星链数字', email: 'xinglian@partner.com', channelId: 'c_xlsz' },
    { id: 'ch_yqkj', name: '云启科技', email: 'yunqi@partner.com', channelId: 'c_yqkj' },
  ]
  const channelPasswordTemplate = await prisma.user.findFirst({ where: { role: 'channel', isJdManager: false } })
  const channelPasswordHash = channelPasswordTemplate?.passwordHash ?? await hash(seedPassword('SEED_CHANNEL_PASSWORD'))
  for (const user of channelUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { ...user, role: 'channel', passwordHash: channelPasswordHash, mustChangePwd: true },
    })
  }

  // 预发/演示环境的 Top 品牌商机：固定 ID + upsert，可安全重复执行。
  const ago = (days: number) => new Date(Date.now() - days * 86400_000)
  const later = (days: number) => new Date(Date.now() + days * 86400_000)
  const mockOpportunities: Array<{
    id: string; customerName: string; companyName: string; industry: string
    stage: OpportunityStage; amountRange: string; department: string; requirement: string
    ownerId?: string; ownerName?: string; source?: 'direct' | 'channel'; channelId?: string; channelName?: string; channelManagerName?: string
  }> = [
    { id: 'mock_opp_01', customerName: '荣耀', companyName: '荣耀终端有限公司', industry: '3C / 数码', stage: 'signed', amountRange: 'above50', department: 'CI+EC', requirement: '荣耀品牌内容与电商运营合作，已完成年度框架签署，持续推进交付。' },
    { id: 'mock_opp_02', customerName: '博士西门子', companyName: '博西家用电器有限公司', industry: '家电 / 智能硬件', stage: 'signing', amountRange: '20to50', department: 'CI', requirement: '博士西门子品牌形象升级与内容制作项目，合同条款已对齐，等待客户法务审核。' },
    { id: 'mock_opp_03', customerName: '脉动', companyName: '达能（中国）食品饮料有限公司', industry: '食品 / 饮料', stage: 'reporting', amountRange: '10to20', department: 'EC', requirement: '脉动电商运营项目初步接触，客户对京东电商代运营方案有兴趣。' },
    { id: 'mock_opp_04', customerName: '疯狂小狗', companyName: '疯狂小狗宠物用品有限公司', industry: '宠物', stage: 'reporting', amountRange: '5to10', department: '营销', requirement: '宠物品牌内容与社交媒体推广合作，客户已明确预算范围。' },
    { id: 'mock_opp_05', customerName: '海尔', companyName: '海尔集团公司', industry: '家电 / 智能硬件', stage: 'delivery', amountRange: 'above50', department: 'EC', requirement: '海尔全品类店铺运营与营销推广项目，当前已进入交付执行阶段。' },
    { id: 'mock_opp_06', customerName: '安利', companyName: '安利（中国）日用品有限公司', industry: '食品 / 饮料', stage: 'reporting', amountRange: '10to20', department: '用户体验', requirement: '安利用户体验优化项目，聚焦线上触点与内容运营，方案制作中。' },
    { id: 'mock_opp_07', customerName: '雀巢', companyName: '雀巢（中国）有限公司', industry: '食品 / 饮料', stage: 'signing', amountRange: '20to50', department: 'EC', requirement: '雀巢天猫与京东双平台运营合作，合同已进入法务审核阶段。' },
    { id: 'mock_opp_09', customerName: '宝洁（SKII）', companyName: '宝洁（中国）营销有限公司', industry: '美妆 / 护肤', stage: 'signed', amountRange: 'above50', department: '高端护肤', requirement: 'SKII 高端护肤品牌数字营销合作，已完成合同签署并进入执行。' },
    { id: 'mock_opp_11', customerName: '五粮液', companyName: '四川省宜宾五粮液股份有限公司', industry: '酒水', stage: 'reporting', amountRange: '20to50', department: '品牌部', requirement: '五粮液品牌升级与年度内容规划合作，已完成首次高层拜访。' },
    { id: 'mock_opp_12', customerName: '舍得', companyName: '舍得酒业股份有限公司', industry: '酒水', stage: 'reporting', amountRange: '10to20', department: 'EC', requirement: '舍得酒业电商运营项目，客户有明确的线上增长与内容升级需求。' },
    { id: 'mock_opp_13', customerName: '京东大药房', companyName: '京东大药房（青岛）连锁有限公司', industry: '大健康 / 医疗', stage: 'signing', amountRange: '20to50', department: '用户运营', requirement: '京东大药房会员增长与健康服务体验优化项目，已进入商务谈判。' },
    { id: 'mock_opp_14', customerName: '艾芙尼', companyName: '艾芙尼（上海）化妆品有限公司', industry: '美妆 / 护肤', stage: 'reporting', amountRange: '5to10', department: '营销', requirement: '艾芙尼会员运营与营销自动化合作，目前正在进行需求调研。' },
    { id: 'mock_opp_15', customerName: '东风汽车（卓联）', companyName: '东风汽车集团有限公司', industry: '汽车 / 出行', stage: 'reporting', amountRange: '20to50', department: '用户体验', requirement: '东风汽车用户旅程优化与数字化触点建设项目，方案制作中。' },
    { id: 'mock_opp_16', customerName: '人头马', companyName: '人头马君度（上海）酒业有限公司', industry: '酒水', stage: 'reporting', amountRange: '10to20', department: '品牌营销', requirement: '人头马品牌高端化与电商内容运营合作，等待客户确认项目范围。' },
    { id: 'mock_opp_17', customerName: '嘉士伯', companyName: '嘉士伯啤酒（广东）有限公司', industry: '酒水', stage: 'reporting', amountRange: '10to20', department: '数字营销', requirement: '嘉士伯啤酒线上营销与消费者互动项目，正在进行需求澄清。' },
    { id: 'mock_opp_18', customerName: '蒙牛', companyName: '内蒙古蒙牛乳业（集团）股份有限公司', industry: '食品 / 饮料', stage: 'signing', amountRange: '20to50', department: '电商事业部', requirement: '蒙牛年度电商运营与内容增长合作，采购流程与合同条款确认中。' },
    { id: 'mock_opp_19', customerName: '康明斯', companyName: '康明斯（中国）投资有限公司', industry: '工业 / 制造', stage: 'reporting', amountRange: '10to20', department: '市场部', requirement: '康明斯工业品品牌内容与数字化客户旅程项目，已完成首轮沟通。' },
    { id: 'mock_opp_20', customerName: '创维电视', companyName: '深圳创维-RGB电子有限公司', industry: '家电 / 智能硬件', stage: 'signed', amountRange: '20to50', department: 'EC', requirement: '创维电视电商平台运营与营销推广合作，已签署并持续交付。' },
    { id: 'opp_sales_ly_phone', customerName: '小米', companyName: '小米科技有限责任公司', industry: '3C / 数码', stage: 'contacting', amountRange: '20to50', department: '手机市场部', requirement: '围绕小米手机新品用户洞察开展声访 AI 调研，已确认核心人群与首轮访谈范围。', ownerId: 'u_ly', ownerName: '林悦' },
    { id: 'opp_sales_ly_appliance', customerName: '海信', companyName: '海信集团控股股份有限公司', industry: '家电 / 智能硬件', stage: 'proposal', amountRange: '20to50', department: '智慧家电事业部', requirement: '针对海信智慧家电购买决策链路开展声访 AI 调研，研究方案已提交客户评审。', ownerId: 'u_ly', ownerName: '林悦' },
    { id: 'opp_sales_ly_beauty', customerName: '欧莱雅', companyName: '欧莱雅（中国）有限公司', industry: '美妆 / 护肤', stage: 'reporting', amountRange: '10to20', department: '消费者洞察部', requirement: '通过声访 AI 调研了解欧莱雅新品试用反馈与复购驱动因素，正在补充样本人群。', ownerId: 'u_ly', ownerName: '林悦' },
    { id: 'opp_sales_zn_phone', customerName: 'vivo', companyName: '维沃移动通信有限公司', industry: '3C / 数码', stage: 'negotiation', amountRange: '20to50', department: '用户研究部', requirement: 'vivo 手机影像功能用户体验声访 AI 调研已完成需求确认，进入报价谈判阶段。', ownerId: 'u_zn', ownerName: '周宁' },
    { id: 'opp_sales_zn_appliance', customerName: '美的', companyName: '美的集团股份有限公司', industry: '家电 / 智能硬件', stage: 'contacting', amountRange: '10to20', department: '用户体验中心', requirement: '围绕美的智能家居使用体验开展声访 AI 调研，已约定业务团队需求沟通会。', ownerId: 'u_zn', ownerName: '周宁' },
    { id: 'opp_sales_zn_beauty', customerName: '雅诗兰黛', companyName: '雅诗兰黛（上海）商贸有限公司', industry: '美妆 / 护肤', stage: 'proposal', amountRange: '20to50', department: '品牌洞察部', requirement: '雅诗兰黛高端护肤消费动机声访 AI 调研已形成执行方案，等待客户确认排期。', ownerId: 'u_zn', ownerName: '周宁' },
    { id: 'opp_channel_xl_phone', customerName: 'OPPO', companyName: 'OPPO 广东移动通信有限公司', industry: '3C / 数码', stage: 'contacting', amountRange: '20to50', department: '用户洞察部', requirement: 'OPPO 手机换机需求声访 AI 调研由星链数字引荐，已完成研究目标与样本口径沟通。', ownerId: 'ch_xlsz', ownerName: '星链数字', source: 'channel', channelId: 'c_xlsz', channelName: '星链数字', channelManagerName: '潘子恒' },
    { id: 'opp_channel_xl_appliance', customerName: 'TCL', companyName: 'TCL 科技集团股份有限公司', industry: '家电 / 智能硬件', stage: 'reporting', amountRange: '10to20', department: '智能终端事业部', requirement: 'TCL 大屏产品家庭场景声访 AI 调研由星链数字报备，正在确认联系人和预算。', ownerId: 'ch_xlsz', ownerName: '星链数字', source: 'channel', channelId: 'c_xlsz', channelName: '星链数字', channelManagerName: '潘子恒' },
    { id: 'opp_channel_xl_beauty', customerName: '珀莱雅', companyName: '珀莱雅化妆品股份有限公司', industry: '美妆 / 护肤', stage: 'proposal', amountRange: '10to20', department: '市场研究部', requirement: '珀莱雅功效护肤人群声访 AI 调研已完成初步访谈框架，方案等待品牌方评审。', ownerId: 'ch_xlsz', ownerName: '星链数字', source: 'channel', channelId: 'c_xlsz', channelName: '星链数字', channelManagerName: '潘子恒' },
    { id: 'opp_channel_yq_phone', customerName: '一加', companyName: '深圳市万普拉斯科技有限公司', industry: '3C / 数码', stage: 'proposal', amountRange: '10to20', department: '产品策略部', requirement: '一加手机核心用户声访 AI 调研由云启科技引荐，研究框架与交付物已提交。', ownerId: 'ch_yqkj', ownerName: '云启科技', source: 'channel', channelId: 'c_yqkj', channelName: '云启科技', channelManagerName: '马思源' },
    { id: 'opp_channel_yq_appliance', customerName: '格力', companyName: '珠海格力电器股份有限公司', industry: '家电 / 智能硬件', stage: 'negotiation', amountRange: '20to50', department: '市场用户研究部', requirement: '格力空调焕新需求声访 AI 调研已确认样本规模，当前推进预算与执行周期审批。', ownerId: 'ch_yqkj', ownerName: '云启科技', source: 'channel', channelId: 'c_yqkj', channelName: '云启科技', channelManagerName: '马思源' },
    { id: 'opp_channel_yq_beauty', customerName: '花西子', companyName: '浙江宜格企业管理集团有限公司', industry: '美妆 / 护肤', stage: 'contacting', amountRange: '10to20', department: '消费者运营部', requirement: '花西子彩妆用户偏好声访 AI 调研由云启科技报备，正在确认重点品类与目标人群。', ownerId: 'ch_yqkj', ownerName: '云启科技', source: 'channel', channelId: 'c_yqkj', channelName: '云启科技', channelManagerName: '马思源' },
  ]

  // 清理历史种子中的重复商机；关联信号按数据库约束解除商机关联并保留审计来源。
  await prisma.opportunity.deleteMany({
    where: { OR: [{ id: 'mock_opp_08' }, { customerName: '宝洁（衣清）' }] },
  })

  for (const [index, opp] of mockOpportunities.entries()) {
    const locked = opp.stage === 'signed' || opp.stage === 'delivery'
    const owner = opp.ownerId ? await prisma.user.findUniqueOrThrow({ where: { id: opp.ownerId } }) : mockOwner
    const source = opp.source ?? 'direct'
    await prisma.opportunity.upsert({
      where: { id: opp.id },
      update: {
        customerName: opp.customerName, customerNameNorm: opp.customerName.toLowerCase(),
        companyName: opp.companyName, industry: opp.industry, stage: opp.stage,
        productInterests: ['JM 声访'], source,
        channelId: opp.channelId ?? null, channelName: opp.channelName ?? null, channelManagerName: opp.channelManagerName ?? null,
        saOwnerId: owner.id, saOwnerName: opp.ownerName ?? owner.name,
        salesOwnerId: owner.id, salesOwnerName: opp.ownerName ?? owner.name,
        amountRange: opp.amountRange, requirementDescription: opp.requirement,
        lockedPermanently: locked, releaseAt: locked ? later(365) : later(5 + index),
      },
      create: {
        id: opp.id, customerName: opp.customerName, customerNameNorm: opp.customerName.toLowerCase(),
        companyName: opp.companyName, industry: opp.industry, productInterests: ['JM 声访'], source,
        channelId: opp.channelId, channelName: opp.channelName, channelManagerName: opp.channelManagerName,
        saOwnerId: owner.id, saOwnerName: opp.ownerName ?? owner.name,
        salesOwnerId: owner.id, salesOwnerName: opp.ownerName ?? owner.name,
        stage: opp.stage, reportedAt: ago(25 - index), releaseAt: locked ? later(365) : later(5 + index),
        lockedPermanently: locked, amountRange: opp.amountRange, firstContactDate: ago(28 - index),
        requirementDescription: opp.requirement,
        contact: { create: { level: index % 3 === 0 ? '决策层' : '执行层', department: opp.department, contactTypes: ['wechat'] } },
      },
    })
  }

  console.log(`✅ 种子数据写入完成（新增 4 个账号，${mockOpportunities.length} 个品牌商机）`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
