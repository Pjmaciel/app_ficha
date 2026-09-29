import { describe, expect, it } from 'vitest';
import antiga from '../fixtures/alexsander-v2-sem-escala.json';
import dados from '../../src/data/alexsander.json';
import {
  aplicarPilar,
  combate,
  composicaoDoPoder,
  dano,
  definirNivelPilar,
  descerPilar,
  efeitosDoPilar,
  fieisSugeridos,
  fontesDerivadasCombate,
  marcadoresDisponiveis,
  marcadoresInvalidos,
  migrarFicha,
  novaSessao,
  patamaresDoPoder,
  pontosDoPilar,
  previaPilar,
  pvDaProtecaoDivina,
  pvTotal,
  resolverTexto,
  resumoBatalha,
  subirPilar,
  testeDragaoVermelho,
  totalAtributoFicha,
  usosPorDiaDoPoder,
} from '../../src/engine';
import { exportarJson, importarJson } from '../../src/import';
import { PACOTE_JUSTICA, SEMENTE_JUSTICA } from '../../src/model/pilar-padrao';
import type { ChaveCombate, Ficha, Poder } from '../../src/model/types';

const clonar = (): Ficha => structuredClone(dados) as unknown as Ficha;
const poder = (f: Ficha, id: string): Poder => {
  const p = f.poderes.find((x) => x.id === id);
  if (!p) throw new Error(`Poder ausente: ${id}`);
  return p;
};
const nivelDe = (f: Ficha, id: string): number | null => poder(f, id).nivel;

const CHAVES: ChaveCombate[] = ['ataqueArmaBranca', 'ataqueMagico', 'ataqueLuta', 'ataqueArmaFogo', 'esquivar', 'bloquear', 'aparar'];
const totais = (f: Ficha): number[] => CHAVES.map((c) => combate(f, c).total);

/**
 * Nível de cada poder do pacote no pilar 3 (a ficha atual), no 4 e no 2: valor base × nível do pilar + pontos livres
 * (docs/pilar-livres-requisitos.md). Os pontos livres da semente são 0, 1, 0, 0, 2, 0, 0, 0, 0 (na ordem abaixo).
 */
const NIVEIS_3: Record<string, number> = {
  lugan_completo: 6, protecao_divina: 4, campeao_do_combate_divino: 6, o_filho_de_hagashi: 12, lugan_da_batalha: 5,
  forca_das_montanhas_divinas: 3, golpe_devastador: 3, manipulador_de_tsu_real: 3, fogo_real: 6,
};
const NIVEIS_4: Record<string, number> = {
  lugan_completo: 8, protecao_divina: 5, campeao_do_combate_divino: 8, o_filho_de_hagashi: 16, lugan_da_batalha: 6,
  forca_das_montanhas_divinas: 4, golpe_devastador: 4, manipulador_de_tsu_real: 4, fogo_real: 8,
};
const NIVEIS_2: Record<string, number> = {
  lugan_completo: 4, protecao_divina: 3, campeao_do_combate_divino: 4, o_filho_de_hagashi: 8, lugan_da_batalha: 4,
  forca_das_montanhas_divinas: 2, golpe_devastador: 2, manipulador_de_tsu_real: 2, fogo_real: 4,
};

