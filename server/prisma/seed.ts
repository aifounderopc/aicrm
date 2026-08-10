// 数据库种子：初始管理员 + 子管理员 + 示例销售/渠道账号（替代前端 seed.ts）
// 运行：npm run seed
import { OpportunityStage, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const hash = (p: string) => bcrypt.hash(p, 12)

async function main() {
  const users = [
    { id: 'admin1', name: '张管理', role: 'admin', email: 'admin@joymarketing.com', password: 'Admin@Joy2024' },
    { id: 'cadmin1', name: '李渠道', role: 'channel_admin', email: 'channeladmin@joymarketing.com', password: 'Channel@Joy2024' },
    { id: 'sadmin1', name: '王直客', role: 'sales_admin', email: 'salesadmin@joymarketing.com', password: 'Sales@Joy2024' },
    { id: 'u_yd', name: '严頔', role: 'sales', email: 'yandi@joymarketing.com', password: 'Joy@Sales2024' },
  ] as const

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.id, name: u.name, email: u.email, role: u.role,
        passwordHash: await hash(u.password), mustChangePwd: true,
      },
    })
  }

  // 预发/演示环境的 Top 品牌商机：固定 ID + upsert，可安全重复执行。
  const ago = (days: number) => new Date(Date.now() - days * 86400_000)
  const later = (days: number) => new Date(Date.now() + days * 86400_000)
  const mockOpportunities: Array<{
    id: string; customerName: string; companyName: string; industry: string
    stage: OpportunityStage; amountRange: string; department: string; requirement: string
  }> = [
    { id: 'mock_opp_01', customerName: '荣耀', companyName: '荣耀终端有限公司', industry: '3C / 数码', stage: 'signed', amountRange: 'above50', department: 'CI+EC', requirement: '荣耀品牌内容与电商运营合作，已完成年度框架签署，持续推进交付。' },
    { id: 'mock_opp_02', customerName: '博士西门子', companyName: '博西家用电器有限公司', industry: '家电 / 智能硬件', stage: 'signing', amountRange: '20to50', department: 'CI', requirement: '博士西门子品牌形象升级与内容制作项目，合同条款已对齐，等待客户法务审核。' },
    { id: 'mock_opp_03', customerName: '脉动', companyName: '达能（中国）食品饮料有限公司', industry: '食品 / 饮料', stage: 'reporting', amountRange: '10to20', department: 'EC', requirement: '脉动电商运营项目初步接触，客户对京东电商代运营方案有兴趣。' },
    { id: 'mock_opp_04', customerName: '疯狂小狗', companyName: '疯狂小狗宠物用品有限公司', industry: '宠物', stage: 'reporting', amountRange: '5to10', department: '营销', requirement: '宠物品牌内容与社交媒体推广合作，客户已明确预算范围。' },
    { id: 'mock_opp_05', customerName: '海尔', companyName: '海尔集团公司', industry: '家电 / 智能硬件', stage: 'delivery', amountRange: 'above50', department: 'EC', requirement: '海尔全品类店铺运营与营销推广项目，当前已进入交付执行阶段。' },
    { id: 'mock_opp_06', customerName: '安利', companyName: '安利（中国）日用品有限公司', industry: '食品 / 饮料', stage: 'reporting', amountRange: '10to20', department: '用户体验', requirement: '安利用户体验优化项目，聚焦线上触点与内容运营，方案制作中。' },
    { id: 'mock_opp_07', customerName: '雀巢', companyName: '雀巢（中国）有限公司', industry: '食品 / 饮料', stage: 'signing', amountRange: '20to50', department: 'EC', requirement: '雀巢天猫与京东双平台运营合作，合同已进入法务审核阶段。' },
    { id: 'mock_opp_08', customerName: '宝洁（衣清）', companyName: '宝洁（中国）营销有限公司', industry: '家居 / 家装', stage: 'reporting', amountRange: '10to20', department: '衣物清洁', requirement: '宝洁衣清系列电商精细化运营合作，目标为提升转化率与会员复购。' },
    { id: 'mock_opp_09', customerName: '宝洁（SKII）', companyName: '宝洁（中国）营销有限公司', industry: '美妆 / 护肤', stage: 'signed', amountRange: 'above50', department: '高端护肤', requirement: 'SKII 高端护肤品牌数字营销合作，已完成合同签署并进入执行。' },
    { id: 'mock_opp_10', customerName: '三星（手机）', companyName: '三星（中国）投资有限公司', industry: '3C / 数码', stage: 'signing', amountRange: 'above50', department: '手机事业部', requirement: '三星手机新品上市内容营销与电商运营项目，进入合同确认。' },
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
  ]

  for (const [index, opp] of mockOpportunities.entries()) {
    const locked = opp.stage === 'signed' || opp.stage === 'delivery'
    await prisma.opportunity.upsert({
      where: { id: opp.id },
      update: {
        customerName: opp.customerName, customerNameNorm: opp.customerName.toLowerCase(),
        companyName: opp.companyName, industry: opp.industry, stage: opp.stage,
        amountRange: opp.amountRange, requirementDescription: opp.requirement,
        lockedPermanently: locked, releaseAt: locked ? later(365) : later(5 + index),
      },
      create: {
        id: opp.id, customerName: opp.customerName, customerNameNorm: opp.customerName.toLowerCase(),
        companyName: opp.companyName, industry: opp.industry, source: 'direct',
        saOwnerId: 'u_yd', saOwnerName: '严頤', salesOwner: { connect: { id: 'u_yd' } }, salesOwnerName: '严頤',
        stage: opp.stage, reportedAt: ago(25 - index), releaseAt: locked ? later(365) : later(5 + index),
        lockedPermanently: locked, amountRange: opp.amountRange, firstContactDate: ago(28 - index),
        requirementDescription: opp.requirement,
        contact: { create: { level: index % 3 === 0 ? '决策层' : '执行层', department: opp.department, contactTypes: ['wechat'] } },
      },
    })
  }

  console.log(`✅ 种子数据写入完成（${mockOpportunities.length} 个 Top 品牌商机）`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
