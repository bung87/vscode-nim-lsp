import vscode = require('vscode');
import fs = require('fs');
import path = require('path');
import { getDirtyFile } from './utils';
import { promisify } from 'util';
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

var terminal: vscode.Terminal;
export async function runFile() {
  let editor = vscode.window.activeTextEditor;
  if (editor) {
    if (!terminal) {
      terminal = vscode.window.createTerminal('Nim');
    }
    terminal.show(true);
    if (editor.document.isUntitled) {
      terminal.sendText(
        'nim ' +
          vscode.workspace.getConfiguration('nim')['buildCommand'] +
          ' -r "' +
          (await getDirtyFile(editor.document)) +
          '"',
        true,
      );
    } else {
      let outputDirConfig = vscode.workspace.getConfiguration('nim')['runOutputDirectory'];
      var outputParams = '';
      if (!!outputDirConfig) {
        if (!vscode.workspace.workspaceFolders) {
          return;
        }
        // @ts-ignore
        const dir =
          vscode.workspace.workspaceFolders.length > 0
            ? vscode.workspace.workspaceFolders[0]
            : null;
        if (!dir) {
          return;
        }
        const pat = path.join(dir.uri?.fsPath, outputDirConfig);
        if (!pat) {
          return;
        }
        if (!stat(pat)) {
          await mkdir(pat);
        }
        outputParams =
          ' --out:"' +
          path.join(outputDirConfig, path.basename(editor.document.fileName, '.nim')) +
          '"';
      }
      if (editor.document.isDirty) {
        editor.document.save().then((success: boolean) => {
          if (success) {
            terminal.sendText(
              'nim ' +
                vscode.workspace.getConfiguration('nim')['buildCommand'] +
                outputParams +
                ' -r "' +
                editor?.document.fileName +
                '"',
              true,
            );
          }
        });
      } else {
        terminal.sendText(
          'nim ' +
            vscode.workspace.getConfiguration('nim')['buildCommand'] +
            outputParams +
            ' -r "' +
            editor.document.fileName +
            '"',
          true,
        );
      }
    }
  }
}
