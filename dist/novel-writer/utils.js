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
exports.extractLikelyCreatureNames = extractLikelyCreatureNames;
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
const CREATURE_NAME_CONTEXT_PATTERNS = [
    /(?:\u4e00\u53ea|\u4e00\u5934|\u4e00\u6761|\u4e00\u5c3e|\u4e00\u7fa4|\u4e00\u5339|\u4e00\u7fbd|\u4e00\u5c0a|\u6570\u53ea|\u6570\u5934|\u90a3\u53ea|\u8fd9\u53ea|\u90a3\u5934|\u8fd9\u5934|\u6b64\u517d|\u6b64\u9e1f|\u8be5\u517d|\u540d\u4e3a|\u5524\u4f5c|\u53f7\u4e3a|\u88ab\u79f0\u4e3a|\u906d\u9047|\u9047\u5230|\u649e\u89c1|\u770b\u89c1|\u77a7\u89c1|\u53d1\u73b0|\u60ca\u89c1|\u51fa\u73b0(?:\u4e86)?|\u7a9c\u51fa|\u6251\u6765|\u76d8\u8e1e(?:\u7740)?|\u6816\u606f(?:\u7740)?|\u53ec\u6765|\u9a6d\u4f7f)([\u4e00-\u9fa5]{2,6})/g,
    /([\u4e00-\u9fa5]{2,6})(?:\u4ece[\u4e00-\u9fa5]{0,8})?(?:\u7a9c\u51fa|\u6251\u6765|\u88ad\u6765|\u76d8\u8e1e|\u6816\u606f|\u5636\u9e23|\u5486\u54ee|\u632f\u7fc5|\u98de\u8fc7|\u63a0\u8fc7)/g,
    /(?:\u201c|\u300a)([\u4e00-\u9fa5]{2,6})(?:\u201d|\u300b)/g,
];
const CREATURE_SUFFIX_PATTERN = /[\u4e00-\u9fa5]{2,6}(?:\u517d|\u9e1f|\u96c0|\u9e26|\u9e3e|\u51e4|\u9e4f|\u9e64|\u9e70|\u96bc|\u9e22|\u866b|\u8776|\u8702|\u8681|\u8749|\u86db|\u874e|\u87fe|\u86c7|\u87d2|\u86df|\u9f99|\u9e9f|\u9e92|\u9f9f|\u9cc4|\u9c7c|\u9ca4|\u9cb2|\u9cb8|\u9ca8|\u9f20|\u72fc|\u864e|\u8c79|\u72d0|\u72ac|\u72d7|\u732b|\u5154|\u9e7f|\u733f|\u7334|\u725b|\u9a6c|\u7f8a|\u732a|\u8c82|\u736d|\u718a|\u8c61|\u7280|\u8725|\u5996|\u602a|\u7075|\u9b45|\u9b48|\u8349|\u829d|\u82b1|\u6811|\u6728|\u679d|\u53f6|\u85e4|\u8513|\u679c|\u6839|\u7af9|\u82d4|\u85d3|\u83b2|\u8377|\u6885|\u5170|\u83ca)$/;
const CREATURE_SUFFIX_TAIL_PATTERN = /([\u4e00-\u9fa5]{2,6}(?:\u517d|\u9e1f|\u96c0|\u9e26|\u9e3e|\u51e4|\u9e4f|\u9e64|\u9e70|\u96bc|\u9e22|\u866b|\u8776|\u8702|\u8681|\u8749|\u86db|\u874e|\u87fe|\u86c7|\u87d2|\u86df|\u9f99|\u9e9f|\u9e92|\u9f9f|\u9cc4|\u9c7c|\u9ca4|\u9cb2|\u9cb8|\u9ca8|\u9f20|\u72fc|\u864e|\u8c79|\u72d0|\u72ac|\u72d7|\u732b|\u5154|\u9e7f|\u733f|\u7334|\u725b|\u9a6c|\u7f8a|\u732a|\u8c82|\u736d|\u718a|\u8c61|\u7280|\u8725|\u5996|\u602a|\u7075|\u9b45|\u9b48|\u8349|\u829d|\u82b1|\u6811|\u6728|\u679d|\u53f6|\u85e4|\u8513|\u679c|\u6839|\u7af9|\u82d4|\u85d3|\u83b2|\u8377|\u6885|\u5170|\u83ca))$/;
const PLANT_NAME_PATTERN = /([\u4e00-\u9fa5]{1,4}(?:\u8349|\u829d|\u82b1|\u6811|\u6728|\u85e4|\u8513|\u679c|\u6839|\u7af9))(?=[\u4e0e\u548c\u53ca\u3001\uff0c\u3002\uff1b\uff1a\uff01\uff1f,\.;:!?]|$)/g;
const CREATURE_EXCLUDED_WORDS = new Set([
    '\u7ae0\u8282', '\u6458\u8981', '\u4e3b\u89d2', '\u672c\u7ae0', '\u4eba\u7269', '\u5173\u7cfb', '\u8bbe\u5b9a',
    '\u4e16\u754c', '\u6545\u4e8b', '\u5267\u60c5', '\u5185\u5bb9', '\u6807\u9898', '\u540d\u79f0', '\u72b6\u6001',
    '\u53d1\u5c55', '\u60c5\u8282', '\u80cc\u666f', '\u603b\u7ed3', '\u8981\u70b9', '\u7b2c\u4e00', '\u7b2c\u4e8c', '\u7b2c\u4e09',
    '\u8fd9\u4e2a', '\u90a3\u4e2a', '\u4e00\u79cd', '\u4e00\u4e9b', '\u8fd9\u4e9b', '\u90a3\u4e9b', '\u81ea\u5df1', '\u4ed6\u4eec',
    '\u6211\u4eec', '\u4f60\u4eec', '\u8fd9\u91cc', '\u90a3\u91cc', '\u4ec0\u4e48', '\u4e3a\u4f55', '\u5982\u4f55', '\u4e8e\u662f',
    '\u7136\u540e', '\u4f46\u662f', '\u5982\u679c', '\u56e0\u4e3a', '\u6240\u4ee5', '\u5df2\u7ecf', '\u6b63\u5728', '\u7ee7\u7eed',
    '\u5b89\u6392', '\u5b89\u5168', '\u6309\u4f4f', '\u62d4\u8fdb', '\u5b69\u5b50', '\u5f71\u5b50', '\u9e1f\u86cb',
]);
const CREATURE_EXCLUDED_SUBSTRINGS = [
    '\u5b89\u6392', '\u5b89\u5168', '\u6309\u4f4f', '\u62d4\u8fdb', '\u770b\u89c1\u4e86', '\u542c\u89c1\u4e86', '\u53d1\u73b0\u4e86', '\u5b69\u5b50',
    '\u65f6\u5019', '\u5f71\u5b50', '\u5176\u4ed6', '\u4ec0\u4e48', '\u600e\u4e48', '\u6ca1\u6709', '\u4e0d\u662f', '\u53ef\u4ee5', '\u968f\u540e',
];
const CREATURE_LEADING_NOISE = /^(?:\u8fd9\u53ea|\u90a3\u53ea|\u8fd9\u5934|\u90a3\u5934|\u4e00\u53ea|\u4e00\u5934|\u4e00\u6761|\u4e00\u5c3e|\u4e00\u7fa4|\u4e00\u5339|\u4e00\u7fbd|\u6570\u53ea|\u6570\u5934|\u53ea\u89c1|\u770b\u89c1|\u77a7\u89c1|\u53d1\u73b0|\u60ca\u89c1|\u906d\u9047|\u9047\u5230|\u649e\u89c1|\u51fa\u73b0\u4e86?|\u540d\u4e3a|\u5524\u4f5c|\u53f7\u4e3a|\u88ab\u79f0\u4e3a|\u968f\u540e|\u7136\u540e|\u5ffd\u7136|\u7a81\u7136|\u65cb\u5373|\u987f\u65f6|\u7acb\u523b|\u731b\u7136|\u7adf\u7136|\u679c\u7136|\u4fbf\u89c1|\u5374\u89c1|\u5ffd\u89c1|\u518d\u770b|\u773c\u89c1|\u524d\u65b9|\u540e\u65b9)+/;
const CREATURE_LEADING_PARTICLES = /^[\u4e86\u7684\u4e4b\u5176\u67d0\u4e2a\u53ea\u5934\u6761\u7fa4\u5339\u7fbd\u5c0a]/;
function cleanCreatureCandidate(candidate) {
    let cleaned = candidate.trim().replace(/[，。！？；：“”"'（）《》【】\[\]\s]/g, '');
    cleaned = cleaned.replace(CREATURE_LEADING_NOISE, '');
    cleaned = cleaned.split(/[\u4e0e\u548c\u53ca\u3001]/)[0] || cleaned;
    cleaned = cleaned.replace(/^[\u4e0e\u548c\u53ca\u53c8]/, '');
    cleaned = cleaned.replace(CREATURE_LEADING_PARTICLES, '');
    if (cleaned.length > 6) {
        const tailMatch = cleaned.match(CREATURE_SUFFIX_TAIL_PATTERN);
        if (tailMatch) {
            cleaned = tailMatch[1];
        }
    }
    return cleaned;
}
function isLikelyCreatureCandidate(candidate, knownNames) {
    if (!candidate || candidate.length < 2 || candidate.length > 6) {
        return false;
    }
    if (knownNames.has(candidate)) {
        return true;
    }
    if (CREATURE_EXCLUDED_WORDS.has(candidate)) {
        return false;
    }
    if (CREATURE_EXCLUDED_SUBSTRINGS.some(part => candidate.includes(part))) {
        return false;
    }
    if (/^(?:他的|她的|它的|我的|你的|一个|一些|这种|那种)/.test(candidate)) {
        return false;
    }
    return CREATURE_SUFFIX_PATTERN.test(candidate);
}
function extractLikelyCreatureNames(text, existingNames = []) {
    if (!text.trim()) {
        return [];
    }
    const knownNames = new Set(existingNames.filter(Boolean));
    const results = [];
    const seen = new Set();
    const addCandidate = (rawCandidate) => {
        const candidate = cleanCreatureCandidate(rawCandidate);
        if (!candidate || seen.has(candidate)) {
            return;
        }
        if (!isLikelyCreatureCandidate(candidate, knownNames)) {
            return;
        }
        seen.add(candidate);
        results.push(candidate);
    };
    const sortedExistingNames = [...knownNames].sort((a, b) => b.length - a.length);
    for (const name of sortedExistingNames) {
        if (text.includes(name)) {
            addCandidate(name);
        }
    }
    PLANT_NAME_PATTERN.lastIndex = 0;
    let plantMatch;
    while ((plantMatch = PLANT_NAME_PATTERN.exec(text)) !== null) {
        addCandidate(plantMatch[1]);
    }
    const lines = text
        .split(/\r?\n/)
        .flatMap(line => line.split(/[，。！？；：,.!?;:]/))
        .map(part => part.trim())
        .filter(Boolean);
    for (const line of lines) {
        const fragments = line
            .split(/[\u4e0e\u548c\u53ca\u3001]/)
            .map(part => part.trim())
            .filter(Boolean);
        for (const fragment of fragments) {
            const tailMatch = cleanCreatureCandidate(fragment).match(CREATURE_SUFFIX_TAIL_PATTERN);
            if (tailMatch) {
                addCandidate(tailMatch[1]);
            }
        }
        for (const pattern of CREATURE_NAME_CONTEXT_PATTERNS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(line)) !== null) {
                addCandidate(match[1]);
            }
        }
        const trailingMatch = line.match(/([\u4e00-\u9fa5]{2,6})$/);
        if (trailingMatch) {
            addCandidate(trailingMatch[1]);
        }
    }
    return results;
}
