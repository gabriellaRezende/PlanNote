// Conteúdo da folha de boas-vindas, criada só na primeira vez que o app abre.
export const WELCOME_HTML = `
<h2>Boas-vindas ao seu caderno digital</h2>
<p>O PlanNote funciona como um caderno de verdade: cada <strong>caderno</strong> é uma matéria e cada <strong>folha</strong> é um assunto. O assunto fica no título da folha, lá em cima.</p>
<h3>Primeiros passos</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><p>Abrir o PlanNote</p></li>
  <li data-type="taskItem" data-checked="false"><p>Criar um caderno para cada matéria (botão <strong>+</strong> ao lado de "Cadernos")</p></li>
  <li data-type="taskItem" data-checked="false"><p>Escrever a primeira folha com <strong>Nova folha</strong></p></li>
  <li data-type="taskItem" data-checked="false"><p>Marcar a data da próxima prova em <strong>Provas</strong></p></li>
</ul>
<h3>Formatação</h3>
<p>Use a barra de cima para <strong>negrito</strong>, <em>itálico</em>, <u>sublinhado</u> e <mark>marca-texto</mark>, além de títulos, listas e checklists.</p>
<blockquote><p>Dica: tudo é salvo sozinho enquanto você escreve.</p></blockquote>
<h3>Atalhos</h3>
<ul>
  <li><p><strong>Nova folha:</strong> Cmd+N no Mac, Ctrl+N no Windows</p></li>
  <li><p><strong>Novo caderno:</strong> Cmd+Shift+N / Ctrl+Shift+N</p></li>
  <li><p><strong>Buscar em tudo:</strong> Cmd+F / Ctrl+F</p></li>
  <li><p><strong>Ver provas:</strong> Cmd+P / Ctrl+P</p></li>
</ul>
<p>Quando não precisar mais deste caderno, exclua em ⋯ ao lado do nome dele.</p>
`;
