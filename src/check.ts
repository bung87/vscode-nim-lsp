import * as vscode from 'vscode';

var terminal: vscode.Terminal;
export function checkFile() {
  let editor = vscode.window.activeTextEditor;
  if (editor) {
    if (!terminal) {
      terminal = vscode.window.createTerminal('Nim');
    }
    terminal.show(true);
    if (editor.document.isUntitled) {
    } else {
      if (editor.document.isDirty) {
        editor.document.save().then((success: boolean) => {
          if (success) {
            terminal.sendText('nim ' + ' check "' + editor?.document.fileName + '"', true);
          }
        });
      } else {
        terminal.sendText('nim ' + ' check "' + editor.document.fileName + '"', true);
      }
    }
  }
}
