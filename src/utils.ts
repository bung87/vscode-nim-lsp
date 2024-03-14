import * as vscode from 'vscode';
import { ExecutableInfo } from './interfaces';
import path = require('path');
import util = require('util');
import os = require('os');
import which = require('which');
import { text } from 'node:stream/consumers';
import { stat, writeFile } from 'fs/promises';
import asyncSpawn = require('cross-spawn');


const notInPathError = 'No %s binary could be found in PATH environment variable';
let _pathesCache: { [tool: string]: string } = {};

export async function getDirtyFile(document: vscode.TextDocument): Promise<string> {
  var dirtyFilePath = path.normalize(path.join(os.tmpdir(), 'vscodenimdirty.nim'));
  await writeFile(dirtyFilePath, document.getText());
  return dirtyFilePath;
}

export async function getBinPath(tool: string): Promise<string> {
  let configuredExePath = <string>vscode.workspace.getConfiguration('nim').get(tool);
  if (configuredExePath) {
    return configuredExePath;
  }
  if (_pathesCache[tool]) {
    return _pathesCache[tool];
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

  let configuredExePath = <string>vscode.workspace.getConfiguration('nim').get(exe);

  if (configuredExePath) {
    exePath = configuredExePath;
  } else {
    exePath = await getBinPath(exe);
  }

  const exists = await stat(exePath)
    .then(() => true)
    .catch(() => false);

  if (exePath && exists) {
    const res = asyncSpawn(exePath, ['--version'], {});


    if (res) {
      const output = await text(res.stdout!);
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
