import { workspace } from 'vscode';
import vscode = require('vscode');
import { MODE } from './mode';
const rst2mdown = require('rst2mdown');
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  ExecutableOptions,
  HoverParams,
  DocumentRangeFormattingParams,
  DocumentRangeFormattingRequest,
  HoverRequest,
  Hover,
  // MarkedString,
  // MarkupContent,
  MarkupKind,
} from 'vscode-languageclient';

import { showNimVer } from './status';
import { runFile } from './run';
// import { setNimSuggester } from './nimSuggestExec';

import { ExecutableInfo } from './interfaces';
import { getExecutableInfo, getBinPath } from './utils';

// var terminal: vscode.Terminal;

export var client: LanguageClient;
function isObject(val: any): boolean {
  if (val === null) {
    return false;
  }
  return typeof val === 'function' || typeof val === 'object';
}

// interface MarkedStringObj {
//   language: string;
// }

// function isMarkedStringObj(object: any): object is MarkedStringObj {
//   return 'language' in object;
// }

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
        // export interface MarkupContent {
        //   /**
        //    * The type of the Markup
        //    */
        //   kind: MarkupKind;

        //   /**
        //    * The content itself
        //    */
        //   value: string;
        // }
        // type MarkedString = string | { language: string; value: string };
        return client.sendRequest(HoverRequest.type, params, token).then(
          (hover: Hover | null) => {
            console.log(23, isObject(hover?.contents), hover);
            if (hover) {
              // let origin = client.protocol2CodeConverter.asHover(hover);
              // console.log(origin.contents);
              var mdown = '';
              if (Array.isArray(hover.contents)) {
                console.log('isArray');
                let newHover = new vscode.Hover(hover.contents);
                hover.contents.forEach((item: any, index: number) => {
                  // if (MarkedString.is(item)) {
                  // if (isMarkedStringObj(item)) {
                  // if (item.language === '') {
                  // @ts-ignore
                  console.log('item value', item.value);
                  // @ts-ignore
                  if (index === 0) {
                    mdown += rst2mdown('``` nim\n' + item.value + '```');
                  } else {
                    mdown += item.value;
                  }

                  // }
                  // }
                  // }
                });
                newHover.contents = {
                  // @ts-ignore
                  kind: MarkupKind.Markdown,
                  value: mdown,
                };

                return newHover;
              } else if (isObject(hover.contents)) {
                // @ts-ignore
                let newHover = new vscode.Hover(hover.contents, hover.range);
                // @ts-ignore
                let mdown = rst2mdown(hover.contents.value);
                newHover.contents = {
                  // @ts-ignore
                  kind: MarkupKind.Markdown,
                  // @ts-ignore
                  value: mdown,
                };
                console.log(898, newHover, 89);
                return newHover;
              }
            }

            return client.protocol2CodeConverter.asHover(hover);
          },
          (error: Error) => {
            client.logFailedRequest(HoverRequest.type, error);
            return Promise.reject();
          },
        );
      },
    },
    // initializationOptions: {
    //   ServerCapabilities:{
    //     documentFormattingProvider: true,
    //     documentRangeFormattingProvider: true,
    //     executeCommandProvider: true,
    //     hoverProvider:false,
    //   }
    // },
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
