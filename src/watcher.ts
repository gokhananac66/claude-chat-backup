import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from './config';
import { parseJsonlFile, extractSessionInfo, ParsedSession } from './parser';
import { toMarkdown, toJson, generateFileName } from './converter';

interface IndexEntry {
    date: string;
    sessionId: string;
    topic: string;
    messageCount: number;
    fileName: string;
}

export class ClaudeWatcher {
    private watcher: vscode.FileSystemWatcher | null = null;
    private config: Config;
    private outputChannel: vscode.OutputChannel;
    private statusBarItem: vscode.StatusBarItem;
    private processedFiles: Map<string, number> = new Map(); // file path -> last size
    private isWatching: boolean = false;
    private pollInterval: NodeJS.Timeout | null = null;

    constructor(config: Config, outputChannel: vscode.OutputChannel, statusBarItem: vscode.StatusBarItem) {
        this.config = config;
        this.outputChannel = outputChannel;
        this.statusBarItem = statusBarItem;
    }

    async start(): Promise<void> {
        if (this.isWatching) {
            this.log('Already watching');
            return;
        }

        // Ensure output directory exists
        await this.ensureOutputDir();

        // Check if Claude projects directory exists
        if (!fs.existsSync(this.config.claudeProjectsPath)) {
            this.log(`Claude projects directory not found: ${this.config.claudeProjectsPath}`);
            vscode.window.showWarningMessage('Claude projects directory not found. Make sure Claude Code is installed.');
            return;
        }

        this.log(`Starting watcher on: ${this.config.claudeProjectsPath}`);

        // Use VS Code's FileSystemWatcher
        const pattern = new vscode.RelativePattern(this.config.claudeProjectsPath, '**/*.jsonl');
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, true);

        this.watcher.onDidCreate((uri) => this.handleFile(uri.fsPath));
        this.watcher.onDidChange((uri) => this.handleFile(uri.fsPath));

        // Also poll for changes since FileSystemWatcher may miss some updates
        this.pollInterval = setInterval(() => this.scanForChanges(), 5000);

        // Process existing files
        await this.scanForChanges();

