import * as vscode from 'vscode';
import { ExecutableInfo } from './interfaces';
import fs = require('fs');
import path = require('path');
import cp = require('child_process');
import util = require('util');
import os = require('os');
import which = require('which');

const writeFile = util.promisify(fs.writeFile);
const notInPathError = 'No %s binary could be found in PATH environment variable';
let _pathesCache: { [tool: string]: string } = {};

export async function getDirtyFile(document: vscode.TextDocument): Promise<string> {
  var dirtyFilePath = path.normalize(path.join(os.tmpdir(), 'vscodenimdirty.nim'));
  await writeFile(dirtyFilePath, document.getText());
  return dirtyFilePath;
}

export async function getBinPath(tool: string): Promise<string> {
  if (_pathesCache[tool]) {
    return Promise.resolve(_pathesCache[tool]);
  }
  const toolPath = await which(tool);
  if (toolPath) {
    _pathesCache[tool] = toolPath;
  }
  return _pathesCache[tool];
}

export async function getExecutableInfo(exe: string): Promise<ExecutableInfo> {
  var exePath,
    exeVersion: string = '';

  let configuredExePath = <string>vscode.workspace.getConfiguration("nim").get(exe);
  console.log(configuredExePath)
  if (configuredExePath) {
    exePath = configuredExePath;
  } else {
    exePath = await getBinPath(exe);
  }

  if (exePath && fs.existsSync(exePath)) {
    const output = cp.spawnSync(exePath, ['--version']).output;
    if (!output) {
      return Promise.resolve({
        name: exe,
        path: exePath,
      });
    }
    
    let versionOutput = output.toString();
    
    let versionArgs = /(?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)/g.exec(versionOutput);
    if (versionArgs) {
      exeVersion = versionArgs[0];
    }
    return Promise.resolve({
      name: exe,
      path: exePath,
      version: exeVersion,
    });
  } else {
    let msg = util.format(notInPathError, exe);
    vscode.window.showErrorMessage(msg);
    return Promise.reject();
  }
}
