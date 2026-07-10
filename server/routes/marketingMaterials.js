const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { findStaffByLoginId } = require("../lib/loginResolve");
const { isR2Enabled, putObject, getBuffer } = require("../lib/r2Storage");
const {
    buildFromBody,
    parseUploads,
    sanitizeExistingFiles,
    toPublic,
    toDbDoc,
    validateBuilt,
    newFileId,
    r2KeyFor
} = require("../lib/marketingMaterialFields");
const {
    COL,
    purgeExpiredMaterials,
    deleteMaterialById
} = require("../lib/marketingMaterialPurge");

const router = express.Router();

function newId(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

async function staffMeta(auth) {
    const createdBy = String((auth && auth.userId) || "").trim();
    let createdByName = createdBy;
    if (createdBy) {
        try {
            const staff = await findStaffByLoginId(createdBy);
            if (staff) {
                const name = String(staff.st_ceo || staff.name || "").trim();
                if (name) createdByName = name;
            }
        } catch (e) {
            /* ignore */
        }
    }
    return { createdBy: createdBy, createdByName: createdByName };
}

async function uploadParsedFiles(materialId, parsed) {
    if (!isR2Enabled()) {
        throw new Error("파일 저장소(R2)가 설정되지 않았습니다. 관리자에게 문의해 주세요.");
    }
    const stored = [];
    for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        const fileId = newFileId();
        const key = r2KeyFor(materialId, fileId, item.filename);
        const ok = await putObject(key, item.buffer, item.mime);
        if (!ok) {
            throw new Error("파일 저장에 실패했습니다: " + item.filename);
        }
        stored.push({
            id: fileId,
            filename: item.filename,
            mime: item.mime,
            size: item.size,
            kind: item.kind,
            r2Key: key
        });
    }
    return stored;
}

async function mergeFilesForUpdate(materialId, existingDoc, built) {
    const existing = sanitizeExistingFiles(existingDoc.mm_files);
    const keepIds = built.mm_keep_file_ids;
    const kept =
        keepIds === null
            ? existing.slice()
            : existing.filter(function (f) {
                  return keepIds.indexOf(f.id) >= 0;
              });
    const parsed = parseUploads(built.mm_uploads);
    const uploaded = await uploadParsedFiles(materialId, parsed);
    return kept.concat(uploaded);
}

router.get("/", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const db = getDb();
        await purgeExpiredMaterials(db);
        const rows = await db
            .collection(COL)
            .find({ expireAt: { $gt: Date.now() } })
            .sort({ createdAt: -1 })
            .toArray();
        res.json({ ok: true, items: rows.map(toPublic).filter(Boolean) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/:id/files/:fileIdx", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const db = getDb();
        const id = String(req.params.id || "");
        const fileIdx = Number(req.params.fileIdx);
        const doc = await db.collection(COL).findOne({ id: id });
        if (!doc || Number(doc.expireAt) <= Date.now()) {
            return res.status(404).json({ ok: false, error: "자료를 찾을 수 없습니다." });
        }
        const files = sanitizeExistingFiles(doc.mm_files);
        const file = files[fileIdx];
        if (!file) {
            return res.status(404).json({ ok: false, error: "파일을 찾을 수 없습니다." });
        }
        const buf = await getBuffer(file.r2Key);
        if (!buf) {
            return res.status(404).json({ ok: false, error: "파일을 불러올 수 없습니다." });
        }
        const filename = encodeURIComponent(file.filename);
        res.setHeader("Content-Type", file.mime || "application/octet-stream");
        res.setHeader("Content-Disposition", 'attachment; filename="' + filename + '"; filename*=UTF-8\'\'' + filename);
        res.send(buf);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/:id", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const db = getDb();
        await purgeExpiredMaterials(db);
        const doc = await db.collection(COL).findOne({ id: String(req.params.id || "") });
        if (!doc || Number(doc.expireAt) <= Date.now()) {
            return res.status(404).json({ ok: false, error: "자료를 찾을 수 없습니다." });
        }
        res.json({ ok: true, item: toPublic(doc) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const built = buildFromBody(req.body || {});
        const parsed = parseUploads(built.mm_uploads);
        const errMsg = validateBuilt(built, parsed.length);
        if (errMsg) {
            return res.status(400).json({ ok: false, error: errMsg });
        }
        const id = newId("mm");
        const storedFiles = await uploadParsedFiles(id, parsed);
        const meta = await staffMeta(req.auth);
        const doc = toDbDoc(id, built, null, meta, storedFiles);
        await getDb().collection(COL).insertOne(doc);
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (err) {
        const status = /R2/.test(err.message) ? 503 : 400;
        res.status(status).json({ ok: false, error: err.message });
    }
});

router.put("/:id", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const existing = await getDb().collection(COL).findOne({ id: id });
        if (!existing || Number(existing.expireAt) <= Date.now()) {
            return res.status(404).json({ ok: false, error: "자료를 찾을 수 없습니다." });
        }
        const built = buildFromBody(req.body || {});
        const storedFiles = await mergeFilesForUpdate(id, existing, built);
        const errMsg = validateBuilt(built, storedFiles.length);
        if (errMsg) {
            return res.status(400).json({ ok: false, error: errMsg });
        }
        const removed = sanitizeExistingFiles(existing.mm_files).filter(function (f) {
            return !storedFiles.some(function (s) {
                return s.id === f.id;
            });
        });
        const { deleteMaterialFiles } = require("../lib/marketingMaterialPurge");
        await deleteMaterialFiles(removed);
        const doc = toDbDoc(id, built, existing, {}, storedFiles);
        await getDb().collection(COL).replaceOne({ id: id }, doc);
        res.json({ ok: true, item: toPublic(doc) });
    } catch (err) {
        const status = /R2/.test(err.message) ? 503 : 400;
        res.status(status).json({ ok: false, error: err.message });
    }
});

router.delete("/:id", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const ok = await deleteMaterialById(getDb(), id);
        if (!ok) {
            return res.status(404).json({ ok: false, error: "자료를 찾을 수 없습니다." });
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
