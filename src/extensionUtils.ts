import * as vscode from 'vscode';
import { ExecutableInfo } from './interfaces';
import fs = require('fs');
import path = require('path');
import cp = require('child_process');
import bluebird = require('bluebird');
import util = require('util');
const lstat = util.promisify(fs.lstat);

const notInPathError = 'No %s binary could be found in PATH environment variable';
let _pathesCache: { [tool: string]: string } = {};

export function promiseSymbolLink(path: string): Promise<{ path: string; type: string }> {
  return new Promise<{ path: string; type: string }>((resolve, reject) => {
    if (!fs.existsSync(path)) {
      reject('');
      return;
    }
    try {
      lstat(path)
        .then((stat: { isSymbolicLink: () => any; isFile: () => any }) => {
          if (stat.isSymbolicLink()) {
            resolve({ path: path, type: 'link' });
          } else if (stat.isFile()) {
            resolve({ path: path, type: 'file' });
          } else {
            reject();
          }
        })
        .catch((e: any) => {
          console.error(e);
          reject('');
        });
    } catch (e) {
      console.error(e);
      reject('');
    }
  });
}

export function readlink(link: string): string {
  let result = '';
  if (process.platform === 'darwin') {
    result = cp.execFileSync('readlink', [link]).toString().trim();
    if (result.length > 0 && !path.isAbsolute(result)) {
      result = path.normalize(path.join(path.dirname(link), result));
    }
  } else if (process.platform === 'linux') {
    result = cp.execFileSync('readlink', ['-f', link]).toString().trim();
  } else {
    result = cp.execFileSync('readlink', [link]).toString().trim();
  }

  if (result.length > 0) {
    return result;
  }
  return result;
}

export async function getBinPath(tool: string): Promise<string> {
  if (_pathesCache[tool]) {
    return Promise.resolve(_pathesCache[tool]);
  }
  if (process.env['PATH']) {
    if (process.platform !== 'win32') {
      var quikePath = '';
      try {
        quikePath = path.normalize(cp.execSync(`which ${tool}`).toString().trim());
      } catch (e) {
        console.error(e);
      }
      if (quikePath) {
        _pathesCache[tool] = path.normalize(quikePath);
        return Promise.resolve(quikePath);
      }
    }
    var pathparts = process.env.PATH.split(path.delimiter)
      .filter((value, index, self) => self.indexOf(value) === index)
      .reverse();
    if (process.platform !== 'win32') {
      pathparts = pathparts.filter((x) => x.indexOf('/sbin') === -1);
    }
    let pathes = pathparts
      .map((dir) => path.join(dir, correctBinname(tool)))
      .filter((x) => fs.existsSync(x));
    let promises = bluebird.map(pathes, (x) => promiseSymbolLink(x));
    let anyLink = await promises.any().catch((e) => {
      console.error(e);
    });
    let msg = util.format(notInPathError, tool);
    if (typeof anyLink !== 'undefined') {
      if (anyLink.type === 'link') {
        _pathesCache[tool] = anyLink.path;
      } else {
        return Promise.resolve(anyLink.path);
      }
    } else {
      // vscode.window.showInformationMessage(msg);
      // return Promise.reject(msg)
    }
    if (process.platform !== 'win32') {
      try {
        let nimPath = readlink(_pathesCache[tool]);
        _pathesCache[tool] = nimPath;
      } catch (e) {
        console.error(e);
        vscode.window.showErrorMessage(msg);
        return Promise.reject();
        // ignore exception
      }
    }
  }
  return Promise.resolve(_pathesCache[tool]);
}

export function correctBinname(binname: string): string {
  if (process.platform === 'win32') {
    return binname + '.exe';
  } else {
    return binname;
  }
}

export async function getExecutableInfo(exe: string): Promise<ExecutableInfo> {
  var exePath,
    exeVersion: string = '';

  let configuredExePath = <string>vscode.workspace.getConfiguration('nim').get(exe);
  if (configuredExePath) {
    exePath = configuredExePath;
  } else {
    let binPath = await getBinPath(exe);
    exePath = path.resolve(path.dirname(binPath), correctBinname(exe));
  }
  if (fs.existsSync(exePath)) {
    let versionOutput = cp.spawnSync(exePath, ['--version']).output.toString();
    let versionArgs = /(?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)/g.exec(versionOutput);
    console.log(versionArgs);
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
