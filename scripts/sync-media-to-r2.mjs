import { readdir, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'

const projectRoot = process.cwd()
const localMediaRoot = path.join(projectRoot, 'public', 'media')

const requiredEnvVars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name] || !process.env[name]?.trim())

if (missingEnvVars.length > 0) {
  console.error(`Missing required env vars: ${missingEnvVars.join(', ')}`)
  process.exit(1)
}

const accountId = process.env.R2_ACCOUNT_ID.trim()
const accessKeyId = process.env.R2_ACCESS_KEY_ID.trim()
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY.trim()
const bucket = process.env.R2_BUCKET_NAME.trim()
const bucketPrefix = (process.env.R2_BUCKET_PREFIX ?? 'media').trim().replace(/^\/+|\/+$/g, '')
const shouldDeleteMissing = (process.env.R2_DELETE_MISSING ?? 'false').trim().toLowerCase() === 'true'
const testFileInput = (process.env.R2_TEST_FILE ?? '').trim()
const shouldSyncOnlyFirstFile = (process.env.R2_TEST_FIRST ?? 'false').trim().toLowerCase() === 'true'
const progressEvery = Math.max(1, Number.parseInt((process.env.R2_PROGRESS_EVERY ?? '25').trim(), 10) || 25)
const continueOnError = (process.env.R2_CONTINUE_ON_ERROR ?? 'false').trim().toLowerCase() === 'true'
const retryFailedOnly = (process.env.R2_RETRY_FAILED ?? 'false').trim().toLowerCase() === 'true'
const failedListPath = (process.env.R2_FAILED_LIST ?? path.join(projectRoot, '.r2-failed.json')).trim()

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
})

function toPosixPath(value) {
  return value.replaceAll(path.sep, '/')
}

function toObjectKey(relativePath) {
  const normalizedRelativePath = toPosixPath(relativePath).replace(/^\/+/, '')
  return bucketPrefix ? `${bucketPrefix}/${normalizedRelativePath}` : normalizedRelativePath
}

function toRelativePath(localFilePath) {
  return toPosixPath(path.relative(localMediaRoot, localFilePath)).replace(/^\/+/, '')
}

function detectContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.avif':
      return 'image/avif'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.m4v':
      return 'video/x-m4v'
    case '.glb':
      return 'model/gltf-binary'
    case '.gltf':
      return 'model/gltf+json'
    case '.obj':
      return 'model/obj'
    case '.stl':
      return 'model/stl'
    case '.fbx':
      return 'application/octet-stream'
    default:
      return 'application/octet-stream'
  }
}

async function listFilesRecursively(folderPath) {
  const entries = await readdir(folderPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(fullPath)))
      continue
    }

    if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

async function remoteObjectMatches(localKey, localStats) {
  try {
    const response = await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: localKey,
      }),
    )

    const remoteSize = response.ContentLength ?? -1
    const remoteMtime = response.Metadata?.mtime ?? ''

    return remoteSize === localStats.size && remoteMtime === String(Math.trunc(localStats.mtimeMs))
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      return false
    }

    if (error && typeof error === 'object' && '$metadata' in error) {
      const metadata = error.$metadata
      if (metadata && typeof metadata === 'object' && 'httpStatusCode' in metadata && metadata.httpStatusCode === 404) {
        return false
      }
    }

    throw error
  }
}

