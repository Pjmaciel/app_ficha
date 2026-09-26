// Escalas por nível dos poderes conhecidos (docs/poderes-escala-requisitos.md, extraídas do livro).
// Servem de semente para alexsander.json e para a migração de fichas salvas antes da escala existir;
// todas continuam editáveis na aba Poderes. Onde a planilha diverge do livro, a migração semeia o
// coeficiente do livro e uma fonte manual "Ajuste do mestre" que preserva o total da planilha.
import type { ChaveCombate, EscalaPoder } from './types';

const CHAVES: ChaveCombate[] = [
  'ataqueArmaBranca', 'ataqueMagico', 'ataqueLuta', 'ataqueArmaFogo', 'esquivar', 'bloquear', 'aparar',
];

/** O mesmo coeficiente em todas as chaves de combate. */
const emTodas = (valor: number): Partial<Record<ChaveCombate, number>> =>
  Object.fromEntries(CHAVES.map((c) => [c, valor]));

/** Escala do livro para o poder de id dado; cópia nova a cada chamada (ou undefined se o poder não tem escala numérica). */
export function escalaPadrao(id: string): EscalaPoder | undefined {
  switch (id) {
    case 'lugan_da_batalha':
      return { ataquePorNivel: emTodas(50), danoPorNivel: 20 };
    // Livro: +70 ataque/defesa com a arma escolhida e +20 no dano; a planilha traz 140/140/40 no nível 3.
    case 'campeao_do_combate_divino':
      return { ataquePorNivel: { ataqueArmaBranca: 70, aparar: 70 }, danoPorNivel: 20 };
    // Livro: +30/+30/+10 por ponto; a planilha usa 60/60/20 no nível 1.
    case 'lugan_completo':
      return { ataquePorNivel: emTodas(30), danoPorNivel: 10 };
    case 'forca_das_montanhas_divinas':
      return { atributoPorNivel: { atributo: 'forca', valor: 60 } };
    case 'protecao_divina':
      return { pvPorNivel: 500, usosPorNivel: 1 };
    // +1d de ataque por nível e +1d de dano por nível, com ajuste fixo de −1d no dano (3d×100 e 2d×100 com 1 ponto).
    case 'golpe_devastador':
      return { dadosAtaquePorNivel: 1, dadosDanoPorNivel: 1, usosPorNivel: 1 };
    case 'o_filho_de_hagashi':
      return { fieisPorNivel: 8000 };
    case 'manipulador_de_tsu_real':
      return { ataquePorNivel: { ataqueMagico: 70 } };
    default:
      return undefined;
  }
}
