import { workspace, ExtensionContext } from 'vscode';
import vscode = require('vscode');
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	ExecutableOptions,

} from 'vscode-languageclient';

import { showNimVer } from './nimStatus';
import { setNimSuggester } from './nimSuggestExec';

import { ExecutableInfo } from './interfaces';
import { getExecutableInfo } from './extensionUtils';

var terminal: vscode.Terminal;

export var client: LanguageClient;

function start(context: ExtensionContext, binInfo: ExecutableInfo) {

	let serverModule = "/Users/bung/nim_works/nimlsp/nimlsp"

	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		return
	}
	const resource = editor.document.uri;

	const folder = workspace.getWorkspaceFolder(resource);
	if (!folder) {
		return
	}

	let args: string[] = []
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let options: ExecutableOptions = {
		cwd: folder.uri.fsPath,
		detached: false,
		shell: false
	}
	console.log(serverModule)

	const serverOptions: ServerOptions = {
		run: { command: serverModule, args: args, options: options },
		debug: { command: serverModule, args: args, options: options }
	}

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ language: 'nim', scheme: 'file' }],
		diagnosticCollectionName: "nim",
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('{**/*.nim,**/.nimble}')
		},
		workspaceFolder: folder
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'nim',
		'nim',
		serverOptions,
		clientOptions
	);

	client.onDidChangeState((e) => {
		console.log(e)
	});

	client.onReady().then(x => {
		client.sendNotification("textDocument/didSave", { textDocument: { uri: vscode.window.activeTextEditor.document.uri.toString() } })
	})

	// Start the client. This will also launch the server
	context.subscriptions.push(client.start());
}

export async function activate(context: ExtensionContext) {
	// vscode.commands.registerCommand('nim.run.file', runFile);
	vscode.commands.registerCommand('nim.setSuggester', setNimSuggester);

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