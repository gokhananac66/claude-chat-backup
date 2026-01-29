import { ClaudeMessage, ParsedSession } from './parser';

export function toMarkdown(session: ParsedSession): string {
    const lines: string[] = [];

    // Header
    const dateStr = session.startTime.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    lines.push(`# Claude Konuşması`);
    lines.push('');
    lines.push(`**Tarih:** ${dateStr}`);
    lines.push(`**Session ID:** \`${session.sessionId}\``);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Messages
    for (const msg of session.messages) {
        const timeStr = msg.timestamp.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const role = msg.type === 'user' ? '👤 Kullanıcı' : '🤖 Claude';

        lines.push(`## ${role} (${timeStr})`);
        lines.push('');
        lines.push(msg.content);
        lines.push('');

        // Include thinking if present (collapsed)
        if (msg.thinking) {
            lines.push('<details>');
            lines.push('<summary>💭 Düşünce Süreci</summary>');
            lines.push('');
            lines.push(msg.thinking);
            lines.push('');
            lines.push('</details>');
            lines.push('');
        }

        lines.push('---');
        lines.push('');
    }

    return lines.join('\n');
}

export interface JsonExport {
    version: string;
    exportedAt: string;
    session: {
        id: string;
        projectPath: string;
        startTime: string;
        endTime: string;
        messageCount: number;
    };
    messages: Array<{
        type: string;
        content: string;
        thinking?: string;
        timestamp: string;
        uuid: string;
    }>;
}

export function toJson(session: ParsedSession): string {
    const exportData: JsonExport = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        session: {
            id: session.sessionId,
            projectPath: session.projectPath,
            startTime: session.startTime.toISOString(),
            endTime: session.endTime.toISOString(),
            messageCount: session.messages.length
        },
        messages: session.messages.map(msg => ({
            type: msg.type,
            content: msg.content,
            thinking: msg.thinking,
            timestamp: msg.timestamp.toISOString(),
            uuid: msg.uuid
        }))
    };

    return JSON.stringify(exportData, null, 2);
}

export function generateFileName(session: ParsedSession, format: 'markdown' | 'json'): string {
    const date = session.startTime.toISOString().split('T')[0];
    const shortId = session.sessionId.slice(0, 8);
    const ext = format === 'markdown' ? 'md' : 'json';

    return `${date}_${shortId}.${ext}`;
}
