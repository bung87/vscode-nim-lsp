import * as vscode from 'vscode';
import { ExecutableInfo } from './interfaces';
import fs = require('fs');
import path = require('path');
import cp = require('child_process');
import util = require('util');
import bluebird = require('bluebird');
const lstat = util.promisify(fs.lstat);

const notInPathError = 'No %s binary could be found in PATH environment variable';
let _pathesCache: { [tool: string]: string } = {};

export function promiseSymbolLink(path: string): Promise<{ path: string; type: string }> {
  return new Promise<{ path: string; type: string }>((resolve, reject) => {
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
    var pathparts = (<string>process.env.PATH)
      .split((<any>path).delimiter)
      .filter((value, index, self) => self.indexOf(value) === index)
      .reverse();
    // pathparts = pathparts.filter((x) => x.indexOf('/sbin') === -1);
    // pathparts = pathparts.filter((x) => {
    //   if (x.match('([a-zA-Z0-9_-]+)+[0-9.]+') || x.match('.[a-zA-Z]+')) {
    //     return x.toLowerCase().indexOf('nim') !== -1;
    //   } else {
    //     return true;
    //   }
    // });
    let pathes: string[] = [];
    if (process.platform === 'win32') {
      pathes = [
        ...pathparts.map((dir) => path.join(dir, `${tool}.exe`)),
        ...pathparts.map((dir) => path.join(dir, `${tool}.cmd`)),
      ];
    } else {
      pathes = pathparts.map((dir) => path.join(dir, tool));
    }
    let promises = pathes.filter((x) => fs.existsSync(x)).map(promiseSymbolLink);
    let anyFile = await bluebird.any(promises).catch((e) => {
      console.error(e);
    });
    let msg = `No ${tool} binary could be found in PATH environment variable`;
    if (typeof anyFile !== 'undefined') {
      if (anyFile.type === 'link') {
        _pathesCache[tool] = anyFile.path;
      } else {
        _pathesCache[tool] = anyFile.path;
        return Promise.resolve(anyFile.path);
      }
    } else {
      // vscode.window.showInformationMessage(msg);
      // return Promise.reject(msg)
    }
    if (process.platform !== 'win32') {
      try {
        let nimPath = readlink(_pathesCache[tool]);
        if (nimPath.length > 0) {
          _pathesCache[tool] = nimPath;
        }
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

export async function getExecutableInfo(exe: string): Promise<ExecutableInfo> {
  var exePath,
    exeVersion: string = '';

  let configuredExePath = <string>vscode.workspace.getConfiguration('nim').get(exe);
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
