import * as vscode from 'vscode';
import { getBinPath, getDirtyFile } from './utils';
import cp = require('child_process');
import util = require('util');
import { stat, readFile } from 'fs/promises';
import { text } from 'node:stream/consumers';
const asyncSpawn = util.promisify(cp.spawn);

export async function formatDocument(
  document: vscode.TextDocument,
): Promise<vscode.TextEdit[] | null | undefined> {
  let file = await getDirtyFile(document);
  let tabSize = null;
  let maxLineLen = null;
  const config = vscode.workspace.getConfiguration('');
  try {
    tabSize = config['[nim]']['editor.tabSize'];
  } catch (e) {
    tabSize = vscode.workspace.getConfiguration('editor').get('tabSize');
  }
  if (!tabSize) {
    tabSize = 2;
  }

  try {
    maxLineLen = config['[nim]']['editor.maxLineLen'];
  } catch (e) {
    maxLineLen = vscode.workspace.getConfiguration('editor').get('maxLineLen');
  }
  if (!maxLineLen) {
    maxLineLen = 120;
  }

  let args = ['--backup:OFF'];
  args.push('--indent:' + tabSize);
  args.push('--maxLineLen:' + maxLineLen);
  const rootPath = vscode.workspace.getWorkspaceFolder(document.uri)?.uri?.path;
  const nimpretty = await getBinPath('nimpretty');
  let res = (await asyncSpawn(nimpretty, args.concat(file), {
    cwd: rootPath,
  })) as cp.ChildProcess;

  if (res.exitCode !== 0) {
    return Promise.reject(await text(res.stdout!));
  } else {
    const exists = await stat(file)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      return Promise.reject(file + ' file not found');
    } else {
      let content = await readFile(file, 'utf-8');
      const start = new vscode.Position(0, 0);
      const end = new vscode.Position(
        document.lineCount - 1,
        document.lineAt(document.lineCount - 1).text.length,
      );
      const range = new vscode.Range(start, end);
      return Promise.resolve([vscode.TextEdit.replace(range, content)]);
    }
  }
}

export async function onSave(e: vscode.TextDocumentWillSaveEvent) {
  const { document } = e;

  const docType: string[] = ['nim'];

  if (docType.indexOf(document.languageId) === -1) {
    return;
  }
  let onSave: boolean | undefined = false;
  const config = vscode.workspace.getConfiguration('', e.document);
  try {
    onSave = config['[nim]']['editor.formatOnSave'];
  } catch (e) {
    onSave = vscode.workspace.getConfiguration('editor').get('formatOnSave');
  }
  if (!onSave) {
    return;
  }
  await formatDocument(document);
}
