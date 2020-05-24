import { workspace } from 'vscode';
import vscode = require('vscode');
import { MODE } from './mode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  ExecutableOptions,
  DocumentRangeFormattingParams,
  DocumentRangeFormattingRequest,
} from 'vscode-languageclient';

import { showNimVer } from './status';
import { runFile } from './run';
// import { setNimSuggester } from './nimSuggestExec';

import { ExecutableInfo } from './interfaces';
import { getExecutableInfo, getBinPath } from './utils';

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
    documentSelector: nimMode,
    diagnosticCollectionName: 'nim',
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('{**/*.nim,**/.nimble}'),
    },
    initializationOptions: {
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      executeCommandProvider: true,
    },
    workspaceFolder: folder,
  };

  // Create the language client and start the client.
  client = new LanguageClient('nim', 'nim', serverOptions, clientOptions, true);

  context.subscriptions.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider(MODE, {
      provideDocumentRangeFormattingEdits: (
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken | undefined,
      ) => {
        const params: DocumentRangeFormattingParams = {
          textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document),
          range: client.code2ProtocolConverter.asRange(range),
          options: client.code2ProtocolConverter.asFormattingOptions(options),
        };
        return client
          .sendRequest(DocumentRangeFormattingRequest.type, params, token)
          .then(client.protocol2CodeConverter.asTextEdits, (error: Error) => {
            client.logFailedRequest(DocumentRangeFormattingRequest.type, error);
            return Promise.resolve([]);
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