describe('semente do pilar', () => {
  it('a ficha embutida traz Justiça 3, o valor base do livro por poder e os pontos livres da semente', () => {
    const f = clonar();
    expect(f.revisaoDados).toBe(7);
    expect(f.pilar).toMatchObject({ nome: 'Justiça', nivel: 3, pacotePorNivel: PACOTE_JUSTICA });
    expect(f.pilar).not.toHaveProperty('nivelAplicado');
    expect('pilarLuganico' in f.identidade || 'pilarNivel' in f.identidade).toBe(false);
    for (const p of f.poderes) {
      expect(p).not.toHaveProperty('pontosProprios');
      expect(p).not.toHaveProperty('pontosDoPilar');
      expect(p.valorBasePilar).toBe(PACOTE_JUSTICA[p.id] ?? 0);
      if (p.nivel !== null) expect(p.nivel).toBe((p.valorBasePilar ?? 0) * 3 + (p.pontosLivres ?? 0));
    }
    for (const [id, nivel] of Object.entries(NIVEIS_3)) expect(nivelDe(f, id)).toBe(nivel);
  });

  it.each([
    // id, valor base do pilar, pontos livres, total no pilar 3
    ['lugan_completo', 2, 0, 6],
    ['protecao_divina', 1, 1, 4],
    ['campeao_do_combate_divino', 2, 0, 6],
    ['o_filho_de_hagashi', 4, 0, 12],
    ['lugan_da_batalha', 1, 2, 5],
    ['forca_das_montanhas_divinas', 1, 0, 3],
    ['golpe_devastador', 1, 0, 3],
    ['manipulador_de_tsu_real', 1, 0, 3],
    ['fogo_real', 2, 0, 6],
    ['velocidade_divina', 0, 2, 2],
  ])('semente: %s tem base %i, livres %i e total %i', (id, base, livres, total) => {
    const p = poder(clonar(), id);
    expect([p.valorBasePilar, p.pontosLivres, p.nivel]).toEqual([base, livres, total]);
    expect(SEMENTE_JUSTICA[id]).toEqual({ valorBasePilar: base, pontosLivres: livres });
  });

  it('origem: pacote para os poderes do pilar, livre para a Velocidade Divina e item para o Portador da Jikar (sem nível)', () => {
    const f = clonar();
    for (const id of Object.keys(PACOTE_JUSTICA)) expect(poder(f, id).origem).toBe('pilar');
    expect(poder(f, 'velocidade_divina').origem).toBe('livre');
    expect(poder(f, 'portador_da_jikar')).toMatchObject({ origem: 'item', tipo: 'item', nivel: null, pontosLivres: null });
    expect(poder(f, 'protecao_divina').tipo).toBe('defesa');
  });

  it('a composição do poder: "Lugan da Batalha 5 — Pilar: 1 × 3 = 3 · Poderes livres: +2 · Total: 5"', () => {
    const f = clonar();
    expect(composicaoDoPoder(f, poder(f, 'lugan_da_batalha')).texto).toBe('Lugan da Batalha 5 — Pilar: 1 × 3 = 3 · Poderes livres: +2 · Total: 5');
    expect(composicaoDoPoder(f, poder(f, 'lugan_completo')).texto).toBe('Lugan Completo 6 — Pilar: 2 × 3 = 6 · Poderes livres: +0 · Total: 6');
    expect(composicaoDoPoder(f, poder(f, 'velocidade_divina')).texto).toBe('Velocidade Divina 2 — Poderes livres: +2 · Total: 2');
    expect(composicaoDoPoder(f, poder(f, 'portador_da_jikar')).texto).toBe('Portador da Jikar — sem nível');
    const f4 = subirPilar(f);
    expect(composicaoDoPoder(f4, poder(f4, 'lugan_da_batalha')).texto).toBe('Lugan da Batalha 6 — Pilar: 1 × 4 = 4 · Poderes livres: +2 · Total: 6');
  });

  it('os valores atuais (combate, Força, PV, dano, usos) são os dos níveis finais', () => {
    const f = aplicarPilar(clonar());
    expect(totais(f)).toEqual([1578, 1141, 908, 908, 760, 1161, 1594]);
    expect(totalAtributoFicha(f, 'forca')).toBe(47 + 215 + 60 * 3);
    expect(totalAtributoFicha(f, 'forca')).toBe(442);
    expect(pvTotal(f)).toBe(242 * 12 + 500 * 4);
    expect(pvTotal(f)).toBe(4904);
    expect(pvDaProtecaoDivina(f)).toBe(2000);
    // O dano usa a Força nova no multiplicador; o fixo soma 20 × 5 (Lugan da Batalha), 20 × 6 (Campeão) e 10 × 6 (Lugan Completo).
    expect(dano(f).texto).toBe('3d×442 +280');
    expect(usosPorDiaDoPoder(poder(f, 'protecao_divina'))).toBe(4);
    expect(fieisSugeridos(f)).toBe(96000);
  });

  it('as escalas do livro valem por ponto, sem ajuste do mestre: ataque arma branca = perícia + 250 + 420 + 180 + Outros', () => {
    const f = clonar();
    expect(combate(f, 'ataqueArmaBranca').composicao.map((x) => x.valor)).toEqual([608, 250, 420, 180, 120]);
    expect(combate(f, 'aparar').composicao.map((x) => x.nome).filter((n) => n.startsWith('Ajuste'))).toEqual([]);
  });

  it('Proteção Divina 4: usos 4, imunidade 4 rodadas, raio 20 km², criaturas 400, anti-mental 600 e reduz a Tsu real com 1d', () => {
    const f = clonar();
    const d = resumoBatalha(f, novaSessao(f)).protecaoDivina!;
    expect(d).toMatchObject({
      nivel: 4, usosPorDia: 4, imunidadeRodadas: 4, pvExtra: 2000, absorcaoArea: 200, raioKm2: 20, criaturasProtegidas: 400,
      antiMental: 600, reduzTsuReal: true, reducaoTsuReal: '1d',
    });
    // Patamar 3 atingido; o próximo é o nível 6, com 1d+1.
    expect(d.proximaReducaoTsuReal).toEqual({ nivel: 6, dado: '1d+1' });
    expect(d.composicao).toBe('Proteção Divina 4 — Pilar: 1 × 3 = 3 · Poderes livres: +1 · Total: 4');
    const pv = resumoBatalha(f, novaSessao(f)).pv;
    expect(pv).toEqual({ atual: 4904, total: 4904, base: 2904, protecaoDivina: 2000, outros: 0 });
  });

  it('a Proteção Divina abaixo do nível 3 ainda não reduz a Tsu real; removida, o card some', () => {
    const f = clonar();
    poder(f, 'protecao_divina').nivel = 2;
    expect(resumoBatalha(f, novaSessao(f)).protecaoDivina).toMatchObject({ reduzTsuReal: false, reducaoTsuReal: null, proximaReducaoTsuReal: { nivel: 3, dado: '1d' } });
    poder(f, 'protecao_divina').tipo = 'removido';
    expect(resumoBatalha(f, novaSessao(f)).protecaoDivina).toBeNull();
  });

  it('os efeitos do pilar no nível 3: teste do Dragão Vermelho "2400 + 1d×400"', () => {
    const f = clonar();
    expect(efeitosDoPilar(f).find((e) => e.id === 'teste_dragao')?.valor).toBe(2400);
    expect(testeDragaoVermelho(f)).toEqual({ base: 2400, dado: 400, texto: '2400 + 1d×400' });
    expect(resumoBatalha(f, novaSessao(f)).pilar?.testeDragao).toBe('2400 + 1d×400');
  });
});

