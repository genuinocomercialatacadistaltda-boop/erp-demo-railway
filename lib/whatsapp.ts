/**
 * WhatsApp Integration Module
 * Suporta Evolution API (recomendado) ou Twilio como fallback
 * 
 * PRIORIDADE:
 * 1. Tenta usar Evolution API (self-hosted, grátis)
 * 2. Se não estiver disponível, usa Twilio (pago)
 */

import fs from 'fs';
import path from 'path';
import * as EvolutionAPI from './evolution-api';

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  whatsappBusinessNumber: string;
  whatsappPersonalNumber: string;
}

/**
 * Carrega as credenciais do Twilio das variáveis de ambiente ou arquivo de secrets
 */
function getTwilioCredentials(): TwilioCredentials | null {
  try {
    // Primeiro tenta ler das variáveis de ambiente (produção)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      console.log('[WHATSAPP] Carregando credenciais das variáveis de ambiente');
      return {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        whatsappBusinessNumber: process.env.TWILIO_WHATSAPP_BUSINESS_NUMBER || '',
        whatsappPersonalNumber: process.env.TWILIO_WHATSAPP_PERSONAL_NUMBER || ''
      };
    }

    // Fallback: tenta ler do arquivo de secrets (desenvolvimento)
    const secretsPath = path.join('/home/ubuntu/.config/abacusai_auth_secrets.json');
    
    if (!fs.existsSync(secretsPath)) {
      console.error('[WHATSAPP] Credenciais não encontradas nas variáveis de ambiente nem no arquivo de secrets');
      return null;
    }

    console.log('[WHATSAPP] Carregando credenciais do arquivo de secrets');
    const secretsData = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
    const twilioSecrets = secretsData.twilio?.secrets;

    if (!twilioSecrets) {
      console.error('[WHATSAPP] Secrets do Twilio não encontrados no arquivo');
      return null;
    }

    return {
      accountSid: twilioSecrets.account_sid?.value || '',
      authToken: twilioSecrets.auth_token?.value || '',
      whatsappBusinessNumber: twilioSecrets.whatsapp_business_number?.value || '',
      whatsappPersonalNumber: twilioSecrets.whatsapp_personal_number?.value || ''
    };
  } catch (error) {
    console.error('[WHATSAPP] Erro ao carregar credenciais:', error);
    return null;
  }
}

/**
 * Verifica se Evolution API está configurada (prioridade)
 */
async function isEvolutionConfigured(): Promise<boolean> {
  try {
    return await EvolutionAPI.isEvolutionApiConfigured();
  } catch (error) {
    console.error('[WHATSAPP] Erro ao verificar Evolution API:', error);
    return false;
  }
}



/**
 * Verifica se ALGUM sistema de WhatsApp está configurado
 * Para compatibilidade com código existente
 */
export async function isWhatsAppConfigured(): Promise<boolean> {
  console.log('[WHATSAPP] Verificando sistemas disponíveis...');
  
  // Prioridade 1: Evolution API
  const evolutionOk = await isEvolutionConfigured();
  if (evolutionOk) {
    console.log('[WHATSAPP] ✅ Evolution API disponível');
    return true;
  }
  
  // Fallback: Twilio
  const twilioOk = isTwilioConfigured();
  if (twilioOk) {
    console.log('[WHATSAPP] ✅ Twilio disponível (fallback)');
    return true;
  }
  
  console.log('[WHATSAPP] ❌ Nenhum sistema de WhatsApp configurado');
  return false;
}

/**
 * Função de compatibilidade - usa o novo sistema híbrido
 * @deprecated Use isWhatsAppConfigured() em vez disso
 */
export function isTwilioConfigured(): boolean {
  try {
    const credentials = getTwilioCredentials();
    
    if (!credentials) {
      console.log('[WHATSAPP] Credenciais Twilio não encontradas');
      return false;
    }
    
    const isConfigured = !!(
      credentials.accountSid && 
      credentials.accountSid.trim() !== '' &&
      credentials.authToken && 
      credentials.authToken.trim() !== '' &&
      credentials.whatsappBusinessNumber && 
      credentials.whatsappBusinessNumber.trim() !== ''
    );
    
    return isConfigured;
  } catch (error) {
    console.error('[WHATSAPP] Erro ao verificar configuração Twilio:', error);
    return false;
  }
}