async function uploadFile(localFilePath, objectKey, fileStats) {
  const multipartThreshold = 100 * 1024 * 1024 // 100MB
  const partSize = 10 * 1024 * 1024 // 10MB chunks
  const progressLabel = arguments.length > 3 ? arguments[3] : ''

  const totalBytes = fileStats.size
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1)
  const logEveryBytes = 5 * 1024 * 1024
  let nextLogBytes = logEveryBytes
  let lastLogTime = 0

  const logProgress = (uploadedBytes) => {
    const now = Date.now()
    if (uploadedBytes < nextLogBytes && now - lastLogTime < 1000) {
      return
    }
    while (uploadedBytes >= nextLogBytes) {
      nextLogBytes += logEveryBytes
    }
    lastLogTime = now
    const uploadedMB = (uploadedBytes / (1024 * 1024)).toFixed(1)
    const label = progressLabel ? `${progressLabel} ` : ''
    console.log(`${label}Uploading: ${objectKey} (${uploadedMB}/${totalMB} MB)`) // progress update
  }

  if (fileStats.size < multipartThreshold) {
    const readStream = createReadStream(localFilePath)
    const passThrough = new PassThrough()
    let uploadedBytes = 0

    readStream.on('data', (chunk) => {
      uploadedBytes += chunk.length
      logProgress(uploadedBytes)
    })
    readStream.on('error', (error) => passThrough.destroy(error))
    readStream.pipe(passThrough)

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: passThrough,
        ContentLength: fileStats.size,
        ContentType: detectContentType(localFilePath),
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: {
          mtime: String(Math.trunc(fileStats.mtimeMs)),
        },
      }),
    )
    logProgress(totalBytes)
    return
  }

  // Use multipart upload for large files with streaming
  const createResponse = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: detectContentType(localFilePath),
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        mtime: String(Math.trunc(fileStats.mtimeMs)),
      },
    }),
  )

  const uploadId = createResponse.UploadId
  const parts = []
  const numParts = Math.ceil(fileStats.size / partSize)

  let uploadedBytes = 0

  for (let partNumber = 1; partNumber <= numParts; partNumber++) {
    const start = (partNumber - 1) * partSize
    const end = Math.min(start + partSize, fileStats.size)

    const stream = createReadStream(localFilePath, { start, end: end - 1 })
    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    const partBuffer = Buffer.concat(chunks)

    const uploadPartResponse = await s3.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: partBuffer,
        ContentLength: partBuffer.length,
      }),
    )

    parts.push({
      PartNumber: partNumber,
      ETag: uploadPartResponse.ETag,
    })

    uploadedBytes = end
    logProgress(uploadedBytes)
  }

  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: objectKey,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  )
  logProgress(totalBytes)
}

async function listRemoteKeys(prefix) {
  const remoteKeys = []
  let continuationToken = undefined

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )

    for (const object of response.Contents ?? []) {
      if (object.Key) {
        remoteKeys.push(object.Key)
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  return remoteKeys
}

async function deleteRemoteKeys(keys) {
  if (keys.length === 0) {
    return
  }

  const chunkSize = 1000
  for (let index = 0; index < keys.length; index += chunkSize) {
    const chunk = keys.slice(index, index + chunkSize)
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    )
  }
}

