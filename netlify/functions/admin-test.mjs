export default async (req, context) => {
  const checks = {
    timestamp: new Date().toISOString(),
    r2AccountId: !!process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: !!process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: !!process.env.R2_BUCKET_NAME,
    r2BucketPrefix: process.env.R2_BUCKET_PREFIX ?? 'media',
  }

  if (!Object.values(checks).slice(1, 5).every(Boolean)) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'R2 credentials not fully configured',
        checks,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  return new Response(JSON.stringify({ status: 'ok', message: 'R2 credentials OK', checks }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