        this.isWatching = true;
        this.updateStatusBar();
        this.log('Watcher started');
        vscode.window.showInformationMessage('Claude Chat Backup: Watching started');
    }

    stop(): void {
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = null;
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isWatching = false;
        this.updateStatusBar();
        this.log('Watcher stopped');
        vscode.window.showInformationMessage('Claude Chat Backup: Watching stopped');
    }

    private async scanForChanges(): Promise<void> {
        try {
            const projects = fs.readdirSync(this.config.claudeProjectsPath);
            for (const project of projects) {
                const projectPath = path.join(this.config.claudeProjectsPath, project);
                const stat = fs.statSync(projectPath);
                if (stat.isDirectory()) {
                    const files = fs.readdirSync(projectPath);
                    for (const file of files) {
                        if (file.endsWith('.jsonl') && !file.includes('agent-')) {
                            await this.handleFile(path.join(projectPath, file));
                        }
                    }
                }
            }
        } catch (error) {
            // Ignore scan errors
        }
    }

    private async handleFile(filePath: string): Promise<void> {
        // Only process .jsonl files
        if (!filePath.endsWith('.jsonl')) {
            return;
        }

        // Skip agent files
        if (path.basename(filePath).startsWith('agent-')) {
            return;
        }

        try {
            const stats = fs.statSync(filePath);
            const lastSize = this.processedFiles.get(filePath) || 0;

            // Skip if file hasn't grown
            if (stats.size <= lastSize) {
                return;
            }

            this.log(`Processing: ${path.basename(filePath)}`);

            // Read and parse file
            const content = fs.readFileSync(filePath, 'utf-8');
            const messages = parseJsonlFile(content);

            if (messages.length === 0) {
                return;
            }

            const session = extractSessionInfo(filePath, messages);

            // Extract project name from path
            const projectDir = path.dirname(filePath);
            const projectName = path.basename(projectDir);

            // Create project output directory
            const projectOutputDir = path.join(this.config.outputPath, projectName);
            await fs.promises.mkdir(projectOutputDir, { recursive: true });

            // Export in configured formats
            if (this.config.formats.includes('markdown')) {
                const mdContent = toMarkdown(session);
                const mdFileName = generateFileName(session, 'markdown');
                const mdPath = path.join(projectOutputDir, mdFileName);
                await fs.promises.writeFile(mdPath, mdContent, 'utf-8');
                this.log(`Saved: ${mdFileName}`);
            }

            if (this.config.formats.includes('json')) {
                const jsonContent = toJson(session);
                const jsonFileName = generateFileName(session, 'json');
                const jsonPath = path.join(projectOutputDir, jsonFileName);
                await fs.promises.writeFile(jsonPath, jsonContent, 'utf-8');
                this.log(`Saved: ${jsonFileName}`);
            }

            // Update processed size
            this.processedFiles.set(filePath, stats.size);

            // Update index file for this project
            await this.updateIndexFile(projectOutputDir);

        } catch (error) {
            this.log(`Error processing ${filePath}: ${error}`);
        }
    }

    private async updateIndexFile(projectOutputDir: string): Promise<void> {
        try {
            const files = fs.readdirSync(projectOutputDir);
            const mdFiles = files.filter(f => f.endsWith('.md') && f !== '_index.md');

            const entries: IndexEntry[] = [];

            for (const mdFile of mdFiles) {
                const mdPath = path.join(projectOutputDir, mdFile);
                const content = fs.readFileSync(mdPath, 'utf-8');

                // Extract info from markdown content
                const sessionMatch = content.match(/\*\*Session ID:\*\* `([^`]+)`/);
                const sessionId = sessionMatch ? sessionMatch[1].slice(0, 8) : 'unknown';

                // Find first user message as topic
                const userMsgMatch = content.match(/## 👤 Kullanıcı \([^)]+\)\n\n([^\n]+)/);
                let topic = userMsgMatch ? userMsgMatch[1] : 'Konuşma';

                // Clean and truncate topic
                topic = topic.replace(/<[^>]+>/g, '').trim(); // Remove HTML/XML tags
                if (topic.length > 60) {
                    topic = topic.slice(0, 57) + '...';
                }

                // Count messages
                const userCount = (content.match(/## 👤 Kullanıcı/g) || []).length;
                const assistantCount = (content.match(/## 🤖 Claude/g) || []).length;
                const messageCount = userCount + assistantCount;

                // Extract date from filename (format: 2026-01-29_sessionid.md)
                const dateMatch = mdFile.match(/^(\d{4}-\d{2}-\d{2})/);
                const date = dateMatch ? dateMatch[1] : 'unknown';

                entries.push({
                    date,
                    sessionId,
                    topic,
                    messageCount,
                    fileName: mdFile
                });
            }

            // Sort by date descending (newest first)
            entries.sort((a, b) => b.date.localeCompare(a.date));

            // Generate index content
            const projectName = path.basename(projectOutputDir);
            let indexContent = `# Konuşma Geçmişi\n\n`;
            indexContent += `**Proje:** \`${projectName}\`\n`;
            indexContent += `**Toplam Konuşma:** ${entries.length}\n\n`;
            indexContent += `---\n\n`;
            indexContent += `| Tarih | Konu | Mesaj | Dosya |\n`;
            indexContent += `|-------|------|-------|-------|\n`;

            for (const entry of entries) {
                indexContent += `| ${entry.date} | ${entry.topic} | ${entry.messageCount} | [${entry.sessionId}.md](${entry.fileName}) |\n`;
            }

            indexContent += `\n---\n\n`;
            indexContent += `*Bu dosya otomatik oluşturulmuştur. Son güncelleme: ${new Date().toLocaleString('tr-TR')}*\n`;

            const indexPath = path.join(projectOutputDir, '_index.md');
            await fs.promises.writeFile(indexPath, indexContent, 'utf-8');
            this.log(`Index updated: ${projectName}/_index.md`);

        } catch (error) {
            this.log(`Error updating index: ${error}`);
        }
    }

    private async ensureOutputDir(): Promise<void> {
        try {
            await fs.promises.mkdir(this.config.outputPath, { recursive: true });
        } catch (error) {
            this.log(`Failed to create output directory: ${error}`);
        }
    }

    private updateStatusBar(): void {
        if (this.isWatching) {
            this.statusBarItem.text = '$(eye) Claude Backup';
            this.statusBarItem.tooltip = 'Claude Chat Backup: Watching';
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = '$(eye-closed) Claude Backup';
            this.statusBarItem.tooltip = 'Claude Chat Backup: Stopped';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        this.statusBarItem.show();
    }

    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    getIsWatching(): boolean {
        return this.isWatching;
    }

    updateConfig(config: Config): void {
        this.config = config;
    }
}