describe('subir o pilar de 3 para 4', () => {
  const f3 = clonar();
  const f4 = subirPilar(f3);

  it('não altera a ficha original e sobe o pilar', () => {
    expect(f3.pilar.nivel).toBe(3);
    expect(f4.pilar.nivel).toBe(4);
  });

  it('concede o pacote a todos os poderes e recalcula os níveis (valor base × 4 + livres)', () => {
    for (const [id, nivel] of Object.entries(NIVEIS_4)) {
      expect(nivelDe(f4, id)).toBe(nivel);
      expect(pontosDoPilar(f4, poder(f4, id))).toBe(PACOTE_JUSTICA[id] * 4);
      expect(poder(f4, id).pontosLivres).toBe(poder(f3, id).pontosLivres);
    }
    expect(nivelDe(f4, 'portador_da_jikar')).toBeNull();
    expect(nivelDe(f4, 'velocidade_divina')).toBe(2);
  });

  it('os pontos livres não mudam com o pilar (subir e descer)', () => {
    const livres = (f: Ficha) => f.poderes.map((p) => [p.id, p.pontosLivres]);
    expect(livres(f4)).toEqual(livres(f3));
    expect(livres(definirNivelPilar(f3, 2))).toEqual(livres(f3));
    expect(livres(definirNivelPilar(f3, 5))).toEqual(livres(f3));
  });

  it('Proteção Divina 4→5: PV 4904→5404, usos 5, raio 25 km², criaturas 500, anti-mental 750 e o patamar de Tsu real continua atingido', () => {
    expect(pvTotal(f3)).toBe(4904);
    // Só a Proteção Divina soma PV (500 por nível); a Fortitude não muda com o pilar.
    expect(pvTotal(f4)).toBe(2904 + 500 * 5);
    expect(usosPorDiaDoPoder(poder(f3, 'protecao_divina'))).toBe(4);
    expect(usosPorDiaDoPoder(poder(f4, 'protecao_divina'))).toBe(5);
    const d4 = resumoBatalha(f4, novaSessao(f4)).protecaoDivina!;
    expect(d4).toMatchObject({ nivel: 5, raioKm2: 25, criaturasProtegidas: 500, antiMental: 750, reduzTsuReal: true, reducaoTsuReal: '1d' });
    const antes = patamaresDoPoder(f3, poder(f3, 'protecao_divina'));
    expect(antes.atingidos.map((x) => x.nivel)).toEqual([3]);
    expect(antes.proximo?.nivel).toBe(6);
    const depois = patamaresDoPoder(f4, poder(f4, 'protecao_divina'));
    expect(depois.atingidos[0].texto).toContain('reduzir a Tsu real');
    expect(depois.proximo?.nivel).toBe(6);
  });

  it('Lugan da Batalha 5→6: +50 no ataque com arma branca; Campeão 6→8; Filho de Hagashi 12→16 (128.000 fiéis)', () => {
    const parcela = (f: Ficha, id: string) => fontesDerivadasCombate(f, 'ataqueArmaBranca').find((x) => x.poderId === id)?.valor;
    expect(parcela(f3, 'lugan_da_batalha')).toBe(250);
    expect(parcela(f4, 'lugan_da_batalha')).toBe(300);
    expect(parcela(f4, 'campeao_do_combate_divino')).toBe(560);
    expect(parcela(f4, 'lugan_completo')).toBe(240);
    // 1578 + 50 (Lugan da Batalha, +1) + 140 (Campeão, +2) + 60 (Lugan Completo, +2).
    expect(combate(f4, 'ataqueArmaBranca').total).toBe(1828);
    expect(fieisSugeridos(f3)).toBe(96000);
    expect(fieisSugeridos(f4)).toBe(128000);
  });

  it('Força das Montanhas +60 e o golpe devastador ganha um ponto (usos e dados)', () => {
    expect(totalAtributoFicha(f4, 'forca')).toBe(442 + 60);
    expect(usosPorDiaDoPoder(poder(f4, 'golpe_devastador'))).toBe(4);
  });

  it('os textos vivos acompanham: a reação mental soma os novos anti-mentais', () => {
    const reacao = (f: Ficha) => resumoBatalha(f, novaSessao(f)).reacoes.find((r) => r.situacao.startsWith('Efeito mental'))!.resposta;
    expect(reacao(f3)).toContain('total +1.200');
    // Lugan Completo 8: 100 × 8 = 800; Proteção Divina 5: 150 × 5 = 750.
    expect(reacao(f4)).toContain('(+800)');
    expect(reacao(f4)).toContain('(+750)');
    expect(reacao(f4)).toContain('total +1.550');
  });

  it('a prévia lista os nove poderes que mudam e depois descer restaura tudo', () => {
    const previa = previaPilar(f3, 4);
    expect(previa).toHaveLength(9);
    expect(previa.find((x) => x.poderId === 'o_filho_de_hagashi')).toMatchObject({ de: 12, para: 16 });
    expect(previaPilar(f3, 3)).toEqual([]);
  });
});

