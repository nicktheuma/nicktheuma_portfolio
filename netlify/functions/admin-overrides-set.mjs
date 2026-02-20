import { writeAdminOverridesToR2 } from './r2-helper.mjs'

export default async (req, context) => {
  console.log('[admin-overrides-set] Request received:', req.method)
  console.log('[admin-overrides-set] R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME ? 'SET' : 'MISSING')
  console.log('[admin-overrides-set] R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? 'SET' : 'MISSING')
  console.log('[admin-overrides-set] R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? 'SET' : 'MISSING')
  console.log('[admin-overrides-set] R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? 'SET' : 'MISSING')

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let overrides
    try {
      overrides = await req.json()
      if (!overrides || typeof overrides !== 'object') {
        return new Response(JSON.stringify({ error: 'Request body must be a JSON object' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await writeAdminOverridesToR2(overrides)

    return new Response(JSON.stringify({ success: true, message: 'Admin settings saved' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Error saving admin overrides:', errorMsg)
    return new Response(JSON.stringify({ error: 'Failed to save admin settings', details: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
