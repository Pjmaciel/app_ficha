import { describe, expect, it } from 'vitest';
import antiga from '../fixtures/alexsander-v2-sem-escala.json';
import dados from '../../src/data/alexsander.json';
import {
  aplicarPilar,
  combate,
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
  pvTotal,
  resolverTexto,
  resumoBatalha,
  subirPilar,
  testeDragaoVermelho,
  totalAtributoFicha,
  usosPorDiaDoPoder,
} from '../../src/engine';
import { exportarJson, importarJson } from '../../src/import';
import { PACOTE_JUSTICA } from '../../src/model/pilar-padrao';
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

/** Nível de cada poder do pacote no pilar 3 (a ficha atual) e no pilar 4. */
const NIVEIS_3: Record<string, number> = {
  lugan_completo: 1, protecao_divina: 2, campeao_do_combate_divino: 3, o_filho_de_hagashi: 4, lugan_da_batalha: 3,
  forca_das_montanhas_divinas: 1, golpe_devastador: 3, manipulador_de_tsu_real: 1, fogo_real: 2,
};
const NIVEIS_4: Record<string, number> = {
  lugan_completo: 3, protecao_divina: 3, campeao_do_combate_divino: 5, o_filho_de_hagashi: 8, lugan_da_batalha: 4,
  forca_das_montanhas_divinas: 2, golpe_devastador: 4, manipulador_de_tsu_real: 2, fogo_real: 4,
};

