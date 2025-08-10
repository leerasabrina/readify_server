require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
// const verifyToken = require("./utilities/verifyToken");



const corsOptions = {
    origin: ['https://majestic-gecko-df700c.netlify.app','http://localhost:5173','https://iridescent-mandazi-86fffc.netlify.app','https://vocal-melomakarona-d5383e.netlify.app'], 
    credentials: true, 
    // allowedHeaders: ['Content-Type', 'Authorization'], 
  };
  // Middleware
  app.use(cors(corsOptions));
  
app.use(express.json());




// verify
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(req.headers)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send("Unauthorized: No token provided");
  }

  const token = authHeader.split(' ')[1];
  

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
   
    next();
  } catch (error) {
    return res.status(401).send("Unauthorized: Invalid token");
  }
};

// module.exports = verifyToken;




const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster3.qioy64h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster3`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const db = client.db("bookdb");
const booksCollection = db.collection("books");
const reviewsCollection = db.collection("reviews");
const usersCollection = db.collection("users");
const contacts = db.collection('contacts');





async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // 
        app.get('/users/:email',verifyToken, async (req, res) => {
            const email = req.params.email;
            try {
              const user = await usersCollection.findOne({ email });
              if (user) {
                res.send(user);
              } else {
                res.status(404).send({ message: "User not found" });
              }
            } catch (error) {
              res.status(500).send({ message: "Failed to fetch user", error });
            }
          });
        


        app.post("/books", verifyToken, async (req, res) => {
            try {
                const book = req.body;
                const result = await booksCollection.insertOne(book);
                res.send({ success: true, insertedId: result.insertedId });
            } catch (err) {
                res.status(500).send({ success: false, message: err.message });
            }
        });

        app.get("/books", async (req, res) => {
            try {
                const books = await db.collection("books").find().toArray();
                res.send(books);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch books", error: error.message });
            }
        });




        // feacher
        app.get("/books/featured", async (req, res) => {
            try {
              const featuredBooks = await booksCollection
                .find()
                .sort({ upvote: -1 })
                .limit(8)
                .toArray();
              res.send(featuredBooks);
            } catch (error) {
              res.status(500).send({ message: "Failed to fetch featured books", error: error.message });
            }
          });

        //   profile
        app.get('/books/user', verifyToken, async (req, res) => {
            
            if (req.user.email !== req.query.email) {
              return res.status(403).send({ error: 'Forbidden access' });
            }
          
            const books = await booksCollection.find({ user_email: req.query.email }).toArray();
           
            res.send(books);
          });
          

        app.get("/books/:id", async (req, res) => {
            const { id } = req.params;
            const book = await booksCollection.findOne({ _id: new ObjectId(id) });
            res.send(book);
          });

          



    //    upvote korsi
    app.patch('/books/upvote/:id', async (req, res) => {
        const bookId = req.params.id;
        // const userEmail = req.user.email;
      
        const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
      
        if (!book) return res.status(404).json({ success: false, message: "Book not found" });
      
        // if (book.user_email === userEmail)
        //   return res.json({ success: false, message: "You can't upvote your own book" });
      
        // if (book.upvoted_by?.includes(userEmail))
        //   return res.json({ success: false, message: "You've already upvoted this book" });
      
        const updatedUpvote = (book.upvote || 0) + 1;
        // const updatedUpvotedBy = [...(book.upvoted_by || []), userEmail];
      
        const result = await booksCollection.updateOne(
          { _id: new ObjectId(bookId) },
          { $set: { upvote: updatedUpvote } }
        );
      
        res.json({ success: true, upvote: updatedUpvote });
      });
      
          
 



app.patch('/books/status/:id', async (req, res) => {
  try {
    const bookId = req.params.id;
    const { reading_status } = req.body;

    if (!reading_status) {
      return res.status(400).json({ success: false, message: "reading_status is required" });
    }

    const allowedStatuses = ["Want-to-Read", "Reading", "Read"];
    if (!allowedStatuses.includes(reading_status)) {
      return res.status(400).json({ success: false, message: "Invalid reading_status value" });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    // Update the reading_status
    const result = await booksCollection.updateOne(
      { _id: new ObjectId(bookId) },
      { $set: { reading_status: reading_status } }
    );

    if (result.modifiedCount === 1) {
      res.json({ success: true, message: "Reading status updated" });
    } else {
      res.status(500).json({ success: false, message: "Failed to update status" });
    }
  } catch (error) {
    console.error("Error updating reading status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
 

          // GET reviews for a book
app.get("/reviews/:bookId", async (req, res) => {
    const result = await reviewsCollection.find({ book_id: req.params.bookId }).toArray();
    res.send(result);
  });
  
  // POST a review
  app.post("/reviews", verifyToken, async (req, res) => {
    const { book_id, text, user_name, user_email } = req.body;
  
    const exists = await reviewsCollection.findOne({ book_id, user_email });
    if (exists) return res.status(400).send("You already reviewed this book.");
  
    const review = { book_id, text, user_name, user_email };
    const result = await reviewsCollection.insertOne(review);
    res.send(result);
  });
  
  // PATCH (edit) a review
  app.patch("/reviews/:id", verifyToken, async (req, res) => {
    const { text } = req.body;
    const result = await reviewsCollection.updateOne(
      { _id: new ObjectId(req.params.id), user_email: req.user.email },
      { $set: { text } }
    );
    res.send(result);
  });
  
  // DELETE a review
  app.delete("/reviews/:id", verifyToken, async (req, res) => {
    const result = await reviewsCollection.deleteOne({
      _id: new ObjectId(req.params.id),
      user_email: req.user.email,
    });
    res.send(result);
  });
  
          
  app.get('/mybooks', verifyToken, async (req, res) => {
    const userEmail = req.query.email;
    const decodedEmail = req.user.email;
  
    if (userEmail !== decodedEmail) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
  
    const result = await booksCollection.find({ user_email: userEmail }).toArray();
    res.send(result);
  });  
  app.get('/mybooks/:id', async (req, res) => {
  try {
    const bookId = req.params.id;

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: 'Invalid book ID' });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.json(book);
  } catch (error) {
    console.error('Error fetching book by id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
  
  app.delete('/mybooks/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const userEmail = req.user.email;
  
    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }
  
    if (book.user_email !== userEmail) {
      return res.status(403).send({ message: "You can only delete your own books" });
    }
  
    const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  });

  app.put('/mybooks/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    const updatedBook = req.body;
    const userEmail = req.user.email;
  
    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
  
    if (!book) {
      return res.status(404).send({ message: 'Book not found' });
    }
  
    if (book.user_email !== userEmail) {
      return res.status(403).send({ message: "You can only update your own books" });
    }
  
    const updateDoc = {
      $set: {
        book_title: updatedBook.book_title,
        book_author: updatedBook.book_author,
        cover_photo: updatedBook.cover_photo,
        book_category: updatedBook.book_category,
        reading_status: updatedBook.reading_status,
        book_overview: updatedBook.book_overview,
        total_page: updatedBook.total_page,
      }
    };
  
    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );
  
    res.send(result);
  });
  
  

  app.post('/users',verifyToken, async (req, res) => {
    const newUser = req.body;
    console.log("Token decoded:", req.user);
    const existingUser = await usersCollection.findOne({ email: newUser.email });
  
    if (existingUser) {
      return res.status(400).send({ message: "User already exists" });
    }
  
    try {
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to save user", error });
    }
  });
  
 app.post('/contact', async (req, res) => {
      const { name, email, message } = req.body;

      if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const newContact = { name, email, message, createdAt: new Date() };
      await contacts.insertOne(newContact);

      res.status(201).json({ message: 'Message received successfully' });
    });














        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error

    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send(" Server is running!");
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});