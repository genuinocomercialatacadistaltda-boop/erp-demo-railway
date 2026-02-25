
// Cliente para integração com Plugnotas
import { COMPANY_CONFIG } from './company-config';

const PLUGNOTAS_API_URL = process.env.PLUGNOTAS_API_URL || 'https://api.plugnotas.com.br';
const PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || '';

export interface PlugnotasNFe {
  idIntegracao: string;
  presencial: boolean;
  consumidorFinal: boolean;
  natureza: string;
  emitente: {
    cpfCnpj: string;
    inscricaoEstadual: string;
    nome: string;
    nomeFantasia: string;
    endereco: {
      tipoLogradouro: string;
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      codigoCidade: string;
      cidade: string;
      uf: string;
      cep: string;
    };
  };
  destinatario?: {
    cpfCnpj?: string;
    nome: string;
    email?: string;
    telefone?: string;
    endereco?: {
      tipoLogradouro: string;
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      codigoCidade: string;
      cidade: string;
      uf: string;
      cep: string;
    };
  };
  itens: {
    numero: number;
    codigo: string;
    descricao: string;
    ncm: string;
    cfop: string;
    valor: number;
    tributacao: string;
    quantidade: number;
    unidadeMedida: string;
  }[];
  pagamentos: {
    forma: string;
    valor: number;
  }[];
  informacoesAdicionais?: {
    informacoesComplementares?: string;
  };
}

export interface PlugnotasResponse {
  id: string;
  status: string;
  numero?: string;
  serie?: string;
  chaveAcesso?: string;
  protocolo?: string;
  dataEmissao?: string;
  xml?: string;
  danfe?: string;
  erros?: {
    codigo: string;
    descricao: string;
  }[];
}

class PlugnotasAPI {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = PLUGNOTAS_API_KEY;
    this.baseUrl = PLUGNOTAS_API_URL;
  }

  private async request(endpoint: string, method: string = 'GET', data?: any) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro na requisição: ${response.status}`);
    }

    return await response.json();
  }

  async emitirNFe(nfe: PlugnotasNFe): Promise<PlugnotasResponse> {
    return await this.request('/nfe', 'POST', nfe);
  }

  async emitirNFCe(nfce: PlugnotasNFe): Promise<PlugnotasResponse> {
    return await this.request('/nfce', 'POST', nfce);
  }

  async consultarNota(id: string): Promise<PlugnotasResponse> {
    return await this.request(`/nfe/${id}`, 'GET');
  }

  async cancelarNota(id: string, motivo: string): Promise<PlugnotasResponse> {
    return await this.request(`/nfe/${id}/cancelamento`, 'POST', { motivo });
  }

  async baixarXML(id: string): Promise<string> {
    const response = await this.request(`/nfe/${id}/xml`, 'GET');
    return response.xml;
  }

  async baixarPDF(id: string): Promise<string> {
    const response = await this.request(`/nfe/${id}/pdf`, 'GET');
    return response.pdf;
  }
}

export const plugnotasAPI = new PlugnotasAPI();

// Função helper para criar payload de NF-e
export function criarPayloadNFe(dados: {
  tipo: 'NFE' | 'NFCE';
  idIntegracao: string;
  cliente: {
    nome: string;
    cpfCnpj?: string;
    email?: string;
    telefone?: string;
    endereco?: {
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
      codigoCidade: string;
    };
  };
  itens: {
    codigo: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
  }[];
  valorTotal: number;
  metodoPagamento: string;
  observacoes?: string;
}): PlugnotasNFe {
  const { tipo, idIntegracao, cliente, itens, valorTotal, metodoPagamento, observacoes } = dados;

  // Mapear método de pagamento
  const formaPagamento = metodoPagamento.includes('PIX') ? '99' : 
                        metodoPagamento.includes('CARD') ? '03' : 
                        metodoPagamento.includes('CASH') ? '01' : '99';

  return {
    idIntegracao,
    presencial: tipo === 'NFCE',
    consumidorFinal: true,
    natureza: 'Venda de mercadoria',
    emitente: {
      cpfCnpj: COMPANY_CONFIG.cnpj,
      inscricaoEstadual: COMPANY_CONFIG.inscricaoEstadual,
      nome: COMPANY_CONFIG.razaoSocial,
      nomeFantasia: COMPANY_CONFIG.nomeFantasia,
      endereco: {
        tipoLogradouro: 'Avenida',
        logradouro: COMPANY_CONFIG.logradouro,
        numero: COMPANY_CONFIG.numero,
        complemento: COMPANY_CONFIG.complemento,
        bairro: COMPANY_CONFIG.bairro,
        codigoCidade: COMPANY_CONFIG.codigoMunicipio,
        cidade: COMPANY_CONFIG.cidade,
        uf: COMPANY_CONFIG.uf,
        cep: COMPANY_CONFIG.cep,
      },
    },
    destinatario: cliente.cpfCnpj ? {
      cpfCnpj: cliente.cpfCnpj,
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      endereco: cliente.endereco ? {
        tipoLogradouro: 'Rua',
        logradouro: cliente.endereco.logradouro,
        numero: cliente.endereco.numero,
        complemento: cliente.endereco.complemento,
        bairro: cliente.endereco.bairro,
        codigoCidade: cliente.endereco.codigoCidade,
        cidade: cliente.endereco.cidade,
        uf: cliente.endereco.uf,
        cep: cliente.endereco.cep,
      } : undefined,
    } : {
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
    },
    itens: itens.map((item, index) => ({
      numero: index + 1,
      codigo: item.codigo,
      descricao: item.descricao,
      ncm: COMPANY_CONFIG.ncmPadrao,
      cfop: COMPANY_CONFIG.cfopDentroEstado,
      valor: item.valorUnitario,
      tributacao: 'icms102', // Simples Nacional - sem permissão de crédito
      quantidade: item.quantidade,
      unidadeMedida: 'UN',
    })),
    pagamentos: [
      {
        forma: formaPagamento,
        valor: valorTotal,
      },
    ],
    informacoesAdicionais: observacoes ? {
      informacoesComplementares: observacoes,
    } : undefined,
  };
}
