import { workspace } from 'vscode';
import vscode = require('vscode');
import { MODE } from './mode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  ExecutableOptions,
  HoverParams,
  HoverRequest,
} from 'vscode-languageclient';
import cp = require('child_process');
import fs = require('fs');
import { showNimVer } from './status';
import { runFile } from './run';
// import { setNimSuggester } from './nimSuggestExec';

import { ExecutableInfo } from './interfaces';
import { getExecutableInfo, getDirtyFile, getBinPath } from './utils';

// var terminal: vscode.Terminal;

export var client: LanguageClient;

async function start(context: any, _: ExecutableInfo) {
  let serverModule = await getBinPath('nimlsp');

  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const resource = editor.document.uri;

  const folder = workspace.getWorkspaceFolder(resource);
  if (!folder) {
    return;
  }

  let args: string[] = [];
  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let options: ExecutableOptions = {
    // cwd: folder.uri.fsPath,
    detached: false,
    shell: false,
  };

  const serverOptions: ServerOptions = {
    run: { command: serverModule, args: args, options: options },
    debug: { command: serverModule, args: args, options: options },
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    // @ts-ignore
    documentSelector: MODE,
    diagnosticCollectionName: 'nim',
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('{**/*.nim,**/.nimble}'),
    },
    middleware: {
      provideHover: (
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
      ) => {
        const start = document.getWordRangeAtPosition(position)?.start || position;
        const params: HoverParams = {
          textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document),
          position: client.code2ProtocolConverter.asPosition(start),
        };
        return client
          .sendRequest(HoverRequest.type, params, token)
          .then(client.protocol2CodeConverter.asHover, (error: Error) => {
            client.logFailedRequest(HoverRequest.type, error);
            return Promise.reject();
          });
      },
    },
    initializationOptions: {
      documentFormattingProvider: true,
    },
    // "capabilities":{
    //   formatting:true
    // },
    workspaceFolder: folder,
  };

  // Create the language client and start the client.
  client = new LanguageClient('nim', 'nim', serverOptions, clientOptions, true);

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(MODE, {
      provideDocumentFormattingEdits: (
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken | undefined,
      ) => {
        return new Promise(async (resolve, reject) => {
          if ((await getBinPath('nimpretty')) === '') {
            vscode.window.showInformationMessage(
              "No 'nimpretty' binary could be found in PATH environment variable",
            );
            resolve([]);
          } else {
            let file = getDirtyFile(document);
            let tabSize = null;
            const config = vscode.workspace.getConfiguration('');
            try {
              tabSize = config['nim']['editor.tabSize'];
            } catch (e) {
              tabSize = vscode.workspace.getConfiguration('editor').get('tabSize');
            }
            if (!tabSize) {
              tabSize = vscode.workspace.getConfiguration('editor').get('tabSize');
            }

            let args = [
              '--backup:OFF',
              // '--maxLineLen:' + config['nimprettyMaxLineLen'],
            ];
            if (tabSize) {
              args.push('--indent:' + tabSize);
            }
            let res = cp.spawnSync(await getBinPath('nimpretty'), args.concat(file), {
              cwd: vscode.workspace.rootPath,
            });

            if (res.status !== 0) {
              reject(res.error);
            } else {
              if (!fs.existsSync(file)) {
                reject(file + ' file not found');
              } else {
                let content = fs.readFileSync(file, 'utf-8');
                let range = document.validateRange(
                  new vscode.Range(
                    new vscode.Position(0, 0),
                    new vscode.Position(1000000, 1000000),
                  ),
                );
                resolve([vscode.TextEdit.replace(range, content)]);
              }
            }
          }
        });
      },
    }),
  );

  // Start the client. This will also launch the server
  context.subscriptions.push(client.start());
}

export async function activate(context: any) {
  vscode.commands.registerCommand('nim.run.file', runFile);
  //   vscode.commands.registerCommand('nim.setSuggester', setNimSuggester);

  let binInfo = await getExecutableInfo('nimlsp');
  showNimVer(binInfo);
  start(context, binInfo);
}

export function deactivate(): Thenable<void> {
  if (!client) {
    return Promise.reject();
  }
  return client.stop();
}
