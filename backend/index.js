import express from "express";
import ImageKit from "imagekit";
import dotenv from 'dotenv';
import cors from "cors";
import mongoose from "mongoose";
import Chat from "./models/chat.js"
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node'
import Userchats from "./models/userchat.js"
const port = process.env.PORT || 3000
const app = express();
dotenv.config();

app.use(cors({origin: process.env.CLIENT_URL,
    credentials: true,}))
app.use(express.json());
const imagekit = new ImageKit({
   urlEndpoint:process.env.VITE_IMAGE_KIT_ENDPOINT,
   publicKey:process.env.VITE_IMAGE_KIT_PUBLIC_KEY,
   privateKey:process.env.VITE_IMAGE_KIT_PRIVATE_KEY
});

const connect = async()=>{
    try{
       await mongoose.connect(process.env.MONGO_DB);
       console.log("connected to mongodb")
    //    await mongoose.connection.db.dropDatabase();
    }catch(err){
      console.log(err);
    }
}

app.get("/api/upload",(req,res)=>{
    const result = imagekit.getAuthenticationParameters();
    res.send(result);
});
app.post("/api/chats", ClerkExpressRequireAuth(),async(req,res)=>{
    console.log("in server")
    const userId = req.auth.userId;
    const {text} = req.body;

    try{
      
        const newChat = new Chat({
            userId:userId,
            history:[{role:"user",parts:[{text}]}],
        })

        const savedChat = await newChat.save();

        const userChats = await Userchats.find({userId:userId})
        if(!userChats.length){
            const newUserChats = new Userchats({
                userId:userId,
                chats:[
                    {
                        _id:savedChat._id,
                        title:text.substring(0,40) 
                    }
                ]
            })

            await newUserChats.save();
        }else{
            console.log("in else",newChat._id)
            await Userchats.updateOne({userId:userId},{
                $push:{
                    chats:{
                        _id:savedChat._id,
                         title:text.substring(0,40)
                    }
                }
            })
        }
       return res.status(201).send(newChat._id);   
    }catch(e){
        console.log(err);
        res.status(500).send("error creating chat!")
    }
});

app.get("/api/userchats",ClerkExpressRequireAuth(),async(req,res)=>{
    const userId = req.auth.userId;

    try{
        const userChats = await Userchats.find({userId:userId})

        if (!userChats.length || !userChats[0].chats) {
            return res.status(200).send([]); // Return an empty array if no chats exist
          }
          res.status(200).send(userChats[0].chats);
    }catch(err){
        console.log(err);
        res.status(500).send("Error fetching  userchat");    
    }
})


app.get("/api/chat/:id", ClerkExpressRequireAuth(), async (req, res) => {
    const userId = req.auth.userId;
  
    try {
      const chat = await Chat.findOne({ _id: req.params.id, userId });
  
      res.status(200).send(chat);
    } catch (err) {
      console.log(err);
      res.status(500).send("Error fetching chat!");
    }
  });

app.put("/api/chat/:id",ClerkExpressRequireAuth(),async(req,res)=>{
    const userId = req.auth.userId;
   const {question,answer,img} = req.body;
   const newItems = [
    ...(question ? [{role:"user",parts:[{text:question}], ...(img && {img})}]:[]),
      {role:"model",parts:[{text:answer}]},
   ];
    try{
        const updatedchat = await Chat.updateOne({
           _id:req.params.id,userId 
        },{
            $push:{
                history:{
                    $each:newItems
                }
            }
        })
        res.status(200).send(updatedchat);
    }catch(err){
        console.log(err);
        res.status(500).send("Error adding conversation");    
    }
})




app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(401).send('Unauthenticated!')
  })


app.get("/test",(req,res)=>{
    res.send("it works")
})

app.listen(port,()=>{
    connect()
    console.log("server running on 3000")
})