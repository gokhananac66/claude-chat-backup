import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export interface Config {
    claudeProjectsPath: string;
    outputPath: string;
    autoStart: boolean;
    formats: ('markdown' | 'json')[];
}

export function getConfig(defaultStoragePath?: string): Config {
    const config = vscode.workspace.getConfiguration('claudeBackup');

    const claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');

    let outputPath = config.get<string>('outputPath') || '';
    if (!outputPath) {
        // Use VS Code's global storage path (extension data folder)
        outputPath = defaultStoragePath || path.join(os.homedir(), 'claude-conversations');
    } else if (outputPath.startsWith('~')) {
        outputPath = path.join(os.homedir(), outputPath.slice(1));
    }

    return {
        claudeProjectsPath,
        outputPath,
        autoStart: config.get<boolean>('autoStart') ?? true,
        formats: config.get<('markdown' | 'json')[]>('formats') ?? ['markdown', 'json']
    };
}
