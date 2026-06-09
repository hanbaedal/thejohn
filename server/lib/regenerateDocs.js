const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const DOC_FILES = [
    "thejohn-user-manual.docx",
    "thejohn-system-structure-management.docx",
    "thejohn-system-structure-management.pptx",
    "thejohn-system-technical.docx",
    "thejohn-server-infrastructure.docx",
    "thejohn-file-inventory.docx"
];

function resolveProjectRoot() {
    return path.join(__dirname, "..", "..");
}

async function findPython() {
    const envPy = String(process.env.PYTHON_PATH || "").trim();
    const candidates = envPy ? [envPy] : ["python3", "python", "py"];
    for (let i = 0; i < candidates.length; i++) {
        const cmd = candidates[i];
        try {
            await execFileAsync(cmd, ["--version"], { timeout: 8000 });
            return cmd;
        } catch (ignore) {}
    }
    return null;
}

async function runPythonScript(python, scriptName) {
    const root = resolveProjectRoot();
    const scriptPath = path.join(root, "scripts", scriptName);
    if (!fs.existsSync(scriptPath)) {
        const err = new Error("문서 생성 스크립트를 찾을 수 없습니다: " + scriptName);
        err.status = 500;
        throw err;
    }
    try {
        const result = await execFileAsync(python, [scriptPath], {
            cwd: root,
            timeout: 180000,
            maxBuffer: 4 * 1024 * 1024,
            windowsHide: true
        });
        return {
            script: scriptName,
            stdout: String(result.stdout || "").trim(),
            stderr: String(result.stderr || "").trim()
        };
    } catch (e) {
        const msg =
            (e.stderr && String(e.stderr).trim()) ||
            (e.stdout && String(e.stdout).trim()) ||
            e.message ||
            "문서 생성 실패";
        const err = new Error(msg);
        err.status = 500;
        throw err;
    }
}

function listDocFileStats() {
    const docsDir = path.join(resolveProjectRoot(), "docs");
    return DOC_FILES.map(function (name) {
        const filePath = path.join(docsDir, name);
        if (!fs.existsSync(filePath)) {
            return { name: name, exists: false, size: 0, mtime: "" };
        }
        const stat = fs.statSync(filePath);
        return {
            name: name,
            exists: true,
            size: stat.size,
            mtime: stat.mtime.toISOString()
        };
    });
}

async function regenerateAllDocs() {
    const python = await findPython();
    if (!python) {
        const err = new Error(
            "서버에 Python이 없습니다. 로컬 PC에서 scripts/generate-*.py 를 실행하거나 PYTHON_PATH 환경 변수를 설정해 주세요."
        );
        err.status = 503;
        throw err;
    }

    const steps = [];
    steps.push(await runPythonScript(python, "generate-user-manual.py"));
    steps.push(await runPythonScript(python, "generate-management-docs.py"));
    steps.push(await runPythonScript(python, "generate-technical-doc.py"));
    steps.push(await runPythonScript(python, "generate-server-doc.py"));
    steps.push(await runPythonScript(python, "generate-file-inventory-doc.py"));

    const files = listDocFileStats();
    const missing = files.filter(function (f) {
        return !f.exists;
    });
    if (missing.length) {
        const err = new Error("문서 파일이 생성되지 않았습니다.");
        err.status = 500;
        throw err;
    }

    return {
        ok: true,
        generatedAt: new Date().toISOString(),
        python: python,
        steps: steps,
        files: files
    };
}

module.exports = {
    DOC_FILES: DOC_FILES,
    listDocFileStats: listDocFileStats,
    regenerateAllDocs: regenerateAllDocs
};
