// Estado da aplicação e persistência em localStorage (migrando fichas da versão 1).
import dadosIniciais from '../data/alexsander.json';
import { combate, dano, novaSessao, pvTotal } from '../engine';
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

/** Ficha salva (validada e migrada pela importação) ou, se ausente ou corrompida, a da planilha. */
function lerFicha(): Ficha {
  const texto = lerTexto(CHAVE_FICHA);
  if (texto) {
    try {
      return verificarFicha(importarJson(texto));
    } catch (erro) {
      console.error('Ficha salva inválida; usando os valores da planilha', erro);
    }
  }
  return fichaPadrao();
}

function lerSessao(ficha: Ficha): Sessao {
  const padrao = novaSessao(ficha);
  const texto = lerTexto(CHAVE_SESSAO);
  if (!texto) return padrao;
  try {
    const bruta = JSON.parse(texto) as Partial<Sessao> | null;
    if (typeof bruta !== 'object' || bruta === null) return padrao;
    const numero = (v: unknown, reserva: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : reserva);
    return {
      pvAtual: numero(bruta.pvAtual, padrao.pvAtual),
      fadiga: Math.max(0, numero(bruta.fadiga, 0)),
      usosPoder: typeof bruta.usosPoder === 'object' && bruta.usosPoder !== null ? bruta.usosPoder : {},
      anotacoes: typeof bruta.anotacoes === 'string' ? bruta.anotacoes : '',
    };
  } catch {
    return padrao;
  }
}

export function carregar(): { ficha: Ficha; sessao: Sessao } {
  const ficha = lerFicha();
  const sessao = lerSessao(ficha);
  // Grava de volta: registra a migração da versão 1 e descarta campos antigos (como o histórico de rolagens).
  salvar(ficha, sessao);
  return { ficha, sessao };
}
