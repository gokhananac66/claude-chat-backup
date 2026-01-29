export interface ClaudeMessage {
    type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result' | 'other';
    role?: string;
    content: string;
    timestamp: Date;
    uuid: string;
    sessionId: string;
    thinking?: string;
}

export interface ParsedSession {
    sessionId: string;
    projectPath: string;
    messages: ClaudeMessage[];
    startTime: Date;
    endTime: Date;
}

interface RawMessage {
    type?: string;
    message?: {
        role?: string;
        content?: Array<{
            type: string;
            text?: string;
            thinking?: string;
        }>;
    };
    uuid?: string;
    timestamp?: string;
    sessionId?: string;
    cwd?: string;
}

export function parseJsonlLine(line: string): ClaudeMessage | null {
    if (!line.trim()) {
        return null;
    }

    try {
        const data: RawMessage = JSON.parse(line);

        // Skip non-message types
        if (!data.type || !['user', 'assistant'].includes(data.type)) {
            return null;
        }

        if (!data.message?.content) {
            return null;
        }

        // Extract text content
        let content = '';
        let thinking = '';

        for (const item of data.message.content) {
            if (item.type === 'text' && item.text) {
                content += item.text;
            } else if (item.type === 'thinking' && item.thinking) {
                thinking = item.thinking;
            }
        }

        // Skip if no content
        if (!content && !thinking) {
            return null;
        }

        return {
            type: data.type as 'user' | 'assistant',
            role: data.message.role,
            content: content,
            thinking: thinking || undefined,
            timestamp: new Date(data.timestamp || Date.now()),
            uuid: data.uuid || '',
            sessionId: data.sessionId || ''
        };
    } catch {
        return null;
    }
}

export function parseJsonlFile(content: string): ClaudeMessage[] {
    const lines = content.split('\n');
    const messages: ClaudeMessage[] = [];
    const seenUuids = new Set<string>();

    for (const line of lines) {
        const message = parseJsonlLine(line);
        if (message && message.content) {
            // Deduplicate by uuid (Claude sends multiple chunks for same message)
            const key = `${message.uuid}-${message.content.slice(0, 50)}`;
            if (!seenUuids.has(key)) {
                seenUuids.add(key);
                messages.push(message);
            }
        }
    }

    return messages;
}

export function extractSessionInfo(filePath: string, messages: ClaudeMessage[]): ParsedSession {
    const sessionId = messages[0]?.sessionId || 'unknown';
    const projectPath = messages[0]?.sessionId || filePath;

    const timestamps = messages.map(m => m.timestamp.getTime());
    const startTime = new Date(Math.min(...timestamps));
    const endTime = new Date(Math.max(...timestamps));

    return {
        sessionId,
        projectPath,
        messages,
        startTime,
        endTime
    };
}
