import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const NAVER_CLIENT_ID = Deno.env.get('NAVER_CLIENT_ID')!
const NAVER_CLIENT_SECRET = Deno.env.get('NAVER_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, state, redirect_uri } = await req.json()

    if (!code) {
      return new Response(JSON.stringify({ error: 'code is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1) 네이버 access_token 교환
    const tokenRes = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: NAVER_CLIENT_ID,
        client_secret: NAVER_CLIENT_SECRET,
        code,
        state,
      }),
    })

    const tokenData = await tokenRes.json()
    if (tokenData.error) {
      return new Response(JSON.stringify({ error: tokenData.error_description }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2) 네이버 프로필 조회
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profileData = await profileRes.json()
    const profile = profileData.response

    const naverId = String(profile.id)
    const nickname = profile.nickname ?? profile.name ?? '사용자'
    const avatarUrl = profile.profile_image ?? null

    // 3) Supabase admin으로 사용자 생성/로그인
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const naverEmail = `naver_${naverId}@naver.local`
    const userMeta = { naver_id: naverId, full_name: nickname, avatar_url: avatarUrl, provider: 'naver' }

    // 기존 사용자 찾기
    const { data: { users } } = await supabase.auth.admin.listUsers()
    let user = users?.find((u: { email?: string }) => u.email === naverEmail)

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: naverEmail,
        email_confirm: true,
        user_metadata: userMeta,
      })
      if (error) throw error
      user = data.user
    } else {
      await supabase.auth.admin.updateUserById(user.id, { user_metadata: userMeta })
    }

    // 4) 세션 생성 (magic link 토큰 발급)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: naverEmail,
    })
    if (linkError) throw linkError

    const linkUrl = new URL(linkData.properties.action_link)
    const token = linkUrl.searchParams.get('token')
    const type = linkUrl.searchParams.get('type') ?? 'magiclink'

    return new Response(
      JSON.stringify({ token, type, nickname, avatar_url: avatarUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
