// Escalas por nível dos poderes conhecidos (docs/poderes-escala-requisitos.md, extraídas do livro).
// Servem de semente para alexsander.json e para a migração de fichas salvas antes da escala existir;
// todas continuam editáveis na aba Poderes. Onde a planilha divergia do livro, vale o coeficiente do livro por ponto
// (as fontes manuais "Ajuste do mestre" que calibravam os níveis antigos foram removidas).
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
 */
export function escalaPadrao(id: string): EscalaPoder | undefined {
  switch (id) {
    case 'lugan_da_batalha':
      return { ataquePorNivel: emTodas(50), danoPorNivel: 20, efeitos: [pressaoKm2(1)] };
    // Livro: +70 ataque/defesa com a arma escolhida e +20 no dano, por ponto.
    case 'campeao_do_combate_divino':
      return { ataquePorNivel: { ataqueArmaBranca: 70, aparar: 70 }, danoPorNivel: 20, efeitos: [pressaoKm2(2)] };
    // Livro: +30/+30/+10 por ponto, 100 contra efeitos mentais divinos e 140 km/h de voo por ponto.
    case 'lugan_completo':
      return {
        ataquePorNivel: emTodas(30),
        danoPorNivel: 10,
        efeitos: [
          efeito('anti_mental', 'Anula efeitos mentais divinos', 100),
          efeito('acao_extra', 'Ações extras', 1, { aCada: 3, unidade: 'ações' }),
          efeito('voo_kmh', 'Voo', 140, { unidade: 'km/h' }),
          efeito('voo_altura_m', 'Altura máxima do voo', 0, { fixo: 3000, unidade: 'm' }),
          efeito('pressao_m', 'Pressão dos ataques', 500, { unidade: 'm' }),
        ],
      };
    case 'forca_das_montanhas_divinas':
      return {
        atributoPorNivel: { atributo: 'forca', valor: 60 },
        efeitos: [
          efeito('raio_km2', 'Raio dos ataques de Força', 2, { unidade: 'km²' }),
          efeito('terremoto_km2', 'Distância do terremoto (linha de 500 m)', 4, { unidade: 'km²' }),
        ],
      };
    case 'protecao_divina':
      return {
        pvPorNivel: 500,
        usosPorNivel: 1,
        efeitos: [
          efeito('imunidade_rodadas', 'Imunidade total', 1, { unidade: 'rodadas por dia' }),
          efeito('vigor', 'Rolagem de vigor lugânico', 1, { aCada: 2 }),
          // Regra da mesa (confirmada pelo jogador): 200 de absorção POR PONTO (400 no nível 2).
          efeito('absorcao_area', 'Absorção de dano no cenário e nos envolvidos', 200, { unidade: 'de dano' }),
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
          // Livro: +50 por ponto contra divinos.
          efeito('dano_divinos', 'Dano extra em ataques diretos contra divinos', 50),
        ],
      };
    default:
      return undefined;
  }
}

/**
 * Descrições dos poderes com marcadores vivos (`{poder.<id>.<efeito>}`): subir o poder ou o pilar muda todos os números citados.
 * Os textos antigos (com números fixos da planilha) são trocados pela migração só quando estão exatamente iguais; o que o jogador editou fica.
 */
