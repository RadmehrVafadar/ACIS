const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');

exports.activate = async function activate(context) {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) return;
  const marker = '/tmp/acis-editor-live';
  fs.writeFileSync(marker, String(process.pid));
  let lastRequest = null;
  const interval = setInterval(async () => {
    try {
      const request = fs.readFileSync('/tmp/acis-save-request', 'utf8');
      if (lastRequest === request) return;
      lastRequest = request;
      const saved = await vscode.workspace.saveAll(false);
      fs.writeFileSync('/tmp/acis-save-ack', JSON.stringify({ request, saved }));
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Saving interview files', error);
    }
  }, 100);
  context.subscriptions.push({ dispose() { clearInterval(interval); } });

  if (!context.workspaceState.get('openedReadme') && fs.existsSync(path.join(root.fsPath, 'README.md'))) {
    await context.workspaceState.update('openedReadme', true);
    await vscode.commands.executeCommand('workbench.action.closeSidebar');
    await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    await vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.joinPath(root, 'README.md'));
  }

  const manage = ['manage.py', 'backend/manage.py'].map(file => path.join(root.fsPath, file)).find(fs.existsSync);
  const defaults = manage
    ? { name: 'Debug Django', program: manage, args: ['runserver', '0.0.0.0:8082', '--noreload'] }
    : { name: 'Debug Python file', program: '${file}', args: [] };
  context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('debugpy', {
    provideDebugConfigurations() { return [{ ...defaults, type: 'debugpy', request: 'launch' }]; },
    resolveDebugConfiguration(_, config) {
      return { cwd: root.fsPath, python: '/opt/acis-venv/bin/python', console: 'internalConsole',
        justMyCode: true, type: 'debugpy', request: 'launch', ...defaults, ...config };
    }
  }));
  context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('debugpy', {
    createDebugAdapterDescriptor() {
      return new vscode.DebugAdapterExecutable('/opt/acis-venv/bin/python', ['-m', 'debugpy.adapter']);
    }
  }));
};