async function run() {
  console.log(`Syncing media from ${localMediaRoot} to r2://${bucket}/${bucketPrefix || ''}`)

  let localFiles = await listFilesRecursively(localMediaRoot)
  localFiles.sort((left, right) => left.localeCompare(right))

  const isTestMode = shouldSyncOnlyFirstFile || testFileInput.length > 0

  if (testFileInput.length > 0) {
    const normalizedRequestedPath = toPosixPath(testFileInput).replace(/^\/+/, '').replace(/^media\//, '')
    const matchedFile = localFiles.find((filePath) => {
      return toRelativePath(filePath) === normalizedRequestedPath
    })

    if (!matchedFile) {
      throw new Error(`R2_TEST_FILE did not match a file under public/media: ${testFileInput}`)
    }

    localFiles = [matchedFile]
    console.log(`Test mode: syncing only requested file (${normalizedRequestedPath})`)
  } else if (shouldSyncOnlyFirstFile) {
    localFiles = localFiles.slice(0, 1)
    console.log('Test mode: syncing only first media file.')
  }

  if (retryFailedOnly) {
    let failedList
    try {
      failedList = JSON.parse(await (await import('node:fs/promises')).readFile(failedListPath, 'utf8'))
    } catch (error) {
      throw new Error(`Failed to read failed list at ${failedListPath}. Set R2_FAILED_LIST or disable R2_RETRY_FAILED.`)
    }

    const failedSet = new Set(
      Array.isArray(failedList)
        ? failedList.filter((value) => typeof value === 'string')
        : [],
    )

    if (failedSet.size === 0) {
      console.log('Retry mode: failed list is empty. Nothing to sync.')
      return
    }

    localFiles = localFiles.filter((filePath) => failedSet.has(toRelativePath(filePath)))
    console.log(`Retry mode: syncing ${localFiles.length} failed file(s) from ${failedSet.size} entries.`)
  }

  if (localFiles.length === 0) {
    console.log('No media files found to sync.')
    return
  }

  console.log(`Preparing to process ${localFiles.length} file(s)...`)

  const localKeySet = new Set()

  let uploadedCount = 0
  let skippedCount = 0
  let failedCount = 0
  const failedFiles = []
  const failedRelativePaths = []

  for (const [index, localFilePath] of localFiles.entries()) {
    const relativePath = toRelativePath(localFilePath)
    const objectKey = toObjectKey(relativePath)
    const fileStats = await stat(localFilePath)
    localKeySet.add(objectKey)

    const currentNumber = index + 1
    const shouldPrintProgress =
      localFiles.length <= 200 ||
      currentNumber === 1 ||
      currentNumber === localFiles.length ||
      currentNumber % progressEvery === 0

    let isUnchanged
    try {
      isUnchanged = await remoteObjectMatches(objectKey, fileStats)
    } catch (error) {
      console.error(`[${currentNumber}/${localFiles.length}] Failed while checking remote object: ${objectKey}`)
      console.error(error.message || error)
      if (continueOnError) {
        failedCount += 1
        failedFiles.push({ file: objectKey, reason: 'check_failed' })
        failedRelativePaths.push(relativePath)
        continue
      }
      throw error
    }

    if (isUnchanged) {
      skippedCount += 1
      if (shouldPrintProgress) {
        console.log(`[${currentNumber}/${localFiles.length}] Skipped (unchanged): ${objectKey}`)
      }
      continue
    }

    try {
      await uploadFile(localFilePath, objectKey, fileStats, `[${currentNumber}/${localFiles.length}]`)
    } catch (error) {
      console.error(`[${currentNumber}/${localFiles.length}] Failed upload: ${objectKey}`)
      console.error(error.message || error)
      if (continueOnError) {
        failedCount += 1
        failedFiles.push({ file: objectKey, reason: 'upload_failed', error: error.message || String(error) })
        failedRelativePaths.push(relativePath)
        continue
      }
      throw error
    }

    uploadedCount += 1
    if (shouldPrintProgress) {
      console.log(`[${currentNumber}/${localFiles.length}] Uploaded: ${objectKey}`)
    }
  }

  let deletedCount = 0
  if (shouldDeleteMissing && !isTestMode) {
    const prefix = bucketPrefix ? `${bucketPrefix}/` : ''
    const remoteKeys = await listRemoteKeys(prefix)
    const keysToDelete = remoteKeys.filter((key) => !localKeySet.has(key))

    if (keysToDelete.length > 0) {
      await deleteRemoteKeys(keysToDelete)
      deletedCount = keysToDelete.length
      console.log(`Deleted ${deletedCount} remote objects not found locally.`)
    }
  } else if (shouldDeleteMissing && isTestMode) {
    console.log('R2_DELETE_MISSING is ignored in test mode.')
  }

  console.log(`Done. Uploaded: ${uploadedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}, Deleted: ${deletedCount}`)

  if (failedFiles.length > 0) {
    try {
      const uniqueFailed = Array.from(new Set(failedRelativePaths)).sort()
      await (await import('node:fs/promises')).writeFile(failedListPath, JSON.stringify(uniqueFailed, null, 2))
      console.log(`Wrote failed list to ${failedListPath}`)
    } catch (error) {
      console.error(`Failed to write failed list to ${failedListPath}`)
      console.error(error.message || error)
    }
    console.log('\nFailed files:')
    for (const { file, reason, error } of failedFiles) {
      console.log(`  - ${file} (${reason})${error ? ': ' + error : ''}`)
    }
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