describe('descer o pilar', () => {
  it('de 4 para 3 volta a todos os valores atuais (a ficha inteira é igual)', () => {
    const f3 = clonar();
    const volta = descerPilar(subirPilar(f3));
    expect(volta).toStrictEqual(f3);
    expect(totais(volta)).toEqual([1578, 1141, 908, 908, 760, 1161, 1594]);
    expect(pvTotal(volta)).toBe(4904);
  });

  it('de 3 para 2 retira o pacote: níveis do pilar 2, Proteção Divina 4→3 (PV 4404) e os livres intactos', () => {
    const f3 = clonar();
    const f2 = descerPilar(f3);
    for (const [id, nivel] of Object.entries(NIVEIS_2)) expect(nivelDe(f2, id)).toBe(nivel);
    expect(nivelDe(f2, 'protecao_divina')).toBe(3);
    expect(pvTotal(f2)).toBe(2904 + 500 * 3);
    expect(pontosDoPilar(f2, poder(f2, 'lugan_completo'))).toBe(4);
    // 1578 − 50 (Lugan da Batalha) − 140 (Campeão) − 60 (Lugan Completo).
    expect(combate(f2, 'ataqueArmaBranca').total).toBe(1578 - 50 - 140 - 60);
    expect(f2.poderes.map((p) => p.pontosLivres)).toEqual(f3.poderes.map((p) => p.pontosLivres));
    expect(nivelDe(subirPilar(f2), 'lugan_completo')).toBe(6);
  });

  it('o nível nunca fica abaixo de 0, mesmo com pontos livres negativos (realocação)', () => {
    const f = clonar();
    poder(f, 'lugan_completo').pontosLivres = -10;
    aplicarPilar(f);
    expect(nivelDe(f, 'lugan_completo')).toBe(0);
    expect(nivelDe(definirNivelPilar(f, 5), 'lugan_completo')).toBe(0);
  });

  it('no pilar 1 os poderes do pacote valem só o valor base + livres', () => {
    const f1 = definirNivelPilar(clonar(), 1);
    for (const id of Object.keys(PACOTE_JUSTICA)) expect(nivelDe(f1, id)).toBe(PACOTE_JUSTICA[id] + (poder(f1, id).pontosLivres ?? 0));
    expect(pvTotal(f1)).toBe(2904 + 500 * 2);
  });
});

describe('limites do pilar', () => {
  it('nunca abaixo de 1 nem acima de 5', () => {
    const f = clonar();
    expect(definirNivelPilar(f, 0).pilar.nivel).toBe(1);
    expect(definirNivelPilar(f, -7).pilar.nivel).toBe(1);
    expect(definirNivelPilar(f, 9).pilar.nivel).toBe(5);
    expect(definirNivelPilar(f, 3.6).pilar.nivel).toBe(4);
    let x = f;
    for (let i = 0; i < 10; i++) x = subirPilar(x);
    expect(x.pilar.nivel).toBe(5);
    expect(subirPilar(x)).toStrictEqual(x);
    for (let i = 0; i < 10; i++) x = descerPilar(x);
    expect(x.pilar.nivel).toBe(1);
    expect(descerPilar(x)).toStrictEqual(x);
  });

  it('a migração limita um nível fora do intervalo', () => {
    const f = clonar();
    f.pilar.nivel = 9;
    expect(migrarFicha(f).pilar.nivel).toBe(5);
    f.pilar.nivel = 0;
    expect(migrarFicha(f).pilar.nivel).toBe(1);
  });
});

