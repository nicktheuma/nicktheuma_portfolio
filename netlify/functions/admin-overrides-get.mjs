import { readAdminOverridesFromR2 } from './r2-helper.mjs'

export default async (req, context) => {
  console.log('[admin-overrides-get] Request received:', req.method)
  console.log('[admin-overrides-get] R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME ? 'SET' : 'MISSING')
  console.log('[admin-overrides-get] R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? 'SET' : 'MISSING')
  console.log('[admin-overrides-get] R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? 'SET' : 'MISSING')
  console.log('[admin-overrides-get] R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? 'SET' : 'MISSING')

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const overrides = await readAdminOverridesFromR2()
    return new Response(JSON.stringify(overrides), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Error reading admin overrides:', errorMsg)
    return new Response(JSON.stringify({ error: 'Failed to load admin settings', details: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
