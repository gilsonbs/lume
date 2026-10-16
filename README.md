# Lume Studio

Editor de vídeo local independente, versão 0.2. Não utiliza código ou DLLs do CapCut.

## Abrir

Requisito: Node.js 22 ou mais recente. Na pasta deste arquivo, execute:

```powershell
npm start
```

Abra http://127.0.0.1:4318 no Chrome ou Edge. A aplicação não precisa de dependências npm. O servidor aceita conexões apenas da própria máquina.

## Recursos implementados

- Importação por seletor ou arrastar e soltar: vídeo, imagem e áudio, conforme os codecs suportados pelo navegador.
- Biblioteca, preview HD, sequência de clipes com duração real, cursor, reprodução e áudio original.
- Corte por entrada/saída, divisão no cursor, exclusão, reordenação, desfazer e zoom da timeline.
- Ajustes de exposição, saturação, volume e enquadramento.
- Plugins empilháveis por clipe: vinheta, barras de cinema, título e fade.
- Carregamento de plugins JavaScript externos e um exemplo de grade de composição.
- Exportação WebM HD em tempo real via MediaRecorder, com áudio e efeitos do canvas.
- Salvar/abrir projeto `.lume` e rascunho local automático.
- Três cenas procedurais de demonstração, geradas pelo próprio editor.
- Faixa de legendas independente: edição de texto multilinha e tempos, divisão, exclusão e desfazer.
- Estilo compartilhado das legendas: fonte, tamanho, cores, contorno, fundo, posição, alinhamento, negrito, itálico, maiúsculas e sombra. Três presets: Clássica, Destaque e Caixa.
- Importação de SRT/VTT e exportação de SRT. Legendas desenhadas no preview e incorporadas ao vídeo exportado.

## Editar legendas

Abra **Legendas** na barra lateral e clique em **Adicionar legenda**. A legenda começa no cursor, com até três segundos de duração. Selecione sua linha na lista ou seu bloco na faixa para abrir o editor em Propriedades. Edite o texto e os tempos em segundos. Use a régua para posicionar o cursor e **Dividir** para dividir a legenda selecionada; o texto é copiado para as duas partes, que podem ser editadas separadamente.

O bloco **Estilo de todas as legendas** controla a aparência de toda a faixa. A posição vertical usa porcentagem da altura do vídeo; valores menores aproximam o texto do topo. Quebras de linha manuais são preservadas, e linhas longas são quebradas automaticamente. Legendas simultâneas são empilhadas. O estilo e os textos são preservados no projeto e no rascunho local; projetos antigos continuam compatíveis.

**Importar SRT / VTT** acrescenta legendas ao projeto. **Exportar SRT** salva apenas texto e tempos: SRT não preserva estes estilos visuais. A exportação WebM incorpora as legendas com a aparência da prévia. As legendas usam tempos absolutos do projeto; reordenar ou cortar clipes não desloca automaticamente a faixa de legendas. Trechos além do final do vídeo permanecem editáveis, com aviso, mas não aparecem na exportação.

Esta versão permite legendas manuais e importadas; não gera transcrição automática.

## Fluxo de uso

Importe arquivos. Use o botão + de uma mídia para acrescentá-la à sequência, ou arraste-a para a faixa. Selecione um clipe e ajuste seus valores em Propriedades. Clique na régua para posicionar o cursor; S divide o clipe selecionado nesse ponto. As setas da barra da timeline reordenam o clipe selecionado.

Em Plugins, clique em um efeito para aplicá-lo ao clipe selecionado. Os efeitos são processados em ordem de adição. O painel de propriedades permite ajustar seus parâmetros e removê-los.

Exporte com a aba visível: o tempo necessário acompanha a duração do projeto. O arquivo gerado é WebM, não MP4. O vídeo fica salvo na subpasta `exports` do editor e também é oferecido como download. Nada é enviado a servidores externos. Silenciar a prévia não silencia a exportação; o volume do clipe afeta ambos. Cancelar descarta a gravação parcial. Ocultar a aba cancela a exportação para evitar uma gravação interrompida silenciosamente. A gravação em tempo real pode adicionar uma pequena margem à duração final.

Os arquivos de projeto guardam cortes, ajustes, referências a mídias e parâmetros de plugins. Não incorporam vídeos, áudio nem código dos plugins. Ao reabrir, importe novamente os mesmos arquivos para reconectar pelo nome e tamanho e reinstale plugins externos usados. Rascunhos também precisam dessa reconexão após recarregar a página. Conserve os arquivos originais.

## API de plugins v1

Um módulo ES exporta um objeto default com `id`, `apiVersion: 1`, `name`, `parameters` e `render(ctx, frame, params)`. Confira `plugins/example.js`. Plugins externos executam JavaScript no contexto do editor: instale somente arquivos cuja origem você conhece. A versão inicial não oferece isolamento de execução nem compatibilidade com plugins proprietários de outros editores.

`frame` contém `width`, `height`, `time`, `localTime`, `sourceTime`, `duration` e `clipId`. O contexto é CanvasRenderingContext2D e já contém o quadro do vídeo. Cada efeito recebe o contexto com save/restore ao redor da chamada. Parâmetros podem ser `range`, `text` ou `color`.

## Estrutura

- `core.js`: operações puras de timeline, validação e timecode.
- `app.js`: estado, reprodução, importação, edição e exportação.
- `plugins/`: módulos de efeitos.
- `captions-core.js` e `captions.js`: formatos de legenda, renderização, edição e estilo.
- `server.mjs`: servidor HTTP local sem dependências externas.
- `tests/`: testes de cortes, validação e servidor.

Execute `npm test` para verificar o núcleo.

## Limites desta versão

Uma faixa sequencial, sem sobreposição entre clipes. Um arquivo de áudio ocupa um trecho da sequência com visualização própria; ainda não há trilha de música independente. Não há transições entre clipes, keyframes, legendagem automática, aceleração nativa, edição colaborativa ou exportação MP4. Plugins são efeitos visuais, sem suporte a OFX/VST. Decodificação e desempenho dependem do navegador e do computador. Projetos grandes e exportações longas podem consumir bastante memória; esta versão é uma base funcional para evolução, não uma substituição completa do CapCut.

Próximas etapas: múltiplas faixas, persistência de mídia em armazenamento local, transições, FFmpeg para MP4 e tarefas de exportação, isolamento dos plugins e testes com mídias maiores.
