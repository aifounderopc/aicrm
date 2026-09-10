import pg from 'pg'
import mysql from 'mysql2/promise'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`缺少 ${name}`)
  return value
}

const sourceUrl = requiredEnv('LEGACY_DATABASE_URL')
const targetUrl = requiredEnv('DATABASE_URL')
if (!targetUrl.startsWith('mysql://')) throw new Error('目标数据库必须是 MySQL')

const tables = [
  'tenants',
  'channels',
  'users',
  'opportunities',
  'opportunity_contacts',
  'evidence_files',
  'progress_reports',
  'renewal_requests',
  'notifications',
  'operation_logs',
  'integration_connections',
  'feishu_messages',
  'sales_signals',
  'opportunity_inspection_bindings',
  'agent_configurations',
  'agent_model_configurations',
] as const

const jsonColumns = new Set([
  'opportunities.product_interests',
  'opportunity_contacts.contact_types',
  'sales_signals.extracted_data',
])

function targetValue(table: string, column: string, value: unknown) {
  if (value === null || value === undefined) return null
  if (jsonColumns.has(`${table}.${column}`)) return JSON.stringify(value)
  return value
}

async function main() {
  const source = new pg.Client({ connectionString: sourceUrl })
  const target = await mysql.createConnection(targetUrl)
  await source.connect()
  try {
    const [[existing]] = await target.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS total FROM tenants')
    if (Number(existing.total) > 0) {
      console.log('[db-migrate] MySQL 已有租户数据，跳过 PostgreSQL 导入')
      return
    }

    await target.query('SET FOREIGN_KEY_CHECKS = 0')
    await target.beginTransaction()
    const copied: Record<string, number> = {}
    try {
      for (const table of tables) {
        const result = await source.query(`SELECT * FROM "${table}"`)
        copied[table] = result.rows.length
        if (!result.rows.length) continue
        const columns = result.fields.map(field => field.name)
        for (let offset = 0; offset < result.rows.length; offset += 500) {
          const values = result.rows.slice(offset, offset + 500).map(row =>
            columns.map(column => targetValue(table, column, row[column])),
          )
          await target.query('INSERT INTO ?? (??) VALUES ?', [table, columns, values])
        }
      }
      await target.commit()
      console.log('[db-migrate] PostgreSQL → MySQL 数据迁移完成', copied)
    } catch (error) {
      await target.rollback()
      throw error
    } finally {
      await target.query('SET FOREIGN_KEY_CHECKS = 1')
    }
  } finally {
    await Promise.allSettled([source.end(), target.end()])
  }
}

main().catch(error => {
  console.error('[db-migrate] 数据迁移失败', error)
  process.exit(1)
})
