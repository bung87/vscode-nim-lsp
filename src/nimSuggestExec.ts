'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import path = require('path');
import fs = require('fs');
import { commands } from 'vscode';
import { correctBinname, readlink, promiseSymbolLink, getExecutableInfo } from './extensionUtils';
import bluebird = require('bluebird');


export async function setNimSuggester() {
    let name = "nimsuggest"
    let nimsuggest = await getExecutableInfo(name)
    if (process.env['PATH']) {
        var pathparts = process.env.PATH.split(path.delimiter)
            .filter((value, index, self) => self.indexOf(value) === index)
            .reverse();
        if (process.platform !== 'win32') {
            pathparts = pathparts.filter(x => x.indexOf("/sbin") === -1)
        }
        let pathes = pathparts.map(dir => path.join(dir, correctBinname(name))).filter(x => fs.existsSync(x));
        let promises = pathes.map(x => promiseSymbolLink(x))
        let pp = await bluebird.all(promises).catch(e => {
            console.error(e)
        });
        let items: any[] = []
        var exePath, exeVersion: string
        if (pp)
            pp.forEach(anyLink => {
                if (typeof anyLink !== 'undefined') {
                    if (anyLink.type === 'link') {
                        exePath = readlink(anyLink.path)
                    } else {
                        exePath = anyLink.path
                    }
                    let versionOutput = cp.spawnSync(exePath, ['--version']).output.toString();
                    let versionArgs = /(?:(\d+)\.)?(?:(\d+)\.)?(\*|\d+)/g.exec(versionOutput);
                    if (versionArgs)
                        exeVersion = versionArgs[0];
                    items.push({ label: `nimsuggest`, description: `${exeVersion}`, detail: exePath })
                }
            })

        const p = vscode.window.showQuickPick(items, { placeHolder: `current ${nimsuggest.path}`, matchOnDetail: true });
        p.then(item => {
            if (!item || nimsuggest.path === item.detail) return;
            let nim = vscode.workspace.getConfiguration('nim');
            nim.update('nimsuggest', item.detail).then(_ => {
                commands.executeCommand('workbench.action.reloadWindow');
            });
        });
    }
}
