//  ./index.js
import express from 'express'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { userRouter } from './routes/users.js'

dotenv.config();
const app = express()
app.use(cors({
    origin: [`${process.env.CLIENT_URL}`,  "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));
app.use(express.json()); // Untuk parsing JSON body
app.use(cookieParser()); // Untuk parsing cookie

app.use((req, res, next) => {
    console.log(`Request Method: ${req.method}, Request URL: ${req.url}`);
    next();
});
app.use('/user', userRouter)

mongoose.connect(process.env.MONGO_ATLAS, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log("Connected to MongoDB Atlas");
    app.use('/uploads', express.static('uploads'));
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
})
.catch(err => {
    console.error("Connection error", err);
});