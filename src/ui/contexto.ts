// Contrato entre o esqueleto da aplicação e as abas.
import type { Ficha, Sessao } from '../model/types';

export interface Contexto {
  /** A ficha atual (a referência muda ao importar, restaurar ou subir de nível). */
  ficha(): Ficha;
  sessao(): Sessao;
  /** Persiste e recalcula todos os valores exibidos, sem recriar campos (mantém o foco). */
  mudou(): void;
  /** Roda a função agora e a cada mudança, enquanto a aba estiver aberta. Serve para totais e textos derivados. */
  ligar(atualizar: () => void): void;
  /** Recria a aba ativa (mudanças que alteram a estrutura ou os campos exibidos). */
  reconstruir(): void;
  /** Troca a ficha inteira; a sessão só é reiniciada quando pedido. */
  trocarFicha(nova: Ficha, reiniciarSessao?: boolean): void;
  avisar(texto: string): void;
  /** Composições abertas, lembradas entre recriações da aba. */
  composicoesAbertas: Set<string>;
}
