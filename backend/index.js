import { Socket } from "dgram";
import express from "express";
import http from "http";
import { Server } from "socket.io"; 
import path from 'path'
import axios from 'axios'

const app =express();
const server=http.createServer(app);

const url = `https://realtime-code-editor-final.onrender.com`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log("website reloded");
    })
    .catch((error) => {
      console.error(`Error : ${error.message}`);
    });
}

setInterval(reloadWebsite, interval);

const io=new Server(server,{
    cors:{
        origin:"*",//can be used anywhere
    },
});
const rooms = new Map();
io.on("connection",(socket)=>{
    console.log("user connected",socket.id);
    let currentRoom=null;
    let currentUser=null;
    socket.on("join",({roomId,userName})=>{
        if(currentRoom){
            socket.leave(currentRoom);
            rooms.get(currentRoom).delete(currentUser);
            io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
        }
        currentRoom=roomId;
        currentUser=userName;
        socket.join(roomId);

        if(!rooms.has(roomId)){
            rooms.set(roomId,new Set());
        }
        rooms.get(roomId).add(userName);

        io.to(roomId).emit("userJoined", Array.from(rooms.get(currentRoom)));
        // console.log("user joined room: ",roomId);
    });
     
    socket.on("codeChange",({roomId,code})=>{
        socket.to(roomId).emit("codeUpdate",code);
    });

    socket.on("leaveRoom", () => {
        if (currentRoom && currentUser) {
          rooms.get(currentRoom).delete(currentUser);
          io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    
          socket.leave(currentRoom);
    
          currentRoom = null;
          currentUser = null;
        }
      });
       
      socket.on("typing", ({ roomId, userName }) => {
        socket.to(roomId).emit("userTyping", userName);
      });
    
      socket.on("languageChange", ({ roomId, language }) => {
        io.to(roomId).emit("languageUpdate", language);
      });

      function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      socket.on("compileCode", async ({ code, roomId, language, version }) => {
        if (rooms.has(roomId)) {
          const room = rooms.get(roomId);
          try {
                    // Implementing delay of 200ms before each API call to prevent rate-limiting
                await sleep(200);
                    
                const response = await axios.post(
                    "https://emkc.org/api/v2/piston/execute",
                    {
                    language,
                    version,
                    files: [
                        {
                        content: code,
                        },
                    ],
                    }
                );
    
            room.output = response.data.run.output;
            io.to(roomId).emit("codeResponse", response.data);
            }
        catch (error) { 
                console.error("Error during code compilation:", error);
                socket.emit("error", "Error compiling code. Please try again later.");
            }
         }
      });
    
    socket.on("disconnect", () => {
        if (currentRoom && currentUser) {
          rooms.get(currentRoom).delete(currentUser);
          io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
        }
        console.log("user Disconnected");
    });
});
const port=process.env.PORT||5000

    const __dirname = path.resolve();
    app.use(express.static(path.join(__dirname, "/frontend/dist")));

    app.get("*",(req,res)=>{ 
        res.sendFile(path.join(__dirname,"frontend","dist","index.html"));
    });

server.listen(port,()=>{
    console.log('server is working on port 5000');
});