const DESCRICOES_VIVAS: Record<string, string> = {
  portador_da_jikar:
    "+3d×100 em ataque e defesa; +1d no dano; inimigos só fazem 1 ataque contra o portador; mentira, ilusão e invisibilidade não o afetam; contra vários inimigos só metade ataca; aliados divinos em 3 km recebem +250 em ataque, defesa e dano; aliados não divinos recebem +100; a Jikar retorna pela vontade do dono.",
  velocidade_divina:
    "Dá {poder.velocidade_divina.acoes_velocidade} ação(ões) de velocidade contra outro Lugan. Contra seres não lugânicos, dá {poder.velocidade_divina.acoes_extras} ações extras. Deslocamento de {poder.velocidade_divina.velocidade_kmh} km/h.",
  lugan_da_batalha:
    "+{poder.lugan_da_batalha.ataque_armaBranca} em qualquer ataque; +{poder.lugan_da_batalha.defesa_esquivar} em qualquer defesa; +{poder.lugan_da_batalha.dano} no final do dano; pressão de cada ataque em {poder.lugan_da_batalha.pressao_km2} km².",
  golpe_devastador:
    "+{poder.golpe_devastador.dados_ataque}d×100 no ataque; +{poder.golpe_devastador.dados_dano}d no multiplicador de dano (com o ajuste fixo de −1d do golpe); pressão de {poder.golpe_devastador.pressao_km2} km²; atinge todos os divinos em {poder.golpe_devastador.raio_m} m do impacto; {poder.golpe_devastador.usos} usos por dia (sem pontos, custa {poder.golpe_devastador.custo_pv} PV).",
  campeao_do_combate_divino:
    "escolha a linha de arma da vida dele: Espada / Katana / Jikar; +{poder.campeao_do_combate_divino.ataque_armaBranca} nas rolagens de ataque usando essa arma; +{poder.campeao_do_combate_divino.defesa_aparar} nas rolagens de defesa usando essa arma; +{poder.campeao_do_combate_divino.dano} no dano físico com essa arma; pressão de ataque em {poder.campeao_do_combate_divino.pressao_km2} km².",
  forca_das_montanhas_divinas:
    "[+{poder.forca_das_montanhas_divinas.atributo_forca}] Força permanente; ataques que usam Força afetam {poder.forca_das_montanhas_divinas.raio_km2} km²; causar terremoto em linha de 500 m por {poder.forca_das_montanhas_divinas.terremoto_km2} km²; quem estiver no caminho testa Esquiva contra o ataque do Lugan; quem falhar sofre o dano.",
  protecao_divina:
    "{poder.protecao_divina.imunidade_rodadas} rodada(s) por dia de imunidade total a dano, divino ou não; +{poder.protecao_divina.pv_extra} PV extras; +{poder.protecao_divina.vigor} na rolagem de vigor lugânico; proteção de área em {poder.protecao_divina.raio_km2} km²; absorve {poder.protecao_divina.absorcao_area} de dano no cenário e em todos os envolvidos naquele ataque; pode escolher até {poder.protecao_divina.criaturas} criaturas por dia para proteger; essas criaturas recebem 2 barras de CD e +15 em ataque, defesa e perícias; bônus de +{poder.protecao_divina.anti_mental} para anular efeitos mentais divinos.",
  o_filho_de_hagashi:
    "protege Hagashi contra dano em área de {poder.o_filho_de_hagashi.area_km} km do reino; reduz {poder.o_filho_de_hagashi.protecao.porPonto} de dano por ponto, então {poder.o_filho_de_hagashi.protecao} de proteção territorial; vincula {poder.o_filho_de_hagashi.fieis} hagashianos fiéis; esses fiéis recebem proteção contra dano em área; fiéis ganham +{poder.o_filho_de_hagashi.bonus_fieis} em ataque e defesa quando Alexander desejar; esse bônus dura 8 horas e pode ser usado 1 vez a cada 24h; Alexander ganha +1 em ataque e defesa para cada 200 fiéis hagashianos; o dano dele aumenta +1 para cada 400 fiéis; a morte desses fiéis diminui esse poder.",
  lugan_completo:
    "voo de {poder.lugan_completo.voo_kmh} km/h; altura máxima de voo de {poder.lugan_completo.voo_altura_m} m; +{poder.lugan_completo.ataque_armaBranca} em qualquer ataque; +{poder.lugan_completo.defesa_esquivar} em qualquer defesa; +{poder.lugan_completo.dano} no dano; {poder.lugan_completo.acao_extra} ação(ões) extra(s) por velocidade; pressão de ataque em {poder.lugan_completo.pressao_m} m ao redor; bônus de +{poder.lugan_completo.anti_mental} para anular efeitos mentais divinos; comunicação com Kitaicos; seguidores fiéis: 1d × 1.000.",
  manipulador_de_tsu_real:
    "sua perícia vira Manipular Tsu Real; recebe +{poder.manipulador_de_tsu_real.ataque_magico} em Manipular Tsu Real; danos mágicos recebem +{poder.manipulador_de_tsu_real.dano_magico}; pode conjurar uma magia simultânea em {poder.manipulador_de_tsu_real.locais} locais de Kitai; se a magia for em alvo, pode atingir {poder.manipulador_de_tsu_real.alvos} alvos simultâneos; pode dar +{poder.manipulador_de_tsu_real.defesa_aliados} em def para companheiros Lugans.(nao ataca)",
  fogo_real:
    "Manipula fogo real em {poder.fogo_real.area_km2} km². Causa {poder.fogo_real.dano_rodada} dano/rodada. Contra divinos: ataques diretos recebem +{poder.fogo_real.dano_divinos} dano. Alvos de água sofrem ×1,5 dano. Não divinos são incinerados ou testam Esquiva para sofrer 1/4.",
};

