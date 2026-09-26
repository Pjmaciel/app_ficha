# Discovery — App de Ficha Kitai (Alexsander Somar III)

Data: 2026-09-26. Fonte: `Alexander Somar III/Alexsander Somar III.xlsx` (abas `FICHA` e `LUGAN`), livro base (`LIVRO KITAI FINAL .pdf`), suplemento `MAIS GLÓRIA E MAIS PODER DEFINITIVO.pdf` (regras lugânicas, p. 73-77).

## Dor declarada
"Estou cansado de ficar ajustando planilha no Excel." Personagem de nível 41 (planilha desatualizada indica 35; Lugan nível 3) com centenas de células e fórmulas por referência de célula.

## Comportamento observado na planilha
- Duas abas: `FICHA` (ficha de soberano, base pré-transformação, praticamente template: atributos 20, perícias 116) e `LUGAN` (ficha divina em uso real, nível 35).
- Atributos lugânicos = BÔNUS (23) + PONTOS distribuídos (1.018 pontos iniciais) + BÔNUS extra. Célula E13 controla o saldo de pontos.
- Perícias lugânicas = INICIAL (`FICHA!N*`, ficha de soberano) + ATRIBUTO governante + GRADUAÇÃO.
- Combate: ataques = perícia + bônus passivo 50 (Lugan da Batalha); Esquivar = Reflexos + 3 + 50; Aparar = Espada − Distância + Mental + 3 + 50.
- PV = Base PV (12) × Fortitude (218) = 2.616.
- Poderes lugânicos com descrição textual (Velocidade Divina, Lugan da Batalha, Golpe Devastador, Golpe Especial / Campeão das Nações com custos em Fadiga 10/25).
- Tsu: 6 elementos em 6; Terra é a Tsu real (×8 = 48).
- Rolagem: 1d×100 por bloco de 10 níveis divinos (livro p. 74); nível 41 rola 2d×100; o "3d×100" da planilha pertence ao poder Golpe Devastador.

## Defeitos da planilha (evidência da dor)
- Referências de célula frágeis e inconsistentes: perícias de CRIME apontam para `$K$29`, `$K$35`, `$K$39` (todas Mental por acidente de cópia); DISFARCE usa Reflexos na `FICHA` e Mental na `LUGAN`; `J87 = FICHA!N89`, `J88 = FICHA!N94` (linhas deslocadas).
- Aparar mistura Distância e Mental numa fórmula sem documentação.
- Nenhum controle de estado de sessão: PV atual, Fadiga gasta, usos de poder por dia, XP atual (`E4` vazio) não existem ou ficam em células soltas.
- Perícias duplicadas entre grupos (Escalar, Rastrear, Perceber, Disfarce, Criptografia, Armadilha, Corrida, Fuga) sem vínculo.

## Fora de escopo (v0.1)
- Multiusuário, mestre de mesa, campanha, mapa, monstros.
- Ficha de soberano (`FICHA`) editável: entra apenas como valores iniciais importados.
- Regras de outras classes; apenas o que a ficha do Alexsander usa.

## Restrições
- Uso na mesa: telefone/tablet e notebook, offline tolerável.
- Dados 100% locais do jogador; sem serviço externo obrigatório.
- Importar a planilha atual uma vez, sem retrabalho de digitação.

## Intenção v0.1 (proposta)
Motor de regras que substitui as fórmulas por código testado (atributos, perícias, combate, PV) + painel de sessão (PV atual, Fadiga, poderes/dia, rolagem Nd×100) + importador do `.xlsx` + exportação de backup em JSON.

## Decisões (2026-09-26)
- Hospedagem: GitHub Pages (somente estático). Logo o app é um PWA front-end puro; sem Rails, sem banco.
- Persistência: navegador (IndexedDB/localStorage) + exportar/importar JSON; backup do JSON no repositório.
- Nível do personagem: 41. Apenas classe Lugan. Cálculos validados contra os valores atuais da planilha (oráculo).