describe('pontos livres e valor base editáveis', () => {
  it('nível do poder = valor base × pilar + livres; mudar os livres recalcula', () => {
    const f = subirPilar(clonar());
    poder(f, 'lugan_da_batalha').pontosLivres = 5;
    aplicarPilar(f);
    expect(nivelDe(f, 'lugan_da_batalha')).toBe(1 * 4 + 5);
    expect(aplicarPilar(structuredClone(f))).toStrictEqual(f);
  });

  it('o valor base é editável: sem pacote o poder perde a parte do pilar e fica só com os livres; com pacote novo, cresce com o pilar', () => {
    const f = clonar();
    delete f.pilar.pacotePorNivel.fogo_real;
    f.pilar.pacotePorNivel.velocidade_divina = 1;
    const f4 = subirPilar(f);
    expect(nivelDe(f4, 'fogo_real')).toBe(0);
    expect(poder(f4, 'fogo_real').valorBasePilar).toBe(0);
    expect(nivelDe(f4, 'velocidade_divina')).toBe(1 * 4 + 2);
    expect(poder(f4, 'velocidade_divina').valorBasePilar).toBe(1);
  });

  it('poder sem pontosLivres (ficha montada à mão) recebe os livres que preservam o nível declarado', () => {
    const f = clonar();
    const antes = f.poderes.map((p) => p.nivel);
    for (const p of f.poderes) delete p.pontosLivres;
    aplicarPilar(f);
    expect(f.poderes.map((p) => p.nivel)).toEqual(antes);
    expect(poder(f, 'lugan_da_batalha').pontosLivres).toBe(2);
    expect(poder(f, 'portador_da_jikar').pontosLivres).toBeNull();
  });

  it('poder criado à mão (origem manual, sem pacote): o nível é os livres e não muda com o pilar', () => {
    const f = clonar();
    f.poderes.push({ id: 'novo', nome: 'Novo', nivel: null, pontosLivres: 3, origem: 'manual', tipo: 'passivo', descricao: '' });
    expect(nivelDe(aplicarPilar(f), 'novo')).toBe(3);
    expect(nivelDe(subirPilar(f), 'novo')).toBe(3);
    expect(poder(f, 'novo').origem).toBe('manual');
  });
});

describe('textos vivos do pilar', () => {
  it('{pilar.nivel} e {pilar.<efeito>} resolvem no nível atual, sem separador de milhar', () => {
    const f = clonar();
    expect(resolverTexto(f, 'nível {pilar.nivel}: {pilar.teste_dragao} + 1d×{pilar.teste_dado}')).toBe('nível 3: 2400 + 1d×400');
    expect(resolverTexto(subirPilar(f), '{pilar.teste_dragao}')).toBe('3200');
    expect(resolverTexto(definirNivelPilar(f, 5), '{pilar.teste_dragao}')).toBe('4000');
    expect(resolverTexto(f, '{pilar.teste_dragao.porPonto}')).toBe('800');
  });

  it('marcador do pilar desconhecido fica cru e é apontado como inválido', () => {
    const f = clonar();
    expect(resolverTexto(f, '{pilar.inexistente}')).toBe('{pilar.inexistente}');
    expect(marcadoresInvalidos(f, '{pilar.inexistente} {pilar.nivel}')).toEqual(['{pilar.inexistente}']);
  });

  it('os marcadores disponíveis incluem os do pilar', () => {
    const marcadores = marcadoresDisponiveis(clonar()).map((m) => m.marcador);
    expect(marcadores).toContain('{pilar.nivel}');
    expect(marcadores).toContain('{pilar.teste_dragao}');
  });
});

