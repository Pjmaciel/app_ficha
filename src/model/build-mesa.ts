// Build do Alexsander pela regra da mesa (docs/regra-mesa-build-requisitos.md): o pilar não concede poderes; a ficha usa
// só poderes livres, itens e ajustes manuais. Serve de semente da migração das fichas salvas e da planilha importada.
import type { OrigemPoder, TipoPoder } from './types';

export interface PoderDaBuild { nivel: number | null; tipo: TipoPoder; origem: OrigemPoder }

/** Poderes ativos da build e os mantidos como `removido` (histórico, fora dos cálculos, com botão para reativar). */
export const BUILD_MESA: Record<string, PoderDaBuild> = {
  campeao_do_combate_divino: { nivel: 3, tipo: 'passivo', origem: 'livre' },
  lugan_da_batalha: { nivel: 1, tipo: 'passivo', origem: 'livre' },
  protecao_divina: { nivel: 2, tipo: 'defesa', origem: 'livre' },
  portador_da_jikar: { nivel: null, tipo: 'item', origem: 'item' },
  velocidade_divina: { nivel: 2, tipo: 'removido', origem: 'livre' },
  golpe_devastador: { nivel: 3, tipo: 'removido', origem: 'livre' },
  lugan_completo: { nivel: 1, tipo: 'removido', origem: 'livre' },
  forca_das_montanhas_divinas: { nivel: 1, tipo: 'removido', origem: 'livre' },
  o_filho_de_hagashi: { nivel: 4, tipo: 'removido', origem: 'livre' },
  manipulador_de_tsu_real: { nivel: 1, tipo: 'removido', origem: 'livre' },
  fogo_real: { nivel: 2, tipo: 'removido', origem: 'livre' },
};

/** Rótulo da build exibido no topo da aba Batalha. */
export const ROTULO_BUILD = 'Defesa com Jikar';
