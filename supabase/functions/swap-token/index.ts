import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
}

// Helper to resolve and import cryptographic keys supporting symmetric (HS256) and asymmetric (ES256/RS256 JWKS) keys
async function importJwtKey(rawKey: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const cleanKey = rawKey.trim()
  
  if (cleanKey.startsWith('{')) {
    try {
      const jwks = JSON.parse(cleanKey)
      const keys = jwks.keys || [jwks]
      const jwk = keys[0]
      
      if (jwk.kty === 'EC') {
        return await crypto.subtle.importKey(
          "jwk",
          jwk,
          {
            name: "ECDSA",
            namedCurve: jwk.crv || "P-256"
          },
          false,
          usages
        )
      }
      
      if (jwk.kty === 'RSA') {
        return await crypto.subtle.importKey(
          "jwk",
          jwk,
          {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256"
          },
          false,
          usages
        )
      }
      
      if (jwk.kty === 'oct') {
        return await crypto.subtle.importKey(
          "jwk",
          jwk,
          {
            name: "HMAC",
            hash: "SHA-256"
          },
          false,
          usages
        )
      }
    } catch (err) {
      console.error('Failed to parse JWKS JSON:', err.message)
    }
  }

  const encoder = new TextEncoder()
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(cleanKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  )
}

serve(async (req) => {
  // Pass CORS preflight checks
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  try {
    const PROJECT_1_JWT_SECRET = Deno.env.get('PROJECT_1_JWT_SECRET') || Deno.env.get('Central Auth Project JWT')
    const PROJECT_2_JWT_SECRET = Deno.env.get('PROJECT_2_JWT_SECRET') || Deno.env.get('Multichat JWT') || Deno.env.get('YT Timestamp JWT')
    const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')

    if (!PROJECT_1_JWT_SECRET || !PROJECT_2_JWT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: JWT secrets are missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Helper to get service token for database REST API calls
    const getP2ServiceToken = async () => {
      return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    }

    // -------------------------------------------------------------
    // PATH 1: USER DELETION WEBHOOK HANDLER
    // -------------------------------------------------------------
    if (url.pathname.endsWith('/delete-user')) {
      const webhookSecret = req.headers.get('x-webhook-secret')
      console.log(`[DELETE] Received secret: "${webhookSecret}", Expected secret: "${WEBHOOK_SECRET}"`)

      if (WEBHOOK_SECRET && webhookSecret !== WEBHOOK_SECRET) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized webhook request' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      const deletedUser = body.old_record || body.record
      if (!deletedUser || !deletedUser.id) {
        return new Response(
          JSON.stringify({ error: 'Missing user ID in webhook payload' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const userUuid = deletedUser.id
      console.log(`Received deletion request for user ${userUuid}`)

      const serviceToken = await getP2ServiceToken()
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const p2Url = `${supabaseUrl}/rest/v1/users_data?id=eq.${userUuid}`

      const syncRes = await fetch(p2Url, {
        method: 'DELETE',
        headers: {
          'apikey': serviceToken,
          'Authorization': `Bearer ${serviceToken}`
        }
      })

      if (!syncRes.ok) {
        const syncText = await syncRes.text()
        console.error(`Failed to delete user ${userUuid} from local database:`, syncRes.status, syncText)
        return new Response(
          JSON.stringify({ error: 'Failed to delete user from local database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Successfully deleted user ${userUuid} from users_data table`)
      return new Response(
        JSON.stringify({ message: 'User successfully deleted' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // -------------------------------------------------------------
    // PATH 3: USER UPDATE WEBHOOK HANDLER (Upserts both users_data & profiles)
    // -------------------------------------------------------------
    if (url.pathname.endsWith('/update-user')) {
      const webhookSecret = req.headers.get('x-webhook-secret')
      console.log(`[UPDATE] Received secret: "${webhookSecret}", Expected secret: "${WEBHOOK_SECRET}"`)

      if (WEBHOOK_SECRET && webhookSecret !== WEBHOOK_SECRET) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized webhook request' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      const updatedUser = body.record
      if (!updatedUser || !updatedUser.id) {
        return new Response(
          JSON.stringify({ error: 'Missing user ID in webhook payload' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const userUuid = updatedUser.id
      const newUsername = updatedUser.username || ''
      const newCountry = updatedUser.country || ''
      const email = updatedUser.email || ''
      const isBanned = updatedUser.is_banned === true

      console.log(`Received update request for user ${userUuid}: name="${newUsername}", email="${email}", country="${newCountry}", is_banned=${isBanned}`)

      const serviceToken = await getP2ServiceToken()
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!

      // 1. Upsert users_data table (creating the user if they do not exist)
      const syncRes1 = await fetch(`${supabaseUrl}/rest/v1/users_data`, {
        method: 'POST',
        headers: {
          'apikey': serviceToken,
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: userUuid,
          email: email,
          name: newUsername,
          country: newCountry,
          is_banned: isBanned
        })
      })

      if (!syncRes1.ok) {
        const syncText = await syncRes1.text()
        console.error(`Failed to update users_data for user ${userUuid}:`, syncRes1.status, syncText)
        return new Response(
          JSON.stringify({ error: 'Failed to update users_data in local database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 2. Upsert profiles table (creating the profile if it does not exist)
      const syncRes2 = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          'apikey': serviceToken,
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: userUuid,
          email: email,
          role: 'creator'
        })
      })

      if (!syncRes2.ok) {
        const syncText = await syncRes2.text()
        console.error(`Failed to update profile slot for user ${userUuid}:`, syncRes2.status, syncText)
      }

      console.log(`Successfully synced user ${userUuid} in local database`)
      return new Response(
        JSON.stringify({ message: 'User successfully updated/inserted' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // -------------------------------------------------------------
    // PATH 2: TOKEN SWAP HANDLER
    // -------------------------------------------------------------
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or malformed Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const token1 = authHeader.split(' ')[1]

    // 1. Verify Project 1 JWT token using imported key (supports HS256 & ES256)
    const key1 = await importJwtKey(PROJECT_1_JWT_SECRET, ["verify"])

    let decoded;
    try {
      decoded = await verify(token1, key1)
    } catch (tokenErr) {
      console.error('Project 1 Token verification failed:', tokenErr.message)
      return new Response(
        JSON.stringify({ error: `Invalid or expired Project 1 token: ${tokenErr.message}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userUuid = decoded.sub
    if (!userUuid) {
      return new Response(
        JSON.stringify({ error: 'User UUID not found in token claims' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. CHECK BAN STATUS BEFORE ALLOWING TOKEN SWAP
    const serviceToken = await getP2ServiceToken()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    
    try {
      const checkBanRes = await fetch(`${supabaseUrl}/rest/v1/users_data?id=eq.${userUuid}&select=is_banned`, {
        method: 'GET',
        headers: {
          'apikey': serviceToken,
          'Authorization': `Bearer ${serviceToken}`
        }
      })
      if (checkBanRes.ok) {
        const checkBanData = await checkBanRes.json()
        if (checkBanData && checkBanData.length > 0 && checkBanData[0].is_banned === true) {
          console.warn(`Blocked token swap for banned user: ${userUuid}`)
          return new Response(
            JSON.stringify({ error: 'This user account has been banned from the system.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } catch (banCheckErr) {
      console.error('Failed to verify user ban status:', banCheckErr.message)
    }

    // 3. Re-sign token for local database using Project 2's secret (HS256)
    const key2 = await importJwtKey(PROJECT_2_JWT_SECRET, ["sign"])

    // Replicate claims, updating issuer and times
    const payload = {
      ...decoded,
      iss: `${supabaseUrl}/auth/v1`,
      iat: getNumericDate(0),
      exp: getNumericDate(3600) // Valid for 1 hour
    }

    const token2 = await create({ alg: "HS256", typ: "JWT" }, payload, key2)

    // 4. Parallelize database synchronization
    const username = decoded.user_metadata?.username || decoded.user_metadata?.full_name || decoded.email?.split('@')[0] || 'user'
    const country = decoded.user_metadata?.country || ''

    const p1AnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNjMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0'

    const syncPromises = []

    // Sync to Project 1 (Central Auth)
    syncPromises.push(
      fetch('https://bwwdzkhtnaepamsfivds.supabase.co/rest/v1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': p1AnonKey,
          'Authorization': `Bearer ${token1}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: userUuid,
          email: decoded.email || '',
          username: username,
          country: country
        })
      }).then(async (res) => {
        if (!res.ok) console.error('P1 Sync failed:', res.status, await res.text());
      }).catch(err => console.error('P1 Sync exception:', err.message))
    )

    // Sync to local database (users_data)
    syncPromises.push(
      fetch(`${supabaseUrl}/rest/v1/users_data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceToken,
          'Authorization': `Bearer ${serviceToken}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: userUuid,
          email: decoded.email || '',
          name: username,
          country: country
        })
      }).then(async (res) => {
        if (!res.ok) console.error('Local users_data Sync failed:', res.status, await res.text());
      }).catch(err => console.error('Local users_data Sync exception:', err.message))
    )

    // Sync to local database (profiles)
    syncPromises.push(
      fetch(`${supabaseUrl}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceToken,
          'Authorization': `Bearer ${serviceToken}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: userUuid,
          email: decoded.email || '',
          role: 'creator'
        })
      }).then(async (res) => {
        if (!res.ok) console.error('Local profiles Sync failed:', res.status, await res.text());
      }).catch(err => console.error('Local profiles Sync exception:', err.message))
    )

    // Await database updates
    await Promise.all(syncPromises)

    // Send back swapped token
    return new Response(
      JSON.stringify({
        access_token: token2,
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: userUuid,
          email: decoded.email || '',
          user_metadata: decoded.user_metadata || {}
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Request handler execution failed:', err.message)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
