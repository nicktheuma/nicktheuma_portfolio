import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 0) continue
    const key = trimmed.slice(0, i).trim()
    const value = trimmed.slice(i + 1).trim()
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? ''
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? ''
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? ''
const bucket = process.env.R2_BUCKET_NAME?.trim() ?? ''

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`

console.log('endpoint:', endpoint)
console.log('bucket:', bucket)
console.log('accountIdLen:', accountId.length)
console.log('accessKeyLen:', accessKeyId.length)
console.log('secretLen:', secretAccessKey.length)

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
})

try {
  const res = await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  console.log('HeadBucket OK', res.$metadata)
} catch (error) {
  console.log('HeadBucket FAILED')
  if (error && typeof error === 'object') {
    console.log('name:', error.name)
    console.log('message:', error.message)
    console.log('metadata:', error.$metadata)
    console.log('code:', error.Code)
  } else {
    console.log(error)
  }
  process.exit(1)
}
