// Estado da aplicação e persistência em localStorage.
import dadosIniciais from '../data/alexsander.json';
import { novaSessao } from '../engine';
import type { Ficha, Sessao } from '../model/types';

export const CHAVE_FICHA = 'app_ficha:ficha';
export const CHAVE_SESSAO = 'app_ficha:sessao';
export const LIMITE_HISTORICO = 20;

function ler<T>(chave: string): T | null {
  try {
    const texto = localStorage.getItem(chave);
    return texto ? (JSON.parse(texto) as T) : null;
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

export function carregar(): { ficha: Ficha; sessao: Sessao } {
  const ficha = ler<Ficha>(CHAVE_FICHA) ?? (structuredClone(dadosIniciais) as unknown as Ficha);
  const sessao = ler<Sessao>(CHAVE_SESSAO) ?? novaSessao(ficha);
  sessao.usosPoder ??= {};
  sessao.rolagens ??= [];
  sessao.anotacoes ??= '';
  if (!ler<Ficha>(CHAVE_FICHA)) salvar(ficha, sessao);
  return { ficha, sessao };
}