describe('card do pilar na aba Batalha', () => {
  it('"Pilar da Justiça nível 3" com Jikar, Ancestrais, Dragão Vermelho (teste calculado) e os redutores por 5 h', () => {
    const f = clonar();
    const pilar = resumoBatalha(f, novaSessao(f)).pilar!;
    expect(pilar.titulo).toBe('Pilar da Justiça nível 3');
    expect(pilar.nivel).toBe(3);
    expect(pilar.testeDragao).toBe('2400 + 1d×400');
    expect(pilar.textos).toHaveLength(4);
    expect(pilar.textos[0]).toContain('Jikar');
    expect(pilar.textos[1]).toContain('Ancestrais da Justiça');
    expect(pilar.textos[1]).toContain('2000 samurais');
    expect(pilar.textos[2]).toContain('Proteção do Dragão Vermelho');
    expect(pilar.textos[2]).toContain('nível do pilar (3) × 800 + 1d×400');
    expect(pilar.textos[3]).toContain('por mais 5 h');
    expect(pilar.textos[3]).toContain('−400');
    expect(pilar.textos[3]).toContain('−2');
    expect(pilar.textos.join(' ')).not.toMatch(/[{}]/);
  });

  it('subir o pilar muda o título e o teste (nível 4: "3200 + 1d×400")', () => {
    const f = subirPilar(clonar());
    const pilar = resumoBatalha(f, novaSessao(f)).pilar!;
    expect(pilar.titulo).toBe('Pilar da Justiça nível 4');
    expect(pilar.testeDragao).toBe('3200 + 1d×400');
    expect(pilar.textos[2]).toContain('nível do pilar (4) × 800');
  });

  it('pilar sem textos nem efeitos não gera card; sem nome o título é "Pilar nível N"', () => {
    const f = clonar();
    f.pilar.nome = '';
    expect(resumoBatalha(f, novaSessao(f)).pilar?.titulo).toBe('Pilar nível 3');
    f.pilar.textos = [];
    f.pilar.efeitos = [];
    expect(resumoBatalha(f, novaSessao(f)).pilar).toBeNull();
    expect(testeDragaoVermelho(f)).toBeNull();
  });
});

