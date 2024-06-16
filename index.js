const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fsExtra = require('fs-extra');

const app = express();
const upload = multer({ dest: 'uploads/' });

// File untuk menyimpan metadata
const METADATA_FILE = 'fileMetadata.json';

// Membaca metadata dari file atau menginisialisasi objek kosong
let fileStore = {};
if (fs.existsSync(METADATA_FILE)) {
    fileStore = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
}

// Fungsi untuk menyimpan metadata ke file
const saveMetadata = () => {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(fileStore, null, 2));
};

// Fungsi untuk menghapus file setelah 24 jam
const scheduleDeletion = (fileId, delay) => {
    setTimeout(() => {
        const file = fileStore[fileId];
        if (file) {
            fs.unlink(file.filePath, err => {
                if (err) console.error(`Error deleting file ${file.originalName}:`, err);
            });
            delete fileStore[fileId];
            saveMetadata();
        }
    }, delay);
};

// Menjadwalkan penghapusan file untuk semua file yang ada di fileStore
Object.keys(fileStore).forEach(fileId => {
    const file = fileStore[fileId];
    const elapsed = Date.now() - file.createdAt;
    const remainingTime = (24 * 60 * 60 * 1000) - elapsed;
    if (remainingTime > 0) {
        scheduleDeletion(fileId, remainingTime);
    } else {
        // Hapus file yang sudah kadaluwarsa
        fs.unlink(file.filePath, err => {
            if (err) console.error(`Error deleting file ${file.originalName}:`, err);
        });
        delete fileStore[fileId];
        saveMetadata();
    }
});

// Endpoint untuk meng-upload gambar
app.post('/upload', upload.single('image'), (req, res) => {
    const fileId = uuidv4();
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const createdAt = Date.now();

    // Store file info
    fileStore[fileId] = { filePath, originalName, createdAt };
    saveMetadata();

    // Schedule file deletion after 24 hours
    scheduleDeletion(fileId, 24 * 60 * 60 * 1000);

    res.send(`/file/${fileId}`);
});

// Endpoint untuk mengakses gambar
app.get('/file/:id', (req, res) => {
    const fileId = req.params.id;
    const file = fileStore[fileId];

    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(path.resolve(file.filePath), { headers: { 'Content-Disposition': `inline; filename="${file.originalName}"` } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
