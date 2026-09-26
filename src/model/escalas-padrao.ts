// Escalas por nível dos poderes conhecidos (docs/poderes-escala-requisitos.md, extraídas do livro).
// Servem de semente para alexsander.json e para a migração de fichas salvas antes da escala existir;
// todas continuam editáveis na aba Poderes. Onde a planilha diverge do livro, a migração semeia o
// coeficiente do livro e uma fonte manual "Ajuste do mestre" que preserva o total da planilha.
import type { ChaveCombate, EfeitoEscalavel, EscalaPoder } from './types';

const CHAVES: ChaveCombate[] = [
  'ataqueArmaBranca', 'ataqueMagico', 'ataqueLuta', 'ataqueArmaFogo', 'esquivar', 'bloquear', 'aparar',
];

/** O mesmo coeficiente em todas as chaves de combate. */
const emTodas = (valor: number): Partial<Record<ChaveCombate, number>> =>
  Object.fromEntries(CHAVES.map((c) => [c, valor]));

const efeito = (id: string, rotulo: string, porPonto: number, extra: Partial<EfeitoEscalavel> = {}): EfeitoEscalavel =>
  ({ id, rotulo, porPonto, ...extra });

/** Pressão dos ataques em km² por ponto do poder (Lugan da Batalha, Campeão do Combate Divino e Golpe Devastador). */
const pressaoKm2 = (porPonto: number): EfeitoEscalavel => efeito('pressao_km2', 'Pressão dos ataques', porPonto, { unidade: 'km²' });

/**
 * Escala do livro para o poder de id dado; cópia nova a cada chamada (ou undefined se o poder não tem escala numérica).
 * As parcelas numéricas de combate, dano, atributo, PV e usos ficam nos campos `...PorNivel` (efeitos de ids
 * reservados); o restante (alcance, absorção, criaturas, patamares) vai em `efeitos` e `patamares`.
 * Onde a planilha diverge do livro, o efeito leva um `fixo` (ajuste do mestre) que preserva o valor da planilha.
 */
export function escalaPadrao(id: string): EscalaPoder | undefined {
  switch (id) {
    case 'lugan_da_batalha':
      return { ataquePorNivel: emTodas(50), danoPorNivel: 20, efeitos: [pressaoKm2(1)] };
    // Livro: +70 ataque/defesa com a arma escolhida e +20 no dano; a planilha traz 140/140/40 no nível 3.
    case 'campeao_do_combate_divino':
      return { ataquePorNivel: { ataqueArmaBranca: 70, aparar: 70 }, danoPorNivel: 20, efeitos: [pressaoKm2(2)] };
    // Livro: +30/+30/+10 por ponto; a planilha usa 60/60/20, +200 contra mentais e voo de 280 km/h no nível 1.
    case 'lugan_completo':
      return {
        ataquePorNivel: emTodas(30),
        danoPorNivel: 10,
        efeitos: [
          efeito('anti_mental', 'Anula efeitos mentais divinos', 100, { fixo: 100 }),
          efeito('acao_extra', 'Ações extras', 1, { aCada: 3, unidade: 'ações' }),
          efeito('voo_kmh', 'Voo', 140, { fixo: 140, unidade: 'km/h' }),
          efeito('voo_altura_m', 'Altura máxima do voo', 0, { fixo: 3000, unidade: 'm' }),
          efeito('pressao_m', 'Pressão dos ataques', 500, { unidade: 'm' }),
        ],
      };
    case 'forca_das_montanhas_divinas':
      return {
        atributoPorNivel: { atributo: 'forca', valor: 60 },
        efeitos: [efeito('raio_km2', 'Raio dos ataques de Força', 2, { unidade: 'km²' })],
      };
    case 'protecao_divina':
      return {
        pvPorNivel: 500,
        usosPorNivel: 1,
        efeitos: [
          efeito('imunidade_rodadas', 'Imunidade total', 1, { unidade: 'rodadas por dia' }),
          efeito('vigor', 'Rolagem de vigor lugânico', 1, { aCada: 2 }),
          efeito('absorcao_area', 'Absorção de dano no cenário e nos envolvidos', 0, { fixo: 200, unidade: 'de dano' }),
          efeito('raio_km2', 'Raio da proteção', 5, { unidade: 'km²' }),
          efeito('criaturas', 'Criaturas protegidas', 100, { unidade: 'criaturas' }),
          efeito('anti_mental', 'Anula efeitos mentais divinos', 150),
        ],
        patamares: [
          { nivel: 3, texto: 'passa a reduzir a Tsu real: rola 1d para diminuir o dano' },
          { nivel: 6, texto: 'reduz a Tsu real com 1d+1' },
          { nivel: 9, texto: 'reduz a Tsu real com 1d+2' },
        ],
      };
    case 'velocidade_divina':
      return {
        efeitos: [
          efeito('acoes_velocidade', 'Ações de velocidade contra outros Lugans', 1),
          efeito('acoes_extras', 'Ações extras contra não lugânicos', 0, { fixo: 3, unidade: 'ações' }),
          efeito('velocidade_kmh', 'Velocidade de deslocamento', 220, { unidade: 'km/h' }),
          efeito('teleporte_km', 'Distância do teleporte', 2000, { unidade: 'km' }),
        ],
        patamares: [
          { nivel: 4, texto: 'rompe a barreira do espaço: teleporte para qualquer lugar de Kitai, até {poder.velocidade_divina.teleporte_km.porPonto} km por ponto' },
        ],
      };
    // +1d de ataque por nível e +1d de dano por nível, com ajuste fixo de −1d no dano (3d×100 e 2d×100 com 1 ponto).
    case 'golpe_devastador':
      return {
        dadosAtaquePorNivel: 1,
        dadosDanoPorNivel: 1,
        usosPorNivel: 1,
        efeitos: [
          pressaoKm2(8),
          efeito('raio_m', 'Raio do ataque especial contra divinos', 0, { fixo: 500, unidade: 'm' }),
          efeito('custo_pv', 'Custo em PV sem pontos no poder', 0, { fixo: 1600, unidade: 'PV' }),
        ],
      };
    case 'o_filho_de_hagashi':
      return {
        fieisPorNivel: 8000,
        efeitos: [
          efeito('protecao', 'Proteção territorial', 350, { unidade: 'de dano' }),
          efeito('area_km', 'Área protegida do reino', 25, { unidade: 'km' }),
          efeito('bonus_fieis', 'Bônus dos fiéis em ataque e defesa', 12),
        ],
      };
    case 'manipulador_de_tsu_real':
      return {
        ataquePorNivel: { ataqueMagico: 70 },
        efeitos: [
          efeito('dano_magico', 'Bônus nos danos mágicos', 10),
          efeito('locais', 'Locais de Kitai para conjurar a mesma magia', 3),
          efeito('alvos', 'Alvos simultâneos de magia', 50),
          efeito('defesa_aliados', 'Bônus de defesa concedido a Lugans aliados', 30),
        ],
      };
    case 'fogo_real':
      return {
        efeitos: [
          efeito('area_km2', 'Área das chamas', 1, { unidade: 'km²' }),
          efeito('dano_rodada', 'Dano por rodada em contato', 0, { fixo: 400 }),
          // Livro: +50 por ponto contra divinos; a planilha usa +200 no nível 2.
          efeito('dano_divinos', 'Dano extra em ataques diretos contra divinos', 50, { fixo: 100 }),
        ],
      };
    default:
      return undefined;
  }
}
