// Evolução por nível divino (docs/evolucao-divina-requisitos.md): valores padrão das regras do livro.
// MAIS GLÓRIA E MAIS PODER, p. 31 e 74 a 77. A tabela de XP do livro é acumulada e vai até o nível 40 (custo por nível: 20, 20, 20,
// 30, 30, 40, 50, 50 do 32 ao 40); acima disso o custo é extrapolação do último degrau (confirme com o mestre).
import type { Regras } from './types';

/** Custo em XP do próximo nível a partir do 41: o último degrau da tabela do livro (extrapolação); editável. */
export const XP_PROXIMO_NIVEL_PADRAO = 50;

/** Acréscimo do custo a cada nível subido; zero porque acima do nível 40 o livro não traz dado; editável. */
export const INCREMENTO_XP_PADRAO = 0;

/** Atributos que sobem (+10) a cada nível divino pela regra do livro. */
export const ATRIBUTOS_POR_NIVEL = 4;

/** Bônus de nível por atributo escolhido, e bônus de graduação nas perícias dos níveis pares. */
export const BONUS_ATRIBUTO_LIVRO = 10;
export const BONUS_PERICIAS_LIVRO = 4;

export const REGRAS_EVOLUCAO_PADRAO: Pick<Regras, 'regraNivel' | 'xpProximoNivel' | 'incrementoXpPorNivel'> = {
  regraNivel: 'livro',
  xpProximoNivel: XP_PROXIMO_NIVEL_PADRAO,
  incrementoXpPorNivel: INCREMENTO_XP_PADRAO,
};
