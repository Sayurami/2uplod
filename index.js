const express = require("express");
const multer = require("multer");
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Admin credentials
const ADMIN_USER = "sayura";
const ADMIN_PASS = "Sayura2008***7";

// ✅ MongoDB Atlas URI (replace if needed)
const MONGO_URI = "mongodb+srv://sayuramihiranga4_db_user:iTSvhogsJueCYCWv@cluster0.68c9428b2ca56a5a40cdc1bc.mongodb.net/uploads_db?retryWrites=true&w=majority&appName=Cluster0";

let db, bucket;
const client = new MongoClient(MONGO_URI);

// 🧩 MongoDB connect with reuse (for Vercel)
async function getDB() {
  if (db && bucket) return { db, bucket };

  await client.connect();
  db = client.db("uploads_db");
  bucket = new GridFSBucket(db, { bucketName: "photos" });
  console.log("✅ MongoDB Atlas connected");
  return { db, bucket };
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 📤 Upload
app.post("/upload", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded!");

  const { db, bucket } = await getDB();

  const uploadStream = bucket.openUploadStream(req.file.originalname, {
    metadata: {
      name: req.body.name || "No Name",
      description: req.body.description || "No Description",
      mimetype: req.file.mimetype,
    },
  });

  uploadStream.end(req.file.buffer);

  uploadStream.on("finish", () => {
    res.json({ success: true, fileId: uploadStream.id.toString() });
  });
});

// 📄 List all uploads
app.get("/uploads", async (req, res) => {
  const { db } = await getDB();
  const files = await db.collection("photos.files").find().toArray();
  res.json(
    files.map((f) => ({
      id: f._id,
      filename: f.filename,
      name: f.metadata?.name,
      description: f.metadata?.description,
      mimetype: f.metadata?.mimetype,
    }))
  );
});

// 📥 Download
app.get("/file/:id", async (req, res) => {
  try {
    const { bucket } = await getDB();
    const id = new ObjectId(req.params.id);
    const stream = bucket.openDownloadStream(id);

    stream.on("file", (file) => {
      res.setHeader("Content-Type", file.metadata?.mimetype || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
    });

    stream.on("error", () => res.status(404).send("File not found"));
    stream.pipe(res);
  } catch (e) {
    res.status(400).send("Invalid ID");
  }
});

// ❌ Delete
app.delete("/uploads/:id", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth) return res.json({ success: false, error: "Unauthorized" });

  const [user, pass] = Buffer.from(auth.split(" ")[1], "base64").toString().split(":");
  if (user !== ADMIN_USER || pass !== ADMIN_PASS)
    return res.json({ success: false, error: "Forbidden" });

  try {
    const { bucket } = await getDB();
    const id = new ObjectId(req.params.id);
    await bucket.delete(id);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
