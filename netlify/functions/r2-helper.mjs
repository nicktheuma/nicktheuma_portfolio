import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { sdkStreamMixin } from '@aws-sdk/util-stream-node'

function createR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured in environment')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

async function readAdminOverridesFromR2() {
  const bucket = process.env.R2_BUCKET_NAME?.trim()
  const prefix = (process.env.R2_BUCKET_PREFIX ?? 'media').trim().replace(/^\/+|\/+$/g, '')

  if (!bucket) {
    throw new Error('R2_BUCKET_NAME is required')
  }

  const s3 = createR2Client()
  const key = `${prefix}/admin-overrides.json`

  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    )

    const body = await response.Body?.transformToString?.()
    if (!body) {
      return {}
    }

    const parsed = JSON.parse(body)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchKey') {
      return {}
    }

    throw error
  }
}

async function writeAdminOverridesToR2(overrides) {
  const bucket = process.env.R2_BUCKET_NAME?.trim()
  const prefix = (process.env.R2_BUCKET_PREFIX ?? 'media').trim().replace(/^\/+|\/+$/g, '')

  if (!bucket) {
    throw new Error('R2_BUCKET_NAME is required')
  }

  const s3 = createR2Client()
  const key = `${prefix}/admin-overrides.json`
  const body = JSON.stringify(overrides, null, 2)

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'no-cache, no-store, must-revalidate',
    }),
  )
}

export { readAdminOverridesFromR2, writeAdminOverridesToR2 }
