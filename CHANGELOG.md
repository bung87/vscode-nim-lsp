# 0.0.16
- Fix extension startup with no `workspaceFolder`  
  you can open a folder then go to a nim file not related to this folder, when you reopen this project, editor document is that file, `getWorkspaceFolder` from that file is `undefined`

# 0.0.15
- Add check Nim file command  

# 0.0.13
- Add document formatting support using nimpretty exe  

# Change Log
All notable changes to the "vscode-nim-extension" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
- Initial release