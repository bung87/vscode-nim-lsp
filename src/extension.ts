import { workspace } from "vscode";
import vscode = require("vscode");
import { MODE } from "./mode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  ExecutableOptions,
  HoverParams,
  HoverRequest,
  RevealOutputChannelOn,
} from "vscode-languageclient/node";

import { showNimVer } from "./status";
import { runFile } from "./run";

import { ExecutableInfo } from "./interfaces";
import { getExecutableInfo, getBinPath } from "./utils";
import { checkFile } from "./check";
import { formatDocument, onSave } from "./formatter";

export var client: LanguageClient;

async function start(context: any, _: ExecutableInfo) {
  let serverModule = await getBinPath("nimlsp");

  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const resource = editor.document.uri;

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
    diagnosticCollectionName: "nim",
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("{**/*.nim,**/.nimble}"),
    },
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    middleware: {
      provideHover: async (
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
      ) => {
        const start =
          document.getWordRangeAtPosition(position)?.start || position;
        const params: HoverParams = {
          textDocument:
            client.code2ProtocolConverter.asTextDocumentIdentifier(document),
          position: client.code2ProtocolConverter.asPosition(start),
        };
        try {
          const hover = await client.sendRequest(
            HoverRequest.type,
            params,
            token
          );
          return client.protocol2CodeConverter.asHover(hover);
        } catch (e) {
          let error = e as Error;
          client.error(`Request ${HoverRequest.type.method} failed.`, error);
          return new vscode.Hover(new vscode.MarkdownString(error.message));
        }
      },
    },
    // initializationOptions: {
    //   documentFormattingProvider: true,
    // },
    // "capabilities":{
    //   formatting:true
    // },
    workspaceFolder: workspace.getWorkspaceFolder(resource),
  };

  // Create the language client and start the client.
  client = new LanguageClient("nim", "nim", serverOptions, clientOptions, true);

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(MODE, {
      provideDocumentFormattingEdits: (
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken | undefined
      ) => {
        return new Promise(async (resolve, reject) => {
          if ((await getBinPath("nimpretty")) === "") {
            vscode.window.showInformationMessage(
              "No 'nimpretty' binary could be found in PATH environment variable"
            );
            resolve([]);
          } else {
            return resolve(formatDocument(document));
          }
        });
      },
    })
  );

  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((e) => {
      onSave(e);
    })
  );

  // Start the client. This will also launch the server
  context.subscriptions.push(client.start());
}

export async function activate(context: any) {
  vscode.commands.registerCommand("nim.run.file", runFile);
  vscode.commands.registerCommand("nim.check.file", checkFile);

  let binInfo = await getExecutableInfo("nimlsp");
  showNimVer(binInfo);
  start(context, binInfo);
}

export function deactivate(): Thenable<void> {
  if (!client) {
    return Promise.reject();
  }
  return client.stop();
}
