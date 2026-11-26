# PlanNote

Caderno digital para Mac e Windows. Organize suas anotações em cadernos e folhas e acompanhe as datas das provas.

Sem conta, sem servidor e sem assinatura: seus cadernos ficam no seu computador, como arquivos comuns.

![Uma folha aberta no PlanNote](docs/screenshots/folha.png)

## Instalar

Baixe a versão mais recente na página de **[Releases](https://github.com/gabriellaRezende/PlanNote/releases/latest)**:

| Computador | Arquivo |
|---|---|
| Mac com chip Apple (M1, M2, M3, M4…) | `PlanNote-…-mac-arm64.dmg` |
| Mac com processador Intel | `PlanNote-…-mac-x64.dmg` |
| Windows | `PlanNote-…-windows-setup.exe` |

No Mac, para saber qual é o seu chip, clique na maçã no canto superior esquerdo da tela → **Sobre Este Mac**.

### Primeira vez que abrir

O PlanNote é gratuito e não tem o certificado pago da Apple e da Microsoft. Por isso, **na primeira vez**, o sistema mostra um aviso. É só liberar uma vez:

**No Mac**
1. Abra o `.dmg` e arraste o PlanNote para a pasta **Aplicativos**.
2. Abra o PlanNote. Vai aparecer um aviso de que o app não pode ser verificado. Clique em **OK**.
3. Vá em **Ajustes do Sistema → Privacidade e Segurança**, role até o fim e clique em **Abrir Mesmo Assim**. Digite sua senha se ela for pedida.

**No Windows**
1. Abra o instalador. Se aparecer a tela azul "O Windows protegeu o computador", clique em **Mais informações**.
2. Clique em **Executar assim mesmo** e siga a instalação.

Depois disso o PlanNote abre normalmente, sem aviso.

## O que dá para fazer

- **Cadernos e folhas.** Um caderno para cada matéria. Dentro dele, cada folha é um assunto, e o assunto é o título da folha.
- **Editor de texto:** títulos, negrito, itálico, sublinhado, marca-texto, listas, checklists e citações.
- **Provas com contagem regressiva.** Marque a data de cada prova, ligue a um caderno e veja quantos dias faltam. Também tem um calendário do mês.
- **Busca em tudo.** Procura em todas as folhas de todos os cadernos e ignora acentos e maiúsculas.
- **Salvamento automático** enquanto você escreve.
- **Modo claro e escuro**, que segue o tema do sistema.

![Tela de provas com calendário](docs/screenshots/provas.png)

## Onde ficam os seus dados

Por padrão, na pasta **Documentos/PlanNote Cadernos**:

```
PlanNote Cadernos/
  cadernos/<id>/caderno.json
  cadernos/<id>/folhas/<id>.json
  provas.json
  .lixeira/          ← o que você exclui vem para cá
```

- **Backup:** copie essa pasta.
- **Usar em dois computadores:** em **Configurações → Trocar pasta…**, escolha uma pasta dentro do iCloud Drive, OneDrive ou Dropbox. Os dois computadores passam a ver os mesmos cadernos.
- **Nada é apagado de vez.** O que você exclui vai para a pasta `.lixeira`.

## Rodar a partir do código

É preciso ter o [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
git clone <endereço deste repositório>
cd PlanNote
npm install
npm start
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run dev` | Abre o app recarregando a interface a cada alteração no código |
| `npm test` | Roda os testes automáticos |
| `npm run dist:mac` | Gera o instalador `.dmg` para Mac |
| `npm run dist:win` | Gera o instalador `.exe` para Windows |

## Publicar uma nova versão

Os instaladores são gerados pelo GitHub Actions, num Mac e num Windows, sempre que uma tag de versão é enviada:

1. Atualize `"version"` no `package.json` (por exemplo, `0.2.0`) e faça commit.
2. Crie e envie a tag:
   ```bash
   git tag v0.2.0
   git push origin main v0.2.0
   ```
3. Acompanhe na aba **Actions**. Em uns 10 minutos, a versão aparece em **Releases** com o `.dmg` e o `.exe`.

## Estrutura do código

| Pasta | Conteúdo |
|---|---|
| `electron/` | Processo principal: janela, menus e leitura e gravação dos arquivos (`storage.cjs`) |
| `src/` | Interface: tela principal (`main.js`), editor (`editor.js`) e janelas de diálogo (`modal.js`) |
| `src/styles/` | Visual. Todas as cores ficam em `theme.css` |
| `src/lib/` | Funções de datas, busca e utilidades |
| `tests/` | Testes automáticos (`node --test`) |

Feito com [Electron](https://www.electronjs.org), [Vite](https://vite.dev) e [TipTap](https://tiptap.dev).

## Licença

[MIT](LICENSE). Pode usar, copiar, modificar e distribuir à vontade.
