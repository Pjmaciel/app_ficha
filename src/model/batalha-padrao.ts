// Textos iniciais da aba Batalha (requisito em docs/batalha-requisitos.md). Servem de semente para
// alexsander.json e para fichas salvas antes da aba existir; todos continuam editáveis.
// Os números de efeitos de poderes não ficam no texto: usam marcadores vivos ({poder.<id>.<efeito>},
// {poder.<id>.nivel} e {soma:...}) que o motor resolve ao exibir (`resolverTexto`), para que subir o poder mude tudo junto.
import type { AcaoBatalha, Reacao } from './types';

/** Aspecto do mundo do pilar quando a ficha não o traz (o do Alexsander: Justiça 3). */
export const PILAR_NIVEL_PADRAO = 3;

/** Pressão do Golpe Devastador: km² por ponto do poder (3 pontos = 24 km²). */
export const PRESSAO_GOLPE_POR_PONTO = 8;

export function acoesPadrao(): AcaoBatalha[] {
  return [
    { id: 'terra_real', nome: 'Terra Real', rolagem: '1d×48 direto no PV', notas: 'Dano aplicado direto nos pontos de vida do alvo.' },
    {
      id: 'fogo_real',
      nome: 'Fogo Real',
      rolagem: '{poder.fogo_real.dano_rodada} de dano por rodada em {poder.fogo_real.area_km2} km²',
      notas: 'Contra divinos, ataques diretos recebem +{poder.fogo_real.dano_divinos} de dano.',
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
    'Proteção Divina: {poder.protecao_divina.imunidade_rodadas} rodada(s) por dia de imunidade.',
    'Golpe Devastador: {poder.golpe_devastador.nivel} ponto(s) (usos por dia).',
    'Terra Real: 1d×48 direto no PV.',
  ];
}

export function reacoesPadrao(): Reacao[] {
  return [
    { situacao: 'Ataque físico ou mágico normal', resposta: 'Aparar ou Bloquear (valores em Defesas).' },
    {
      situacao: 'Dano absurdo ou divino',
      resposta: 'Proteção Divina: imune por {poder.protecao_divina.imunidade_rodadas} rodada(s) por dia.',
    },
    {
      situacao: 'Efeito mental divino',
      resposta:
        'Somar o bônus de Lugan Completo (+{poder.lugan_completo.anti_mental}) e de Proteção Divina '
        + '(+{poder.protecao_divina.anti_mental}), total +{soma:lugan_completo.anti_mental+protecao_divina.anti_mental}.',
    },
    { situacao: 'Ilusão, mentira ou invisibilidade', resposta: 'A Jikar nega.' },
    {
      situacao: 'Área contra aliados ou cenário',
      resposta:
        'Proteção Divina absorve {poder.protecao_divina.absorcao_area} de dano em {poder.protecao_divina.raio_km2} km²; '
        + 'O Filho de Hagashi protege os fiéis.',
    },
  ];
}

// Textos com números fixos das versões anteriores da semente e o texto vivo que os substitui: a migração troca
// só os que estão exatamente iguais (o que o jogador editou fica como está).
const TEXTOS_ANTIGOS: Record<string, string> = {
  '400 de dano por rodada em 2 km²': acoesPadrao()[1].rolagem,
  'Contra divinos, ataques diretos recebem +200 de dano.': acoesPadrao()[1].notas,
  'Proteção Divina: 1 rodada por dia de imunidade.': lembretesPadrao()[5],
  'Golpe Devastador: 3 pontos (usos por dia).': lembretesPadrao()[6],
  'Proteção Divina: imune por 1 rodada por dia.': reacoesPadrao()[1].resposta,
  'Somar o bônus de Lugan Completo (+200) e de Proteção Divina (+150).': reacoesPadrao()[2].resposta,
  'Proteção Divina absorve 200 de dano; O Filho de Hagashi protege os fiéis.': reacoesPadrao()[4].resposta,
};

/** Troca um texto antigo da semente pelo texto vivo equivalente; qualquer outro texto passa sem mudança. */
export const textoVivo = (texto: string): string => TEXTOS_ANTIGOS[texto] ?? texto;
