// Operações de sessão compartilhadas pelo painel do topo e pela aba Batalha: PV, fadiga, usos e descanso.
import { pvTotal, usoDoPoder } from '../engine';
import type { Poder } from '../model/types';
import type { Contexto } from './contexto';

/** Mantém o PV entre 0 e o total da ficha. */
export function limitarPv(ctx: Contexto, valor: number): number {
  return Math.max(0, Math.min(valor, pvTotal(ctx.ficha())));
}

/** Soma `delta` ao PV atual (negativo é dano, positivo é cura), respeitando os limites. */
export function aplicarPv(ctx: Contexto, delta: number): void {
  const s = ctx.sessao();
  s.pvAtual = limitarPv(ctx, s.pvAtual + delta);
  ctx.mudou();
}

/** Soma `delta` à fadiga (negativo recupera); ela nunca fica abaixo de zero. */
export function mudarFadiga(ctx: Contexto, delta: number): void {
  const s = ctx.sessao();
  s.fadiga = Math.max(0, s.fadiga + delta);
  ctx.mudou();
}

/** Registra um uso do poder e soma o custo de fadiga; poder esgotado não é usado. */
export function usarPoder(ctx: Contexto, poder: Poder): void {
  const s = ctx.sessao();
  if (usoDoPoder(poder, s).esgotado) return;
  s.usosPoder[poder.id] = (s.usosPoder[poder.id] ?? 0) + 1;
  s.fadiga += poder.custoFadiga ?? 0;
  ctx.mudou();
  ctx.avisar(`${poder.nome} usado.`);
}

/** Zera a fadiga e os usos por dia. */
export function descansar(ctx: Contexto): void {
  const s = ctx.sessao();
  s.fadiga = 0;
  s.usosPoder = {};
  ctx.mudou();
  ctx.avisar('Descanso concluído: fadiga e usos por dia zerados.');
}