/** Descrições antigas da planilha (números fixos), por id de poder. */
const DESCRICOES_ANTIGAS: Record<string, string> = {
  portador_da_jikar:
    "[+1d] dano; +3d×100 ataque/defesa. Inimigos só fazem 1 ataque contra você. Aliados 3 km: divinos +250; não divinos +100. Ignora mentira, ilusão e invisibilidade. Contra grupo, só metade pode te atacar. Jikar retorna à vontade.",
  velocidade_divina:
    "Dá uma ação de velocidade contra outro Lugan. Contra seres não lugânicos, dá três ações extras.",
  lugan_da_batalha:
    "+150 em qualquer ataque; +150 em qualquer defesa; +60 no final do dano",
  golpe_devastador:
    "4d×100 no ataque; 3d×100 no multiplicador de dano.",
  campeao_do_combate_divino:
    "escolha a linha de arma da vida dele: Espada / Katana / Jikar; +140 nas rolagens de ataque usando essa arma; +140 nas rolagens de defesa usando essa arma; +40 no dano físico com essa arma; pressão de ataque em 4 km².",
  forca_das_montanhas_divinas:
    "[+60] Força permanente; ataques que usam Força afetam 2 km²; causar terremoto em linha de 500 m por 4 km²; quem estiver no caminho testa Esquiva contra o ataque do Lugan; quem falhar sofre o dano.",
  protecao_divina:
    "1 rodada por dia de imunidade total a dano, divino ou não; +500 PV extras; proteção de área em 5 km²; absorve 200 de dano no cenário e em todos os envolvidos naquele ataque; pode escolher até 100 criaturas por dia para proteger; essas criaturas recebem 2 barras de CD e +15 em ataque, defesa e perícias; bônus de +150 para anular efeitos mentais divinos.",
  o_filho_de_hagashi:
    "protege Hagashi contra dano em área de 100 km do reino; reduz 350 de dano por ponto, então 1.400 de proteção territorial; vincula 32.000 hagashianos fiéis; esses fiéis recebem proteção contra dano em área; fiéis ganham +48 em ataque e defesa quando Alexander desejar; esse bônus dura 8 horas e pode ser usado 1 vez a cada 24h; Alexander ganha +1 em ataque e defesa para cada 200 fiéis hagashianos; o dano dele aumenta +1 para cada 400 fiéis; a morte desses fiéis diminui esse poder.",
  lugan_completo:
    "voo de 280 km/h; altura máxima de voo de 3.000 m; +60 em qualquer ataque; +60 em qualquer defesa; +20 no dano; pressão de ataque em 1 km ao redor; bônus de +200 para anular efeitos mentais divinos; comunicação com Kitaicos; seguidores fiéis: 1d × 1.000.",
  manipulador_de_tsu_real:
    "sua perícia vira Manipular Tsu Real; recebe +70 em Manipular Tsu Real; danos mágicos recebem +10; pode conjurar uma magia simultânea em 3 locais de Kitai; se a magia for em alvo, pode atingir 50 alvos simultâneos; pode dar +30 em def para companheiros Lugans.(nao ataca)",
  fogo_real:
    "Manipula fogo real em 2 km². Causa 400 dano/rodada. Contra divinos: ataques diretos recebem +200 dano. Alvos de água sofrem ×1,5 dano. Não divinos são incinerados ou testam Esquiva para sofrer 1/4.",
};

/** Descrição viva do poder conhecido; nulo se o id não tem texto padrão. */
export const descricaoPadrao = (id: string): string | null => DESCRICOES_VIVAS[id] ?? null;

/** A descrição é a antiga da planilha (números fixos) do poder conhecido: pode ser trocada pela viva sem perder edição do jogador. */
export const ehDescricaoAntiga = (id: string, descricao: string): boolean => DESCRICOES_ANTIGAS[id] === descricao;
