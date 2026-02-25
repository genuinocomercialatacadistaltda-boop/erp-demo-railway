/**
 * Helper para redirecionar usuários para o app de investimentos
 * APLICAÇÃO EXTERNA: Bolsa Genuíno é um app separado já desenvolvido
 * Redirecionamento SIMPLES sem SSO - cliente faz login diretamente no app externo
 */

const INVESTMENT_APP_URL = 'https://xn--aoesgenuino-m9a.abacusai.app/auth/login'

export function redirectToInvestmentApp() {
  console.log('[INVEST_REDIRECT] Redirecionando para Bolsa Genuíno:', INVESTMENT_APP_URL)
  window.location.href = INVESTMENT_APP_URL
}

export function getInvestmentAppUrl() {
  return INVESTMENT_APP_URL
}
