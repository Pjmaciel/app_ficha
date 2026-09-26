// Estado da aplicação e persistência em localStorage (migrando fichas da versão 1).
import dadosIniciais from '../data/alexsander.json';
import { combate, dano, decidirCarregamento, novaSessao, pvTotal } from '../engine';
import { importarJson } from '../import';
import type { Ficha, Sessao } from '../model/types';

export const CHAVE_FICHA = 'app_ficha:ficha';
export const CHAVE_SESSAO = 'app_ficha:sessao';

/** Valores da planilha correta, sempre uma cópia nova. */
export function fichaPadrao(): Ficha {
  return structuredClone(dadosIniciais) as unknown as Ficha;
}

const CHAVES_CALCULO = ['ataqueArmaBranca', 'ataqueMagico', 'ataqueLuta', 'ataqueArmaFogo', 'esquivar', 'bloquear', 'aparar'] as const;

/** Garante que o motor consegue calcular a ficha (por exemplo, que as perícias usadas nas fórmulas existem). */
export function verificarFicha(ficha: Ficha): Ficha {
  try {
    for (const chave of CHAVES_CALCULO) combate(ficha, chave);
    for (const g of ficha.golpes) dano(ficha, g);
    dano(ficha);
    pvTotal(ficha);
  } catch (erro) {
    throw new Error(`Ficha incompleta para o cálculo de combate (${(erro as Error).message})`);
  }
  return ficha;
}

function lerTexto(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function salvar(ficha: Ficha, sessao: Sessao): void {
  try {
    localStorage.setItem(CHAVE_FICHA, JSON.stringify(ficha));
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  } catch (erro) {
    console.error('Não foi possível salvar no armazenamento local', erro);
  }
}

/** Revisão dos dados da ficha embutida (a da planilha corrente). */
export const REVISAO_EMBUTIDA = fichaPadrao().revisaoDados;

interface FichaLida {
  ficha: Ficha;
  /** A ficha salva era da planilha antiga e foi descartada; da sessão só valem PV e fadiga. */
  descartouAntiga: boolean;
  /** Revisão embutida mais nova que a da ficha salva: o app oferece carregar a nova. */
  avisarNovaRevisao: boolean;
}

/** Ficha salva (validada e migrada pela importação) ou, se ausente, antiga ou corrompida, a da planilha. */
function lerFicha(): FichaLida {
  const embutida = fichaPadrao();
  const texto = lerTexto(CHAVE_FICHA);
  let bruta: unknown = null;
  if (texto) {
    try {
      bruta = JSON.parse(texto);
    } catch {
      bruta = null;
    }
  }
  const decisao = decidirCarregamento(bruta, embutida);
  if (decisao.acao === 'embutida') {
    return { ficha: embutida, descartouAntiga: decisao.motivo === 'planilha-antiga', avisarNovaRevisao: false };
  }
  try {
    return { ficha: verificarFicha(importarJson(texto as string)), descartouAntiga: false, avisarNovaRevisao: decisao.avisarNovaRevisao };
  } catch (erro) {
    console.error('Ficha salva inválida; usando os valores da planilha', erro);
    return { ficha: embutida, descartouAntiga: false, avisarNovaRevisao: false };
  }
}

/** Sessão salva; com `somentePvEFadiga`, apenas PV (limitado ao novo máximo) e fadiga são aproveitados. */
function lerSessao(ficha: Ficha, somentePvEFadiga = false): Sessao {
  const padrao = novaSessao(ficha);
  const texto = lerTexto(CHAVE_SESSAO);
  if (!texto) return padrao;
  try {
    const bruta = JSON.parse(texto) as Partial<Sessao> | null;
    if (typeof bruta !== 'object' || bruta === null) return padrao;
    const numero = (v: unknown, reserva: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : reserva);
    const pvAtual = numero(bruta.pvAtual, padrao.pvAtual);
    if (somentePvEFadiga) {
      return { ...padrao, pvAtual: Math.max(0, Math.min(pvAtual, pvTotal(ficha))), fadiga: Math.max(0, numero(bruta.fadiga, 0)) };
    }
    return {
      pvAtual,
      fadiga: Math.max(0, numero(bruta.fadiga, 0)),
      usosPoder: typeof bruta.usosPoder === 'object' && bruta.usosPoder !== null ? bruta.usosPoder : {},
      anotacoes: typeof bruta.anotacoes === 'string' ? bruta.anotacoes : '',
    };
  } catch {
    return padrao;
  }
}

export function carregar(): { ficha: Ficha; sessao: Sessao; avisarNovaRevisao: boolean } {
  const { ficha, descartouAntiga, avisarNovaRevisao } = lerFicha();
  const sessao = lerSessao(ficha, descartouAntiga);
  // Grava de volta: registra a migração e descarta campos antigos (como o histórico de rolagens).
  salvar(ficha, sessao);
  return { ficha, sessao, avisarNovaRevisao };
}