describe('migração e importação do pilar', () => {
  it('a ficha salva antes do pilar com escala (nome e nível em identidade) vira o pilar com os níveis da semente', () => {
    const bruta = structuredClone(antiga) as unknown as Ficha & { identidade: Record<string, unknown> };
    bruta.identidade.pilarNivel = 4;
    const f = migrarFicha(bruta);
    expect(f.pilar).toMatchObject({ nome: 'Justiça', nivel: 4, pacotePorNivel: PACOTE_JUSTICA });
    expect(f.pilar).not.toHaveProperty('nivelAplicado');
    expect('pilarLuganico' in f.identidade || 'pilarNivel' in f.identidade).toBe(false);
    // Com o pilar salvo em 4, os níveis são valor base × 4 + livres da semente; subir concede o pacote de novo.
    for (const id of Object.keys(PACOTE_JUSTICA)) expect(nivelDe(f, id)).toBe(PACOTE_JUSTICA[id] * 4 + (poder(f, id).pontosLivres ?? 0));
    expect(nivelDe(f, 'protecao_divina')).toBe(1 * 4 + 1);
    expect(nivelDe(subirPilar(f), 'protecao_divina')).toBe(nivelDe(f, 'protecao_divina')! + 1);
  });

  it('a ficha salva na revisão 5 (pontosProprios, pontosDoPilar, nivelAplicado, tipo defensivo e ajustes do mestre) migra para a revisão atual', () => {
    const niveisAntigos: Record<string, number | null> = {
      velocidade_divina: 2, lugan_da_batalha: 3, golpe_devastador: 3, portador_da_jikar: null, campeao_do_combate_divino: 3,
      forca_das_montanhas_divinas: 1, protecao_divina: 2, o_filho_de_hagashi: 4, lugan_completo: 1, manipulador_de_tsu_real: 1, fogo_real: 2,
    };
    const salva = clonar() as unknown as { pilar: Record<string, unknown>; poderes: Record<string, unknown>[]; revisaoDados: number } & Ficha;
    salva.revisaoDados = 5;
    salva.pilar.nivelAplicado = 3;
    for (const p of salva.poderes) {
      const antigo = niveisAntigos[p.id as string];
      p.nivel = antigo;
      p.pontosProprios = antigo;
      p.pontosDoPilar = 0;
      delete p.pontosLivres;
      delete p.valorBasePilar;
      delete p.origem;
      if (p.tipo === 'defesa') (p as { tipo: string }).tipo = 'defensivo';
    }
    salva.combate.ataqueArmaBranca.fontes.push({ nome: 'Ajuste do mestre (Lugan Completo)', valor: 30 });
    salva.dano.fixos.push({ nome: 'Ajuste do mestre (Campeão do Combate Divino)', valor: -20 });
    const f = migrarFicha(salva);
    expect(f).toStrictEqual({ ...clonar(), revisaoDados: 5 });
    expect(poder(f, 'protecao_divina')).toMatchObject({ tipo: 'defesa', nivel: 4, pontosLivres: 1 });
  });

  it('a migração da ficha da versão 1 traz o pilar 3 e os poderes com pontos livres da semente', () => {
    const v1 = {
      versao: 1,
      identidade: { nome: 'T', jogador: 'J', raca: 'R', reino: 'K', pilarLuganico: 'Justiça', nivel: 41, nivelLuganico: 3, basePv: 12 },
      pontosIniciais: 1018,
      atributos: Object.fromEntries(['forca', 'agilidade', 'reflexos', 'fortitude', 'distancia', 'mental']
        .map((id) => [id, { bonus: 47, pontos: 100, bonusExtra: 0 }])),
      pericias: (antiga as unknown as Ficha).pericias,
      combate: { bonusPassivo: Object.fromEntries(CHAVES.map((c) => [c, 50])) },
      poderes: [{ id: 'protecao_divina', nome: 'Proteção Divina', nivel: 2, descricao: '' }],
      tsu: [],
      xp: { total: 0, atual: 0 },
    };
    const f = migrarFicha(v1);
    expect(f.pilar).toMatchObject({ nome: 'Justiça', nivel: 3 });
    expect(f.poderes[0]).toMatchObject({ nivel: 4, pontosLivres: 1, valorBasePilar: 1, origem: 'pilar' });
    expect(nivelDe(subirPilar(f), 'protecao_divina')).toBe(5);
  });

  it('um pilar que não é o da Justiça começa sem pacote, efeitos nem textos', () => {
    const bruta = structuredClone(antiga) as unknown as Ficha & { identidade: Record<string, unknown> };
    bruta.identidade.pilarLuganico = 'Honra';
    const f = migrarFicha(bruta);
    expect(f.pilar).toEqual({ nome: 'Honra', nivel: 3, pacotePorNivel: {}, efeitos: [], textos: [] });
    // Sem semente do pilar, os pontos livres preservam o nível salvo.
    expect(poder(f, 'protecao_divina')).toMatchObject({ nivel: 1, pontosLivres: 1, valorBasePilar: 0, origem: 'livre' });
    expect(nivelDe(subirPilar(f), 'protecao_divina')).toBe(nivelDe(f, 'protecao_divina'));
    expect(resumoBatalha(f, novaSessao(f)).pilar).toBeNull();
  });

  it('a migração de um pilar salvo completa só o que falta', () => {
    const f = clonar();
    const { textos: _t, efeitos: _e, ...parcial } = f.pilar;
    const migrada = migrarFicha({ ...f, pilar: { ...parcial, pacotePorNivel: { fogo_real: 5 } } });
    expect(migrada.pilar.pacotePorNivel).toEqual({ fogo_real: 5 });
    expect(migrada.pilar.textos).toHaveLength(4);
    expect(migrada.pilar.efeitos.length).toBeGreaterThan(0);
  });

  it('a ida e volta em JSON preserva o pilar e os pontos dos poderes', () => {
    const f = subirPilar(clonar());
    const volta = importarJson(exportarJson(f));
    expect(volta).toStrictEqual(f);
    expect(volta.pilar.nivel).toBe(4);
    expect(nivelDe(volta, 'o_filho_de_hagashi')).toBe(16);
  });

  it('a importação valida o pilar', () => {
    const f = clonar();
    const com = (pilar: unknown) => JSON.stringify({ ...f, pilar });
    expect(() => importarJson(com([]))).toThrow(/pilar/);
    expect(() => importarJson(com({ ...f.pilar, nivelAplicado: 'x' }))).toThrow(/nivelAplicado/);
    expect(importarJson(com({ ...f.pilar, nivelAplicado: 3 })).pilar).not.toHaveProperty('nivelAplicado');
    expect(() => importarJson(com({ ...f.pilar, pacotePorNivel: { fogo_real: 'dois' } }))).toThrow(/pacotePorNivel/);
    expect(() => importarJson(com({ ...f.pilar, efeitos: [{ id: 'a.b', rotulo: 'x', porPonto: 1 }] }))).toThrow(/pilar com efeito inválido/);
    expect(() => importarJson(com({ ...f.pilar, textos: [1] }))).toThrow(/textos/);
    const com1 = (extra: Record<string, unknown>) => JSON.stringify({ ...f, poderes: f.poderes.map((p, i) => (i === 0 ? { ...p, ...extra } : p)) });
    expect(() => importarJson(com1({ pontosProprios: 'x' }))).toThrow(/pontosProprios/);
    expect(() => importarJson(com1({ pontosLivres: 'x' }))).toThrow(/pontosLivres/);
    expect(() => importarJson(com1({ valorBasePilar: 'x' }))).toThrow(/valorBasePilar/);
    expect(() => importarJson(com1({ origem: 'sorte' }))).toThrow(/origem/);
    expect(() => importarJson(com1({ tipo: 'magico' }))).toThrow(/tipo/);
    expect(importarJson(com1({ tipo: 'recurso' })).poderes[0].tipo).toBe('recurso');
    expect(importarJson(com1({ tipo: 'defensivo' })).poderes[0].tipo).toBe('defesa');
  });

  it('a ficha sem identidade.pilarLuganico e sem pilar é aceita (pilar sem nome)', () => {
    const { pilar: _, ...semPilar } = clonar();
    const f = importarJson(JSON.stringify(semPilar));
    expect(f.pilar).toMatchObject({ nome: '', nivel: 3 });
  });
});

