import * as vscode from 'vscode';
import { ExecutableInfo } from './interfaces';
import fs = require('fs');
import path = require('path');
import cp = require('child_process');
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
    return _pathesCache[tool];
  }
  if (process.env['PATH']) {
    // add support for choosenim
    process.env['PATH'] =
      process.env['PATH'] + (<any>path).delimiter + process.env['HOME'] + '/.nimble/bin';
    var pathparts = (<string>process.env.PATH).split((<any>path).delimiter);
    _pathesCache[tool] = pathparts
      .map((dir) => path.join(dir, correctBinname(tool)))
      .filter((candidate) => fs.existsSync(candidate))[0];
    if (process.platform !== 'win32') {
      try {
        let nimPath;
        if (process.platform === 'darwin') {
          nimPath = cp.execFileSync('readlink', [_pathesCache[tool]]).toString().trim();
          if (nimPath.length > 0 && !path.isAbsolute(nimPath)) {
            nimPath = path.normalize(path.join(path.dirname(_pathesCache[tool]), nimPath));
          }
        } else if (process.platform === 'linux') {
          nimPath = cp.execFileSync('readlink', ['-f', _pathesCache[tool]]).toString().trim();
        } else {
          nimPath = cp.execFileSync('readlink', [_pathesCache[tool]]).toString().trim();
        }

        if (nimPath.length > 0) {
          _pathesCache[tool] = nimPath;
        }
      } catch (e) {
        // ignore exception
      }
    }
  }
  return _pathesCache[tool];
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
