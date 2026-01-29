import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './config';
import { ClaudeWatcher } from './watcher';

let watcher: ClaudeWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Claude Chat Backup extension is now active');

    const outputChannel = vscode.window.createOutputChannel('Claude Chat Backup');
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

    // Get default storage path from extension context
    const defaultStoragePath = path.join(context.globalStorageUri.fsPath, 'conversations');

    const config = getConfig(defaultStoragePath);
    watcher = new ClaudeWatcher(config, outputChannel, statusBarItem);

    // Register commands
    const startCommand = vscode.commands.registerCommand('claudeBackup.startWatching', () => {
        if (watcher) {
            watcher.start();
        }
    });

    const stopCommand = vscode.commands.registerCommand('claudeBackup.stopWatching', () => {
        if (watcher) {
            watcher.stop();
        }
    });

    const exportCommand = vscode.commands.registerCommand('claudeBackup.exportSession', async () => {
        vscode.window.showInformationMessage('Export functionality: Use the watcher to automatically export sessions.');
    });

    const openFolderCommand = vscode.commands.registerCommand('claudeBackup.openFolder', async () => {
        const currentConfig = getConfig(defaultStoragePath);
        const folderUri = vscode.Uri.file(currentConfig.outputPath);

        try {
            await vscode.commands.executeCommand('revealFileInOS', folderUri);
        } catch {
            // Fallback: open in VS Code
            vscode.commands.executeCommand('vscode.openFolder', folderUri, { forceNewWindow: true });
        }
    });

    // Listen for configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('claudeBackup')) {
            const newConfig = getConfig(defaultStoragePath);
            if (watcher) {
                watcher.updateConfig(newConfig);
                outputChannel.appendLine('Configuration updated');
            }
        }
    });

    // Add to subscriptions
    context.subscriptions.push(
        startCommand,
        stopCommand,
        exportCommand,
        openFolderCommand,
        configWatcher,
        outputChannel,
        statusBarItem
    );

    // Auto-start if configured
    if (config.autoStart) {
        watcher.start();
    }

    // Show status bar item
    statusBarItem.command = 'claudeBackup.startWatching';
    statusBarItem.show();

    outputChannel.appendLine('Claude Chat Backup extension activated');
    outputChannel.appendLine(`Output path: ${config.outputPath}`);
    outputChannel.appendLine(`Formats: ${config.formats.join(', ')}`);
}

export function deactivate() {
    if (watcher) {
        watcher.stop();
    }
}
