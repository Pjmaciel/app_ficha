// Semente do pilar lugânico (docs/pilar-requisitos.md): pilar da Justiça do livro "MAIS GLÓRIA E MAIS PODER".
// Serve de semente para alexsander.json e para a migração de fichas salvas antes do pilar com escala existir;
// tudo continua editável (o pacote por nível na aba Poderes, os textos em "Textos da batalha").
import { PILAR_NIVEL_PADRAO } from './batalha-padrao';
import type { EfeitoEscalavel, Pilar } from './types';

export const PILAR_MIN = 1;
export const PILAR_MAX = 5;

/** Limita o nível do pilar ao intervalo do livro (1 a 5), arredondando; valor não numérico vira o padrão. */
export function limitarNivelPilar(nivel: number): number {
  if (!Number.isFinite(nivel)) return PILAR_NIVEL_PADRAO;
  return Math.max(PILAR_MIN, Math.min(PILAR_MAX, Math.round(nivel)));
}

/** "Poderes adicionais" do pilar da Justiça: pontos concedidos ao assumir e a cada nível que o pilar sobe. */
export const PACOTE_JUSTICA: Record<string, number> = {
  lugan_completo: 2,
  protecao_divina: 1,
  campeao_do_combate_divino: 2,
  o_filho_de_hagashi: 4,
  lugan_da_batalha: 1,
  forca_das_montanhas_divinas: 1,
  golpe_devastador: 1,
  manipulador_de_tsu_real: 1,
  fogo_real: 2,
};

const semAcento = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** O pilar é o da Justiça (o único com pacote, efeitos e textos do livro semeados). */
export const ehPilarJustica = (nome: string): boolean => semAcento(nome) === 'justica';

const efeito = (id: string, rotulo: string, porPonto: number, extra: Partial<EfeitoEscalavel> = {}): EfeitoEscalavel =>
  ({ id, rotulo, porPonto, ...extra });

/** Efeitos escaláveis do pilar da Justiça (valor = fixo + por ponto × nível do pilar). */
export function efeitosPilarJustica(): EfeitoEscalavel[] {
  return [
    // Livro: teste de nível do pilar × 800 + 1d × 400, sem dado mestre.
    efeito('teste_dragao', 'Teste da Proteção do Dragão Vermelho (parte fixa)', 800),
    efeito('teste_dado', 'Teste da Proteção do Dragão Vermelho (dado)', 0, { fixo: 400 }),
    efeito('ancestrais', 'Samurais antigos convocados', 0, { fixo: 2000, unidade: 'samurais' }),
    // Livro: ao usar poderes do pilar para proteger o povo, e por mais 5 horas.
    efeito('redutor_teste', 'Redutor em testes de perícia e combate', 0, { fixo: 400 }),
    efeito('redutor_dano', 'Redutor no dado de dano', 0, { fixo: 2 }),
    efeito('redutor_horas', 'Duração do redutor depois do uso', 0, { fixo: 5, unidade: 'h' }),
  ];
}

/** Textos do card "Pilar da Justiça nível N" (com marcadores vivos: subir o pilar muda o card). */
export function textosPilarJustica(): string[] {
  return [
    'Portador de Jikar: +1d no dano e +3d×100 no ataque e na defesa; inimigos só desferem 1 ataque contra você e, contra um grupo, só metade ataca; '
    + 'aliados divinos em 3 km recebem +250 e não divinos +100 em ataque, defesa e dano; mentira, ilusão e invisibilidade não atingem você; a Jikar retorna pela sua vontade.',
    'Ancestrais da Justiça: convoque em Kitai {pilar.ancestrais} samurais antigos de infantaria, todos de nível de personagem 20 e tropa de categoria 6.',
    'Proteção do Dragão Vermelho: quando um Lugan em Shidenji tenta usar um poder contra Hagashi, você sente e o impede com um teste de nível do pilar ({pilar.nivel}) × {pilar.teste_dragao.porPonto} '
    + '+ 1d×{pilar.teste_dado}, sem dado mestre, contra o nível do poder em dados × 100. Quem falhar fica 6d semanas sem tentar afetar Hagashi.',
    'Poderes do pilar usados para proteger o povo: durante o uso e por mais {pilar.redutor_horas} h, −{pilar.redutor_teste} em qualquer teste de perícia ou combate e −{pilar.redutor_dano} no dado de dano.',
  ];
}

/**
 * Pilar de partida: nome e nível dados. O da Justiça traz o pacote, os efeitos e os textos do livro; qualquer outro
 * começa sem pacote (o jogador o monta). `nivelAplicado` = nível, de modo que nenhum ponto de poder muda na criação.
 */
export function pilarPadrao(nome: string, nivel: number = PILAR_NIVEL_PADRAO): Pilar {
  const n = limitarNivelPilar(nivel);
  const justica = ehPilarJustica(nome);
  return {
    nome,
    nivel: n,
    nivelAplicado: n,
    pacotePorNivel: justica ? { ...PACOTE_JUSTICA } : {},
    efeitos: justica ? efeitosPilarJustica() : [],
    textos: justica ? textosPilarJustica() : [],
  };
}
