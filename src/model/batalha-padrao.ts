// Textos iniciais da aba Batalha (requisito em docs/batalha-requisitos.md). Servem de semente para
// alexsander.json e para fichas salvas antes da aba existir; todos continuam editáveis.
import type { AcaoBatalha, Reacao } from './types';

/** Pressão do Golpe Devastador: km² por ponto do poder (3 pontos = 24 km²). */
export const PRESSAO_GOLPE_POR_PONTO = 8;

export function acoesPadrao(): AcaoBatalha[] {
  return [
    { id: 'terra_real', nome: 'Terra Real', rolagem: '1d×48 direto no PV', notas: 'Dano aplicado direto nos pontos de vida do alvo.' },
    {
      id: 'fogo_real',
      nome: 'Fogo Real',
      rolagem: '400 de dano por rodada em 2 km²',
      notas: 'Contra divinos, ataques diretos recebem +200 de dano.',
    },
  ];
}

export function lembretesPadrao(): string[] {
  return [
    'Jikar: +3d×100 em ataque e defesa.',
    'Jikar: +1d no dano.',
    'Inimigos só fazem 1 ataque contra você.',
    'Contra um grupo, só metade pode atacar.',
    'Ilusão, mentira e invisibilidade não funcionam contra você.',
    'Proteção Divina: 1 rodada por dia de imunidade.',
    'Golpe Devastador: 3 pontos (usos por dia).',
    'Terra Real: 1d×48 direto no PV.',
  ];
}

export function reacoesPadrao(): Reacao[] {
  return [
    { situacao: 'Ataque físico ou mágico normal', resposta: 'Aparar ou Bloquear (valores em Defesas).' },
    { situacao: 'Dano absurdo ou divino', resposta: 'Proteção Divina: imune por 1 rodada por dia.' },
    { situacao: 'Efeito mental divino', resposta: 'Somar o bônus de Lugan Completo (+200) e de Proteção Divina (+150).' },
    { situacao: 'Ilusão, mentira ou invisibilidade', resposta: 'A Jikar nega.' },
    {
      situacao: 'Área contra aliados ou cenário',
      resposta: 'Proteção Divina absorve 200 de dano; O Filho de Hagashi protege os fiéis.',
    },
  ];
}