describe('descrições vivas dos poderes', () => {
  const descricao = (f: Ficha, id: string): string => resolverTexto(f, poder(f, id).descricao);

  it('nenhuma descrição da ficha embutida tem marcador sem resolver e as de escala não trazem os números antigos', () => {
    const f = clonar();
    for (const p of f.poderes) expect(marcadoresInvalidos(f, p.descricao)).toEqual([]);
    expect(descricao(f, 'lugan_da_batalha')).not.toMatch(/[{}]/);
    expect(poder(f, 'lugan_da_batalha').descricao).toContain('{poder.lugan_da_batalha.ataque_armaBranca}');
  });

  it('Lugan da Batalha (nível 5) cita +250 nos ataques, +250 nas defesas e +100 no dano; no pilar 4 (nível 6), +300 e +120', () => {
    const f = clonar();
    expect(descricao(f, 'lugan_da_batalha')).toBe(
      '+250 em qualquer ataque; +250 em qualquer defesa; +100 no final do dano; pressão de cada ataque em 5 km².');
    const f4 = subirPilar(f);
    expect(descricao(f4, 'lugan_da_batalha')).toBe(
      '+300 em qualquer ataque; +300 em qualquer defesa; +120 no final do dano; pressão de cada ataque em 6 km².');
  });

  it('Proteção Divina (nível 4) cita +2.000 PV extras e 4 rodadas por dia; no pilar 4, +2.500 PV e 5 rodadas', () => {
    const f = clonar();
    const d = descricao(f, 'protecao_divina');
    expect(d).toContain('4 rodada(s) por dia de imunidade');
    expect(d).toContain('+2.000 PV extras');
    expect(d).toContain('proteção de área em 20 km²');
    expect(d).toContain('até 400 criaturas');
    expect(d).toContain('bônus de +600 para anular');
    const d4 = descricao(subirPilar(f), 'protecao_divina');
    expect(d4).toContain('5 rodada(s)');
    expect(d4).toContain('+2.500 PV extras');
  });

  it('as demais descrições acompanham o nível: Lugan Completo, Campeão, Força, Golpe, Filho, Manipulador e Fogo Real', () => {
    const f = clonar();
    expect(descricao(f, 'lugan_completo')).toContain('voo de 840 km/h');
    expect(descricao(f, 'lugan_completo')).toContain('+180 em qualquer ataque');
    expect(descricao(f, 'lugan_completo')).toContain('bônus de +600');
    expect(descricao(f, 'campeao_do_combate_divino')).toContain('+420 nas rolagens de ataque');
    expect(descricao(f, 'campeao_do_combate_divino')).toContain('+120 no dano físico');
    expect(descricao(f, 'forca_das_montanhas_divinas')).toContain('[+180] Força permanente');
    expect(descricao(f, 'golpe_devastador')).toContain('+3d×100 no ataque');
    expect(descricao(f, 'golpe_devastador')).toContain('pressão de 24 km²');
    expect(descricao(f, 'o_filho_de_hagashi')).toContain('vincula 96.000 hagashianos');
    expect(descricao(f, 'manipulador_de_tsu_real')).toContain('+210 em Manipular Tsu Real');
    expect(descricao(f, 'fogo_real')).toContain('fogo real em 6 km²');
    expect(descricao(f, 'fogo_real')).toContain('+300 dano');
    expect(descricao(f, 'velocidade_divina')).toContain('Deslocamento de 440 km/h');
    // O Portador da Jikar é um item sem nível: texto qualitativo, sem marcadores.
    expect(poder(f, 'portador_da_jikar').descricao).not.toMatch(/[{}]/);
  });

  it('a descrição antiga da planilha é trocada na migração; a editada pelo jogador fica', () => {
    const salva = clonar();
    poder(salva, 'lugan_da_batalha').descricao = '+150 em qualquer ataque; +150 em qualquer defesa; +60 no final do dano';
    poder(salva, 'fogo_real').descricao = 'Minha descrição: 400 de dano.';
    const m = migrarFicha(salva);
    expect(poder(m, 'lugan_da_batalha').descricao).toContain('{poder.lugan_da_batalha.dano}');
    expect(poder(m, 'fogo_real').descricao).toBe('Minha descrição: 400 de dano.');
  });

  it('a aba Batalha traz a descrição do card resolvida (o texto cru só aparece na edição)', () => {
    const f = clonar();
    const card = resumoBatalha(f, novaSessao(f)).protecoes.find((p) => p.id === 'protecao_divina')!;
    expect(card.descricao).toContain('+2.000 PV extras');
    expect(card.descricao).not.toMatch(/[{}]/);
  });
});