/**
 * Formata número de telefone para o formato do Twilio WhatsApp
 * Exemplo: (63) 99999-7942 -> +5563999997942
 */
export function formatWhatsAppNumber(phone: string): string {
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Se já tem código do país, retorna com +
  if (cleaned.length >= 12) {
    return `+${cleaned}`;
  }
  
  // Adiciona código do Brasil (+55)
  return `+55${cleaned}`;
}

/**
 * Envia mensagem via Twilio (fallback)
 */
async function sendViaTwilio(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const credentials = getTwilioCredentials();

    if (!credentials) {
      console.error('[WHATSAPP_TWILIO] Credenciais não configuradas');
      return {
        success: false,
        error: 'Credenciais do Twilio não configuradas'
      };
    }

    // Formata os números
    const fromNumber = `whatsapp:${credentials.whatsappBusinessNumber}`;
    const toNumber = `whatsapp:${formatWhatsAppNumber(to)}`;

    console.log('[WHATSAPP_TWILIO] Enviando mensagem...');
    console.log('[WHATSAPP_TWILIO] De:', fromNumber);
    console.log('[WHATSAPP_TWILIO] Para:', toNumber);
    console.log('[WHATSAPP_TWILIO] Mensagem:', message.substring(0, 100) + '...');

    // Cria a URL da API do Twilio
    const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;

    // Cria o corpo da requisição
    const body = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: message
    });

    // Envia a requisição
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          `${credentials.accountSid}:${credentials.authToken}`
        ).toString('base64')
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[WHATSAPP_TWILIO] Erro na resposta da API:', data);
      console.error('[WHATSAPP_TWILIO] Status:', response.status);
      console.error('[WHATSAPP_TWILIO] Código do erro:', data.code);
      console.error('[WHATSAPP_TWILIO] Mensagem do erro:', data.message);
      
      // Mensagens de erro mais amigáveis baseadas no código
      let errorMessage = data.message || 'Erro ao enviar mensagem';
      
      if (data.code === 63007) {
        errorMessage = '❌ **ERRO DE CONFIGURAÇÃO DO TWILIO**\n\n' +
          'O número WhatsApp Business não está configurado corretamente no Twilio.\n\n' +
          '**Como resolver:**\n' +
          '1. Acesse: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn\n' +
          '2. Siga as instruções para configurar o WhatsApp Sandbox\n' +
          '3. OU solicite aprovação para WhatsApp Business API\n\n' +
          '**Número configurado:** ' + credentials.whatsappBusinessNumber + '\n' +
          '**Este número precisa estar ativo no Twilio para enviar mensagens.**';
      } else if (data.code === 21211) {
        errorMessage = '❌ Número de telefone do destinatário inválido.\n\n' +
          'Verifique se o número está no formato correto: +55 (DDD) 9XXXX-XXXX';
      } else if (data.code === 21608) {
        errorMessage = '❌ O destinatário não pode receber mensagens WhatsApp.\n\n' +
          '**Motivo:** O número não está conectado ao WhatsApp Sandbox do Twilio.\n\n' +
          '**Como resolver:**\n' +
          '1. O destinatário precisa enviar uma mensagem para o número do Sandbox do Twilio\n' +
          '2. A mensagem deve ser: "join <código-do-sandbox>"\n' +
          '3. Após isso, ele poderá receber mensagens pelo sistema.';
      } else if (data.code === 20003) {
        errorMessage = '❌ Autenticação falhou.\n\n' +
          'As credenciais do Twilio (Account SID ou Auth Token) estão incorretas.\n' +
          'Verifique as configurações no arquivo de secrets.';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }

    console.log('[WHATSAPP_TWILIO] ✅ Mensagem enviada com sucesso! SID:', data.sid);
    return {
      success: true,
      messageId: data.sid
    };

  } catch (error: any) {
    console.error('[WHATSAPP_TWILIO] ❌ Erro ao enviar mensagem:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Envia uma mensagem via WhatsApp
 * Tenta Evolution API primeiro, depois Twilio como fallback
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log('[WHATSAPP] Tentando enviar mensagem...');
  
  // Prioridade 1: Evolution API
  try {
    const evolutionOk = await isEvolutionConfigured();
    if (evolutionOk) {
      console.log('[WHATSAPP] Usando Evolution API...');
      const result = await EvolutionAPI.sendWhatsAppMessage(to, message);
      
      if (result.success) {
        console.log('[WHATSAPP] ✅ Mensagem enviada via Evolution API');
        return result;
      }
      
      console.log('[WHATSAPP] ⚠️ Evolution API falhou:', result.error);
      console.log('[WHATSAPP] Tentando fallback para Twilio...');
    }
  } catch (error) {
    console.error('[WHATSAPP] Erro ao tentar Evolution API:', error);
    console.log('[WHATSAPP] Tentando fallback para Twilio...');
  }
  
  // Fallback: Twilio
  const twilioOk = isTwilioConfigured();
  if (twilioOk) {
    console.log('[WHATSAPP] Usando Twilio como fallback...');
    return await sendViaTwilio(to, message);
  }
  
  // Nenhum sistema disponível
  console.error('[WHATSAPP] ❌ Nenhum sistema de WhatsApp configurado');
  return {
    success: false,
    error: '❌ Sistema de WhatsApp não configurado.\n\n' +
      '**Configure uma das opções:**\n' +
      '1. Evolution API (recomendado, grátis) - Acesse /admin/whatsapp\n' +
      '2. Twilio (pago) - Configure as credenciais no sistema'
  };
}

/**
 * Envia lembrete de boleto vencendo
 */
export async function sendBoletoReminder(
  customerName: string,
  customerPhone: string,
  boletoAmount: number,
  dueDate: Date
): Promise<{ success: boolean; error?: string }> {
  const dueDateStr = dueDate.toLocaleDateString('pt-BR');
  const amountStr = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(boletoAmount);

  const message = `🔔 *Lembrete de Pagamento*\n\n` +
    `Olá ${customerName}! \n\n` +
    `Seu boleto no valor de *${amountStr}* vence em *${dueDateStr}*.\n\n` +
    `Por favor, realize o pagamento para evitar atrasos.\n\n` +
    `Qualquer dúvida, estamos à disposição! 😊`;

  return await sendWhatsAppMessage(customerPhone, message);
}

/**
 * Envia lembrete de boleto vencido
 */
export async function sendOverdueBoletoNotification(
  customerName: string,
  customerPhone: string,
  boletoAmount: number,
  dueDate: Date
): Promise<{ success: boolean; error?: string }> {
  const dueDateStr = dueDate.toLocaleDateString('pt-BR');
  const amountStr = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(boletoAmount);

  const message = `⚠️ *Boleto Vencido*\n\n` +
    `Olá ${customerName}! \n\n` +
    `Identificamos que seu boleto no valor de *${amountStr}* com vencimento em *${dueDateStr}* está em atraso.\n\n` +
    `Por favor, regularize o pagamento o quanto antes para evitar bloqueios.\n\n` +
    `Estamos à disposição para qualquer esclarecimento! 📞`;

  return await sendWhatsAppMessage(customerPhone, message);
}

/**
 * Envia lembrete de pedido
 */
export async function sendOrderReminder(
  customerName: string,
  customerPhone: string,
  lastOrderDate?: Date
): Promise<{ success: boolean; error?: string }> {
  let message = `👋 *Olá ${customerName}!*\n\n`;

  if (lastOrderDate) {
    const daysSince = Math.floor(
      (Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    message += `Já faz ${daysSince} dias desde seu último pedido! 😊\n\n`;
  }

  message += `Que tal fazer um novo pedido hoje? \n` +
    `Estamos com produtos fresquinhos esperando por você! 🍖\n\n` +
    `Qualquer dúvida, é só chamar! 📱`;

  return await sendWhatsAppMessage(customerPhone, message);
}

/**
 * Envia notificação de mudança de status do pedido
 */
export async function sendOrderStatusUpdate(
  customerName: string,
  customerPhone: string,
  orderNumber: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const statusMessages: Record<string, string> = {
    'PROCESSING': '⏳ seu pedido está sendo preparado',
    'READY': '✅ seu pedido está pronto para retirada/entrega',
    'SHIPPED': '🚚 seu pedido saiu para entrega',
    'DELIVERED': '🎉 seu pedido foi entregue'
  };

  const statusMsg = statusMessages[status] || `status foi atualizado para: ${status}`;

  const message = `📦 *Atualização do Pedido #${orderNumber}*\n\n` +
    `Olá ${customerName}! \n\n` +
    `Informamos que ${statusMsg}.\n\n` +
    `Obrigado pela preferência! 😊`;

  return await sendWhatsAppMessage(customerPhone, message);
}
