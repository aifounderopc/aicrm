// 数据库种子：初始管理员 + 子管理员 + 示例销售/渠道账号（替代前端 seed.ts）
// 运行：npm run seed
import { PrismaClient } from '@prisma/client'
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
  console.log('✅ 种子数据写入完成（初始密码见脚本，首次登录需改密）')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
