import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * 비밀 키 유출 방지: VITE_ 로 시작하는 값은 빌드 결과(브라우저)에 그대로 들어가요.
 * 이름이나 값이 비밀 키처럼 보이면 빌드를 멈춰요.
 */
function secretGuard(mode: string): Plugin {
  return {
    name: 'secret-guard',
    configResolved() {
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      for (const [k, v] of Object.entries(env)) {
        if (/SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|API_KEY_SECRET/i.test(k)) throw new Error(`[secret-guard] ${k} 는 VITE_ 로 노출하면 안 돼요. 서버(Edge Function) 비밀값으로 옮기세요.`)
        // Supabase JWT 안의 role 확인: service_role 키면 중단
        const parts = v.split('.')
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { role?: string }
            if (payload.role === 'service_role') throw new Error(`[secret-guard] ${k} 에 service_role 키가 들어 있어요! anon 키만 넣으세요.`)
          } catch (e) { if ((e as Error).message.startsWith('[secret-guard]')) throw e }
        }
        if (/^sb_secret_/.test(v)) throw new Error(`[secret-guard] ${k} 에 Supabase secret 키가 들어 있어요! publishable(anon) 키만 넣으세요.`)
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [secretGuard(mode), react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    ...(mode === 'single' ? { outDir: 'dist-single' } : {}),
    sourcemap: false, // 배포본에 원본 코드 지도(소스맵) 미포함
  },
}))
