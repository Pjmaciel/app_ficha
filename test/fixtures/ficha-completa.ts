// Ficha de teste com todos os poderes reativados nos níveis da regra completa anterior (Justiça 3), mais as fontes manuais
// "Outros". Serve para exercitar as escalas, os efeitos e os textos vivos de todos os poderes; a ficha embutida da build
// atual da mesa (docs/regra-mesa-build-requisitos.md) deixa a maioria deles como `removido`.
import dados from '../../src/data/alexsander.json';
import type { Ficha } from '../../src/model/types';

export const NIVEIS_COMPLETA: Record<string, [number | null, Poder['tipo']]> = {
  velocidade_divina: [2, 'passivo'],
  lugan_da_batalha: [5, 'passivo'],
  golpe_devastador: [3, 'ativo'],
  portador_da_jikar: [null, 'item'],
  campeao_do_combate_divino: [6, 'passivo'],
  forca_das_montanhas_divinas: [3, 'passivo'],
  protecao_divina: [4, 'defesa'],
  o_filho_de_hagashi: [12, 'passivo'],
  lugan_completo: [6, 'passivo'],
  manipulador_de_tsu_real: [3, 'passivo'],
  fogo_real: [6, 'ativo'],
};

type Poder = Ficha['poderes'][number];

/** Cópia nova da ficha embutida com todos os poderes ativos nos níveis acima e o "Outros" da planilha de volta. */
export function fichaCompleta(): Ficha {
  const f = structuredClone(dados) as unknown as Ficha;
  for (const p of f.poderes) {
    const [nivel, tipo] = NIVEIS_COMPLETA[p.id];
    p.nivel = nivel;
    p.tipo = tipo;
  }
  const outros = { ataqueArmaBranca: 120, ataqueLuta: 70, ataqueArmaFogo: 70, esquivar: 120, bloquear: 120, aparar: 120 } as const;
  for (const [chave, valor] of Object.entries(outros)) f.combate[chave as keyof typeof outros].fontes.push({ nome: 'Outros', valor });
  return f;
}
