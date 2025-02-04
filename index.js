const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');
const app = express();

// Load environment variables
dotenv.config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection URI
const mongoUri = process.env.MONGO_URI;
let db;

// Connect to MongoDB
MongoClient.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(client => {
    db = client.db();
    console.log('Connected to MongoDB');
  })
  .catch(err => {
    console.error('Error connecting to MongoDB', err);
  });

// Multer setup (store files in memory)
const fileStorage = multer.memoryStorage();
const upload = multer({ storage: fileStorage });

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Function to upload file to Cloudinary
const uploadFile = async (file) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
      if (error) reject(error);
      resolve(result.secure_url);
    }).end(file.buffer);
  });
};

// Upload API
app.post('/uploads', upload.fields([
  { name: 'artist_image' },
  { name: 'carousel_image' },
  { name: 'blog_image' },
  { name: 'event_image' },
  { name: 'about_image_1' },
  { name: 'about_image_2' }
]), async (req, res) => {
  try {
    const { 
      artist_name, artist_lyrics, blog_title, blog_description, event_date,
      about_description_1, about_description_2, about_description_3
    } = req.body;
    
    const fileUrls = {};

    // Upload each file to Cloudinary
    if (req.files) {
      for (let key in req.files) {
        const file = req.files[key][0];
        fileUrls[key] = await uploadFile(file);
      }
    }

    // Data to be stored in MongoDB
    const data = {
      artist_name,
      artist_lyrics,
      carousel_image: fileUrls.carousel_image || '',
      about_description_1,
      about_description_2,
      about_description_3,
      blog_title,
      blog_description,
      blog_image: fileUrls.blog_image || '',
      event_image: fileUrls.event_image || '',
      event_date,
      artist_image: fileUrls.artist_image || '',
      about_image_1: fileUrls.about_image_1 || '',
      about_image_2: fileUrls.about_image_2 || '',
    };

    // Insert into MongoDB
    const collection = db.collection('uploads');
    const result = await collection.insertOne(data);

    res.status(200).json({ message: 'Upload successful', data: { ...data, _id: result.insertedId } });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading data', error: error.message });
  }
});

// Fetch all data API
app.get('/data', async (req, res) => {
  try {
    const collection = db.collection('uploads');
    const data = await collection.find().toArray();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching data', error: error.message });
  }
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
