# Validação da versão 0.1

## Atualização 0.2 — legendas

- Nove testes automatizados passaram, incluindo importação e round-trip de SRT/VTT, recusa de tempos inválidos, compatibilidade com projetos antigos, quebra de linhas e renderização com início inclusivo/fim exclusivo.
- Criada legenda multilinha pela interface e aplicado o preset Destaque. Texto, cor, tamanho e maiúsculas foram preservados após recarregar a página.
- Legendas usam o mesmo canvas da exportação, depois dos efeitos do clipe.
- Tempos de legendas são relativos ao projeto e não acompanham automaticamente reordenação de clipes.

Executada em 16/10/2026.

- Cinco testes automatizados passaram: operações de corte e duração; validação de projeto/plugins; timecode; servidor e restrições de caminho; gravação e leitura de exportação local com bloqueio de outra origem.
- Interface conferida em navegador integrado do Codex e Microsoft Edge. Layout compacto e layout desktop foram visualmente inspecionados.
- Reprodução das cenas, divisão no cursor, desfazer e aplicação de título testados pela interface.
- Plugin externo `plugins/example.js` instalado pela interface, reconhecido e aplicado ao clipe.
- Exportação de três cenas gerou arquivo WebM de 3.889.258 bytes. O arquivo foi reimportado, teve duração medida de aproximadamente 15,27 segundos e foi reproduzido na timeline. O projeto de origem tinha 15 segundos; a diferença é compatível com a gravação em tempo real.
- Corrigido um bloqueio do MediaRecorder em sequência sem áudio: fonte de silêncio contínua mantém a faixa de áudio ativa.
- Corrigida a leitura de duração de WebM sem metadado finito, usando busca até o final antes de importar.
- Cancelamento, projetos extensos e mídia externa com áudio audível ainda precisam de uma bateria mais ampla de testes. Exportações longas não foram avaliadas.

O arquivo `../lume-demo.webm` é uma demonstração gerada pelo próprio editor. O aplicativo usa apenas código próprio e APIs do navegador/Node, sem componentes do CapCut.

Exportação da versão 0.2 validada pela interface: WebM com legendas de 3.893.419 bytes, salvo também em ../lume-legendas-demo.webm. Prévia visual verificada em ../lume-legendas.jpg.