describe('semente do pilar', () => {
  it('a ficha embutida traz Justiça 3 com nivelAplicado 3, o pacote do livro e nenhum ponto do pilar', () => {
    const f = clonar();
    expect(f.revisaoDados).toBe(5);
    expect(f.pilar).toMatchObject({ nome: 'Justiça', nivel: 3, nivelAplicado: 3, pacotePorNivel: PACOTE_JUSTICA });
    expect('pilarLuganico' in f.identidade || 'pilarNivel' in f.identidade).toBe(false);
    for (const p of f.poderes) {
      expect(p.pontosProprios).toBe(p.nivel);
      expect(pontosDoPilar(f, p)).toBe(0);
      expect(p.pontosDoPilar).toBe(0);
    }
    for (const [id, nivel] of Object.entries(NIVEIS_3)) expect(nivelDe(f, id)).toBe(nivel);
  });

  it('os valores atuais ficam como antes (combate, Força, PV, dano, usos)', () => {
    const f = aplicarPilar(clonar());
    expect(totais(f)).toEqual([1078, 781, 688, 688, 540, 941, 1094]);
    expect(totalAtributoFicha(f, 'forca')).toBe(322);
    expect(pvTotal(f)).toBe(3904);
    expect(dano(f).texto).toBe('3d×322 +120');
    expect(usosPorDiaDoPoder(poder(f, 'protecao_divina'))).toBe(2);
    expect(fieisSugeridos(f)).toBe(32000);
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

  it('concede o pacote a todos os poderes e recalcula os níveis', () => {
    for (const [id, nivel] of Object.entries(NIVEIS_4)) {
      expect(nivelDe(f4, id)).toBe(nivel);
      expect(pontosDoPilar(f4, poder(f4, id))).toBe(PACOTE_JUSTICA[id]);
      expect(poder(f4, id).pontosProprios).toBe(NIVEIS_3[id]);
    }
    expect(nivelDe(f4, 'portador_da_jikar')).toBeNull();
    expect(nivelDe(f4, 'velocidade_divina')).toBe(2);
  });

  it('Proteção Divina 2→3: PV 3904→4404, usos 3 e o patamar contra Tsu real é atingido', () => {
    expect(pvTotal(f3)).toBe(3904);
    // Só a Proteção Divina soma PV (500 por nível); a Fortitude não muda com o pilar.
    expect(pvTotal(f4)).toBe(4404);
    expect(usosPorDiaDoPoder(poder(f3, 'protecao_divina'))).toBe(2);
    expect(usosPorDiaDoPoder(poder(f4, 'protecao_divina'))).toBe(3);
    const antes = patamaresDoPoder(f3, poder(f3, 'protecao_divina'));
    expect(antes.atingidos).toHaveLength(0);
    expect(antes.proximo?.nivel).toBe(3);
    const depois = patamaresDoPoder(f4, poder(f4, 'protecao_divina'));
    expect(depois.atingidos.map((x) => x.nivel)).toEqual([3]);
    expect(depois.atingidos[0].texto).toContain('reduzir a Tsu real');
    expect(depois.proximo?.nivel).toBe(6);
  });

  it('Lugan da Batalha 3→4: +50 no ataque com arma branca; Campeão 3→5; Filho de Hagashi 4→8 (64.000 fiéis)', () => {
    const parcela = (f: Ficha, id: string) => fontesDerivadasCombate(f, 'ataqueArmaBranca').find((x) => x.poderId === id)?.valor;
    expect(parcela(f3, 'lugan_da_batalha')).toBe(150);
    expect(parcela(f4, 'lugan_da_batalha')).toBe(200);
    expect(parcela(f4, 'campeao_do_combate_divino')).toBe(350);
    expect(parcela(f4, 'lugan_completo')).toBe(90);
    // 1078 + 50 (Lugan da Batalha) + 140 (Campeão, +2 níveis) + 60 (Lugan Completo, +2 níveis).
    expect(combate(f4, 'ataqueArmaBranca').total).toBe(1328);
    expect(fieisSugeridos(f3)).toBe(32000);
    expect(fieisSugeridos(f4)).toBe(64000);
  });

  it('Força das Montanhas +60 e o golpe devastador ganha um ponto (usos e dados)', () => {
    expect(totalAtributoFicha(f4, 'forca')).toBe(322 + 60);
    expect(usosPorDiaDoPoder(poder(f4, 'golpe_devastador'))).toBe(4);
  });

  it('os textos vivos acompanham: a reação mental soma os novos anti-mentais', () => {
    const reacao = (f: Ficha) => resumoBatalha(f, novaSessao(f)).reacoes.find((r) => r.situacao.startsWith('Efeito mental'))!.resposta;
    expect(reacao(f3)).toContain('total +500');
    // Lugan Completo 3: 100 × 3 + 100 = 400; Proteção Divina 3: 150 × 3 = 450.
    expect(reacao(f4)).toContain('(+400)');
    expect(reacao(f4)).toContain('(+450)');
    expect(reacao(f4)).toContain('total +850');
  });

  it('a prévia lista os nove poderes que mudam e depois descer restaura tudo', () => {
    const previa = previaPilar(f3, 4);
    expect(previa).toHaveLength(9);
    expect(previa.find((x) => x.poderId === 'o_filho_de_hagashi')).toMatchObject({ de: 4, para: 8 });
    expect(previaPilar(f3, 3)).toEqual([]);
  });
});

describe('descer o pilar', () => {
  it('de 4 para 3 volta a todos os valores atuais (a ficha inteira é igual)', () => {
    const f3 = clonar();
    const volta = descerPilar(subirPilar(f3));
    expect(volta).toStrictEqual(f3);
    expect(totais(volta)).toEqual([1078, 781, 688, 688, 540, 941, 1094]);
    expect(pvTotal(volta)).toBe(3904);
  });

  it('de 3 para 2 retira o pacote: Proteção Divina 2→1 (PV 3404) e o nível nunca fica abaixo de 0', () => {
    const f2 = descerPilar(clonar());
    expect(nivelDe(f2, 'protecao_divina')).toBe(1);
    expect(pvTotal(f2)).toBe(3404);
    // Lugan Completo tem 1 ponto próprio e o pacote é 2: 1 − 2 = −1, mas o nível para em 0.
    expect(pontosDoPilar(f2, poder(f2, 'lugan_completo'))).toBe(-2);
    expect(nivelDe(f2, 'lugan_completo')).toBe(0);
    expect(combate(f2, 'ataqueArmaBranca').total).toBe(1078 - 50 - 140 - 30);
    for (const id of Object.keys(PACOTE_JUSTICA)) expect(nivelDe(f2, id)).toBeGreaterThanOrEqual(0);
    // Subir de novo devolve o poder ao valor de antes, porque os pontos próprios foram preservados.
    expect(nivelDe(subirPilar(f2), 'lugan_completo')).toBe(1);
  });

  it('no pilar 1 nenhum poder do pacote fica negativo', () => {
    const f1 = definirNivelPilar(clonar(), 1);
    for (const id of Object.keys(PACOTE_JUSTICA)) expect(nivelDe(f1, id)).toBeGreaterThanOrEqual(0);
    expect(pvTotal(f1)).toBe(3404 - 500);
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

describe('pontos próprios editáveis', () => {
  it('nível do poder = próprios + pilar; mudar os próprios recalcula', () => {
    const f = subirPilar(clonar());
    poder(f, 'lugan_da_batalha').pontosProprios = 5;
    aplicarPilar(f);
    expect(nivelDe(f, 'lugan_da_batalha')).toBe(6);
    expect(aplicarPilar(structuredClone(f))).toStrictEqual(f);
  });

  it('o pacote é editável: sem pacote, o poder não muda com o pilar; com pacote novo, muda', () => {
    const f = clonar();
    delete f.pilar.pacotePorNivel.fogo_real;
    f.pilar.pacotePorNivel.velocidade_divina = 1;
    const f4 = subirPilar(f);
    expect(nivelDe(f4, 'fogo_real')).toBe(2);
    expect(nivelDe(f4, 'velocidade_divina')).toBe(3);
  });

  it('a base (nivelAplicado) é editável: com base 2 no pilar 3, o pacote de um nível já vale', () => {
    const f = clonar();
    f.pilar.nivelAplicado = 2;
    aplicarPilar(f);
    expect(nivelDe(f, 'protecao_divina')).toBe(3);
  });

  it('poder sem pontosProprios (ficha montada à mão) recebe o nível declarado como total atual', () => {
    const f = clonar();
    for (const p of f.poderes) delete p.pontosProprios;
    aplicarPilar(f);
    expect(f.poderes.map((p) => p.pontosProprios)).toEqual(f.poderes.map((p) => p.nivel));
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
  it('a ficha salva antes do pilar com escala (nome e nível em identidade) vira o pilar sem mudar nenhum valor', () => {
    const bruta = structuredClone(antiga) as unknown as Ficha & { identidade: Record<string, unknown> };
    bruta.identidade.pilarNivel = 4;
    const f = migrarFicha(bruta);
    expect(f.pilar).toMatchObject({ nome: 'Justiça', nivel: 4, nivelAplicado: 4, pacotePorNivel: PACOTE_JUSTICA });
    expect('pilarLuganico' in f.identidade || 'pilarNivel' in f.identidade).toBe(false);
    // Com o pilar salvo em 4, os pontos atuais já refletem o pilar 4: nada muda; a partir dali, subir concede o pacote.
    for (const p of f.poderes) expect(pontosDoPilar(f, p)).toBe(0);
    expect(subirPilar(f).pilar.nivel).toBe(5);
    expect(nivelDe(subirPilar(f), 'protecao_divina')).toBe(nivelDe(f, 'protecao_divina')! + 1);
  });

  it('a migração da ficha da versão 1 traz o pilar 3 e os poderes com pontos próprios', () => {
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
    expect(f.pilar).toMatchObject({ nome: 'Justiça', nivel: 3, nivelAplicado: 3 });
    expect(f.poderes[0]).toMatchObject({ nivel: 2, pontosProprios: 2, pontosDoPilar: 0 });
    expect(nivelDe(subirPilar(f), 'protecao_divina')).toBe(3);
  });

  it('um pilar que não é o da Justiça começa sem pacote, efeitos nem textos', () => {
    const bruta = structuredClone(antiga) as unknown as Ficha & { identidade: Record<string, unknown> };
    bruta.identidade.pilarLuganico = 'Honra';
    const f = migrarFicha(bruta);
    expect(f.pilar).toEqual({ nome: 'Honra', nivel: 3, nivelAplicado: 3, pacotePorNivel: {}, efeitos: [], textos: [] });
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
    expect(nivelDe(volta, 'o_filho_de_hagashi')).toBe(8);
  });

  it('a importação valida o pilar', () => {
    const f = clonar();
    const com = (pilar: unknown) => JSON.stringify({ ...f, pilar });
    expect(() => importarJson(com([]))).toThrow(/pilar/);
    expect(() => importarJson(com({ ...f.pilar, nivelAplicado: 'x' }))).toThrow(/nivelAplicado/);
    expect(() => importarJson(com({ ...f.pilar, pacotePorNivel: { fogo_real: 'dois' } }))).toThrow(/pacotePorNivel/);
    expect(() => importarJson(com({ ...f.pilar, efeitos: [{ id: 'a.b', rotulo: 'x', porPonto: 1 }] }))).toThrow(/pilar com efeito inválido/);
    expect(() => importarJson(com({ ...f.pilar, textos: [1] }))).toThrow(/textos/);
    const poderes = f.poderes.map((p, i) => (i === 0 ? { ...p, pontosProprios: 'x' } : p));
    expect(() => importarJson(JSON.stringify({ ...f, poderes }))).toThrow(/pontosProprios/);
  });

  it('a ficha sem identidade.pilarLuganico e sem pilar é aceita (pilar sem nome)', () => {
    const { pilar: _, ...semPilar } = clonar();
    const f = importarJson(JSON.stringify(semPilar));
    expect(f.pilar).toMatchObject({ nome: '', nivel: 3, nivelAplicado: 3 });
  });
});
