const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme, session } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { createStorage, hasPlanNoteData, isEmptyDir } = require('./storage.cjs');

const DEV_URL = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined;

// Fundo da janela enquanto a interface carrega (mesmo tom de --bg em src/styles/theme.css).
const WINDOW_BG = { dark: '#15171c', light: '#f4f5f8' }; // ds-nao-e-cor (paleta própria do PlanNote)

let win = null;
let storage = null;
let config = {};
let closing = false;

// ---------- Configuração (fica na pasta interna do app, não na pasta de dados) ----------

const configPath = () => path.join(app.getPath('userData'), 'config.json');

async function loadConfig() {
  try {
    return JSON.parse(await fs.readFile(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

async function saveConfig() {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), 'utf8');
}

function defaultDataDir() {
  return path.join(app.getPath('documents'), 'PlanNote Cadernos');
}

// ---------- Janela ----------

function createWindow() {
  const isMac = process.platform === 'darwin';
  win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    title: 'PlanNote',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? WINDOW_BG.dark : WINDOW_BG.light,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
    autoHideMenuBar: !isMac,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Links externos abrem no navegador, nunca dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  // Menu do botão direito: corretor ortográfico + copiar/colar.
  win.webContents.on('context-menu', (_event, params) => {
    const items = [];
    for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
      items.push({ label: suggestion, click: () => win.webContents.replaceMisspelling(suggestion) });
    }
    if (params.misspelledWord) {
      if (!items.length) items.push({ label: 'Sem sugestões', enabled: false });
      items.push({
        label: 'Adicionar ao dicionário',
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      items.push({ type: 'separator' });
    }
    if (params.isEditable) {
      items.push(
        { label: 'Recortar', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copiar', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Colar', role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { label: 'Selecionar tudo', role: 'selectAll' },
      );
    } else if (params.selectionText) {
      items.push({ label: 'Copiar', role: 'copy' });
    }
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  // Antes de fechar, a interface salva o que estiver pendente.
  win.on('close', (event) => {
    if (closing) return;
    event.preventDefault();
    closing = true;
    const finish = () => {
      clearTimeout(force);
      ipcMain.removeListener('app:flushed', finish);
      if (win) win.destroy();
    };
    const force = setTimeout(finish, 2500);
    ipcMain.once('app:flushed', finish);
    win.webContents.send('app:flush');
  });
  win.on('closed', () => {
    win = null;
    closing = false;
  });

  if (!app.isPackaged) {
    // Em desenvolvimento, mostra no terminal os avisos e erros da interface.
    win.webContents.on('console-message', (event) => {
      const { level, message } = event;
      if (level === 'warning' || level === 'error' || level >= 2) console.log(`[interface] ${message}`);
    });
    // Captura de tela automática para conferência (PLANNOTE_SCREENSHOT=arquivo.png).
    // Opcional: PLANNOTE_SCREENSHOT_ACTION=provas (ação do menu) ou PLANNOTE_SCREENSHOT_JS="código" (roda na interface).
    if (process.env.PLANNOTE_SCREENSHOT) {
      win.webContents.once('did-finish-load', () => {
        if (process.env.PLANNOTE_SCREENSHOT_ACTION) {
          setTimeout(() => send(process.env.PLANNOTE_SCREENSHOT_ACTION), 1500);
        }
        if (process.env.PLANNOTE_SCREENSHOT_JS) {
          setTimeout(() => win.webContents.executeJavaScript(process.env.PLANNOTE_SCREENSHOT_JS).catch(console.error), 1500);
        }
        setTimeout(async () => {
          const image = await win.webContents.capturePage();
          await fs.writeFile(process.env.PLANNOTE_SCREENSHOT, image.toPNG());
          app.exit(0);
        }, 2500);
      });
    }
  }

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function send(action) {
  if (win) win.webContents.send('menu', action);
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: 'PlanNote',
            submenu: [
              { role: 'about', label: 'Sobre o PlanNote' },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar PlanNote' },
              { role: 'hideOthers', label: 'Ocultar outros' },
              { role: 'unhide', label: 'Mostrar tudo' },
              { type: 'separator' },
              { role: 'quit', label: 'Encerrar PlanNote' },
            ],
          },
        ]
      : []),
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Nova folha', accelerator: 'CmdOrCtrl+N', click: () => send('nova-folha') },
        { label: 'Novo caderno', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('novo-caderno') },
        { label: 'Nova prova', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('nova-prova') },
        { type: 'separator' },
        { label: 'Abrir pasta de dados', click: () => storage && shell.openPath(storage.dataDir) },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Sair' }]),
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
        { type: 'separator' },
        { label: 'Buscar', accelerator: 'CmdOrCtrl+F', click: () => send('buscar') },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Provas', accelerator: 'CmdOrCtrl+P', click: () => send('provas') },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamanho original' },
        { role: 'zoomIn', label: 'Aumentar' },
        { role: 'zoomOut', label: 'Diminuir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' }]),
      ],
    },
    { role: 'windowMenu', label: 'Janela' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- Comunicação com a interface ----------

async function switchDataDir(dir) {
  config.dataDir = dir;
  storage = createStorage(dir);
  await saveConfig();
}

function registerIpc() {
  ipcMain.handle('data:loadAll', () => storage.loadAll());
  ipcMain.handle('data:saveNotebook', (_e, nb) => storage.saveNotebook(nb));
  ipcMain.handle('data:deleteNotebook', (_e, id) => storage.deleteNotebook(id));
  ipcMain.handle('data:savePage', (_e, notebookId, page) => storage.savePage(notebookId, page));
  ipcMain.handle('data:deletePage', (_e, notebookId, pageId) => storage.deletePage(notebookId, pageId));
  ipcMain.handle('data:saveExams', (_e, exams) => storage.saveExams(exams));

  ipcMain.handle('config:get', () => ({
    dataDir: storage.dataDir,
    welcomed: Boolean(config.welcomed),
    version: app.getVersion(),
  }));

  ipcMain.handle('config:setWelcomed', async () => {
    config.welcomed = true;
    await saveConfig();
  });

  ipcMain.handle('config:openDataDir', () => shell.openPath(storage.dataDir));

  // Troca a pasta de dados.
  // - Pasta que já tem dados do PlanNote (ex.: iCloud usado em outro computador): passa a usar esses dados.
  // - Pasta vazia: copia os cadernos atuais para lá.
  // - Pasta com outras coisas: cria "PlanNote Cadernos" dentro dela, para não misturar.
  ipcMain.handle('config:chooseDataDir', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Escolha a pasta dos seus cadernos',
      buttonLabel: 'Usar esta pasta',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { changed: false };

    let target = result.filePaths[0];
    if (path.resolve(target) === path.resolve(storage.dataDir)) return { changed: false };

    if (!(await hasPlanNoteData(target)) && !(await isEmptyDir(target))) {
      target = path.join(target, 'PlanNote Cadernos');
    }

    let mode = 'usou-existente';
    if (!(await hasPlanNoteData(target))) {
      await fs.mkdir(target, { recursive: true });
      await fs.cp(storage.dataDir, target, { recursive: true, force: false, errorOnExist: false });
      mode = 'copiou';
    }

    await switchDataDir(target);
    return { changed: true, mode, dataDir: target };
  });
}

// ---------- Início ----------

// Pasta de teste separada, só em desenvolvimento (PLANNOTE_DEV_HOME=/alguma/pasta).
// Fica antes da trava de instância única, para rodar junto com o PlanNote de verdade.
if (!app.isPackaged && process.env.PLANNOTE_DEV_HOME) {
  app.setPath('userData', path.join(process.env.PLANNOTE_DEV_HOME, 'config'));
  app.setPath('documents', path.join(process.env.PLANNOTE_DEV_HOME, 'Documents'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.setName('PlanNote');

  app.whenReady().then(async () => {
    // Força o tema claro ou escuro, só em desenvolvimento (PLANNOTE_THEME=dark).
    if (!app.isPackaged && ['dark', 'light'].includes(process.env.PLANNOTE_THEME)) {
      nativeTheme.themeSource = process.env.PLANNOTE_THEME;
    }
    config = await loadConfig();
    const dataDir = config.dataDir || defaultDataDir();
    await fs.mkdir(dataDir, { recursive: true });
    storage = createStorage(dataDir);

    try {
      session.defaultSession.setSpellCheckerLanguages(['pt-BR']);
    } catch {
      // No macOS o corretor segue o idioma do sistema.
    }

    registerIpc();
    buildAppMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
