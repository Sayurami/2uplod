// ===============================
// 🧩 SL ANIME WORLD - File Upload Server
// ===============================

const express = require('express');
const multer = require('multer');
const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const path = require('path');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Admin credentials
const ADMIN_USER = "sayura";
const ADMIN_PASS = "Sayura2008***7";

// 🌍 MongoDB Atlas URI (Environment Variable or default)
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://sayuramihiranga4_db_user:iTSvhogsJueCYCWv@cluster0.63ji5ou.mongodb.net/uploads_db?retryWrites=true&w=majority&appName=Cluster0";

// 🧠 MongoDB Client setup
const client = new MongoClient(MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: true,
  serverSelectionTimeoutMS: 10000,
});

let db, bucket;

// 🪢 Initialize MongoDB connection
async function initMongo() {
  try {
    await client.connect();
    db = client.db("uploads_db");
    bucket = new GridFSBucket(db, { bucketName: "photos" });
    console.log("✅ MongoDB connected successfully!");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

// 🧰 Multer setup (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🧩 Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🏠 Serve the frontend HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 📤 Upload Route
app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded!');

  const { name, description } = req.body;

  const uploadStream = bucket.openUploadStream(req.file.originalname, {
    metadata: {
      name: name || 'No Name',
      description: description || 'No Description',
      mimetype: req.file.mimetype,
    },
  });

  uploadStream.end(req.file.buffer);

  uploadStream.on('finish', () => {
    res.json({
      success: true,
      fileId: uploadStream.id.toString(),
    });
  });
});

// 🧾 Get all uploads (metadata only)
app.get('/uploads/', async (req, res) => {
  try {
    const files = await db.collection('photos.files').find().toArray();
    res.json(
      files.map((f) => ({
        id: f._id,
        filename: f.filename,
        name: f.metadata?.name,
        description: f.metadata?.description,
        mimetype: f.metadata?.mimetype,
      }))
    );
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📥 View or Download a file
app.get('/file/:id', (req, res) => {
  try {
    const id = new ObjectId(req.params.id);
    const downloadStream = bucket.openDownloadStream(id);

    downloadStream.on('file', (file) => {
      res.setHeader('Content-Type', file.metadata?.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    });

    downloadStream.on('error', () => res.status(404).send('File not found'));
    downloadStream.pipe(res);
  } catch {
    res.status(400).send('Invalid file ID');
  }
});

// 🗑️ Delete a file (Admin only)
app.delete('/uploads/:id', async (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth) return res.json({ success: false, error: 'Unauthorized' });

  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');

  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return res.json({ success: false, error: 'Forbidden' });
  }

  try {
    const id = new ObjectId(req.params.id);
    await bucket.delete(id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 🚀 Start server after MongoDB connects
initMongo().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});

// Export app (for Vercel)
module.exports = app;
