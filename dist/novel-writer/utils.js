"use strict";
/**
 * Utility functions for novel writer
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateTokens = estimateTokens;
exports.ensureDir = ensureDir;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.countWords = countWords;
exports.formatChapterNumber = formatChapterNumber;
exports.parseGlobalSummary = parseGlobalSummary;
exports.serializeGlobalSummary = serializeGlobalSummary;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Rough token estimation: ~4 characters per token for Chinese
 * More accurate: ~1.3 characters per token for Chinese
 * We use 1.5 to be safe
 */
function estimateTokens(text) {
    return Math.ceil(text.length / 1.5);
}
/**
 * Ensure directory exists, create if not
 */
async function ensureDir(dirPath) {
    if (!fs_1.default.existsSync(dirPath)) {
        await fs_1.default.promises.mkdir(dirPath, { recursive: true });
    }
}
/**
 * Read file content with error handling
 */
async function readFile(filePath) {
    try {
        return await fs_1.default.promises.readFile(filePath, 'utf-8');
    }
    catch (error) {
        throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
}
/**
 * Write file with directory creation
 */
async function writeFile(filePath, content) {
    await ensureDir(path_1.default.dirname(filePath));
    await fs_1.default.promises.writeFile(filePath, content, 'utf-8');
}
/**
 * Count words (characters for Chinese)
 */
function countWords(text) {
    return text.replace(/\s+/g, '').length;
}
/**
 * Format chapter number with leading zero
 */
function formatChapterNumber(num) {
    return num.toString().padStart(2, '0');
}
/**
 * Parse global summary text into structured GlobalSummary
 */
function parseGlobalSummary(text) {
    // Simple parsing based on markdown sections
    const summary = {
        setting: '',
        characters: [],
        mainPlot: '',
        clues: [],
        completedArcs: [],
    };
    const sections = text.split(/^##\s+/m);
    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed)
            continue;
        const lines = trimmed.split('\n');
        const heading = lines[0].trim().toLowerCase();
        const content = lines.slice(1).join('\n').trim();
        if (heading.includes('设定') || heading.includes('setting')) {
            summary.setting = content;
        }
        else if (heading.includes('人物') || heading.includes('character')) {
            // Parse character list
            const charLines = content.split('\n').filter(line => line.trim());
            for (const line of charLines) {
                const match = line.match(/^[*-]\s*\*\*(.*?)\*\*:\s*(.*)$/);
                if (match) {
                    summary.characters.push({
                        name: match[1],
                        description: match[2],
                        status: 'active',
                    });
                }
                else if (line.startsWith('- ') || line.startsWith('* ')) {
                    const parts = line.substring(2).split(':', 2);
                    if (parts.length === 2) {
                        summary.characters.push({
                            name: parts[0].trim(),
                            description: parts[1].trim(),
                            status: 'active',
                        });
                    }
                }
            }
        }
        else if (heading.includes('主线') || heading.includes('main')) {
            summary.mainPlot = content;
        }
        else if (heading.includes('伏笔') || heading.includes('clue')) {
            summary.clues = content.split('\n')
                .map(line => line.replace(/^[*-]\s*/, '').trim())
                .filter(line => line);
        }
        else if (heading.includes('完成') || heading.includes('completed')) {
            summary.completedArcs = content.split('\n')
                .map(line => line.replace(/^[*-]\s*/, '').trim())
                .filter(line => line);
        }
    }
    return summary;
}
/**
 * Serialize GlobalSummary to markdown
 */
function serializeGlobalSummary(summary) {
    let output = '';
    if (summary.setting) {
        output += '## 世界观设定\n\n' + summary.setting + '\n\n';
    }
    if (summary.characters && summary.characters.length > 0) {
        output += '## 主要人物\n\n';
        for (const char of summary.characters) {
            output += `- **${char.name}**: ${char.description}\n`;
        }
        output += '\n';
    }
    if (summary.mainPlot) {
        output += '## 主线进展\n\n' + summary.mainPlot + '\n\n';
    }
    if (summary.clues && summary.clues.length > 0) {
        output += '## 活跃伏笔\n\n';
        for (const clue of summary.clues) {
            output += `- ${clue}\n`;
        }
        output += '\n';
    }
    if (summary.completedArcs && summary.completedArcs.length > 0) {
        output += '## 已完结情节\n\n';
        for (const arc of summary.completedArcs) {
            output += `- ${arc}\n`;
        }
        output += '\n';
    }
    return output.trim();
}
