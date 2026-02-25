export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getAvailableCoraAccounts } from '@/lib/cora'

/**
 * GET /api/cora/accounts
 * Retorna as contas Cora disponíveis para geração de boletos
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 🔍 Debug: Verificar variáveis de ambiente
    console.log('[CORA_ACCOUNTS] 🔍 Verificando variáveis de ambiente...')
    console.log('[CORA_ACCOUNTS] CORA_CLIENT_ID:', process.env.CORA_CLIENT_ID ? '✅ Configurado' : '❌ Não configurado')
    console.log('[CORA_ACCOUNTS] CORA_CERTIFICATE_BASE64:', process.env.CORA_CERTIFICATE_BASE64 ? '✅ Configurado' : '❌ Não configurado')
    console.log('[CORA_ACCOUNTS] CORA_GENUINO_CLIENT_ID:', process.env.CORA_GENUINO_CLIENT_ID ? '✅ ' + process.env.CORA_GENUINO_CLIENT_ID : '❌ Não configurado')
    console.log('[CORA_ACCOUNTS] CORA_GENUINO_CERTIFICATE_BASE64:', process.env.CORA_GENUINO_CERTIFICATE_BASE64 ? '✅ Configurado (' + process.env.CORA_GENUINO_CERTIFICATE_BASE64.length + ' chars)' : '❌ Não configurado')
    console.log('[CORA_ACCOUNTS] CORA_GENUINO_PRIVATE_KEY_BASE64:', process.env.CORA_GENUINO_PRIVATE_KEY_BASE64 ? '✅ Configurado' : '❌ Não configurado')

    const accounts = getAvailableCoraAccounts()
    
    console.log('[CORA_ACCOUNTS] 📊 Contas encontradas:', accounts)

    return NextResponse.json({
      accounts,
      defaultAccount: accounts.length > 0 ? accounts[0].account : null
    })
  } catch (error: any) {
    console.error('[CORA_ACCOUNTS] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar contas Cora' },
      { status: 500 }
    )
  }
}
