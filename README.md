# 💬 Real-Time Chat App

### *(WebSockets + Redis + MongoDB + JWT + File Sharing + WebRTC Calls)*

A full-stack real-time chat application featuring:

* 🔐 **JWT Authentication**
* 💬 **Real-time messaging** (WebSockets)
* 📡 **Redis Pub/Sub** (presence + message fanout)
* 🗄️ **MongoDB persistence**
* 📎 **File upload & sharing**
* 🎥 **Audio/Video calls using WebRTC**
* 🎨 **Discord-inspired UI**

A perfect project demonstrating **real-time systems**, **authentication**, **scalable backend architecture**, and **modern chat UI**.

---

# 🧱 Tech Stack

### **Frontend**

* HTML5, CSS3, JavaScript
* WebSocket client
* WebRTC (audio/video)
* Discord-like UI

### **Backend**

* Node.js + Express
* `ws` for WebSocket server
* MongoDB + Mongoose
* Redis (`ioredis`) for pub/sub
* JWT authentication
* Multer for file uploads

### **Infrastructure**

* MongoDB (local / Atlas)
* Redis (local / Docker)
* Environment variables (`dotenv`)

---

# ✨ Features

### 🔐 **Authentication**

* Register / Login with username & password
* Password hashing (bcrypt)
* JWT-protected REST endpoints
* JWT-validated WebSocket connections

### 💬 **Real-Time Chat**

* Join any chat room instantly
* Real-time updates with WebSockets
* Discord-style threaded messages
* Typing + online user presence

### 📡 **Redis-Based Presence**

* Shows who is online in the room
* Auto-updates when users join/leave

### 🗄️ **Persistent Chat History**

* Last 100 messages fetched from MongoDB
* Supports both text + file messages

### 📎 **File Sharing**

* Upload any file type to the room
* Auto-saved in MongoDB with metadata
* Accessible via `/files/<filename>`

### 🎥 **WebRTC Audio/Video Calls**

* Room-based calling system
* WebRTC signaling sent over WebSockets
* Local + remote video preview
* Mute/unmute + camera toggle

---

# 🧬 High-Level Architecture

```
 Client (browser)
   | \
   |  \ (HTTP: auth, upload, history)
   |   \
   |    v
   |  Express (Node.js) ---- MongoDB (messages, users)
   |          \
   |           \ (WebSocket: chat + presence + WebRTC signaling)
   |            \
   |             v
   |          Redis (Pub/Sub + Sets)
   |             |
   |             | (broadcasts messages & signals)
   v             v
Other clients in same room
```

---

# 🛰️ How the Real-Time System Works

## 🔌 WebSockets

WebSockets handle **all real-time communication**, including:

| Purpose          | Message Type                                        |
| ---------------- | --------------------------------------------------- |
| Chat messages    | `"message"`                                         |
| Presence updates | `"presence"`                                        |
| WebRTC signaling | `"webrtc-offer"`, `"webrtc-answer"`, `"webrtc-ice"` |

This means:
→ **One WebSocket connection = chat + presence + video call signaling**

---

## 📡 Redis

Redis is used to coordinate communication across all servers (horizontal scaling).

### **Pub/Sub Channels**

```
room:<room>:channel
```

Used for:

* Chat messages
* Presence updates
* WebRTC signaling (offer, answer, ICE)

### **Redis Sets**

```
room:<room>:users
```

Used for:

* Tracking online users
* Populating room presence list

---

## 🗄️ MongoDB

MongoDB stores persistent chat + user data.

### Message Collection

Stores both standard & file messages:

* `room`
* `user`
* `text`
* `messageType`: `"text"` or `"file"`
* `fileUrl`, `fileName`, `fileSize`, `fileType`
* `ts`

### User Collection

Stores:

* `username`
* `passwordHash`

---

# 📂 Project Structure

```
/server
  index.js
  /models
    User.js
    Message.js
  /routes
    auth.js
  /uploads
  /static
    client.html
```

---

# 📸 Screenshots

> *(Insert screenshots here when ready — UI pictures, login page, chat, file upload, video call)*

Recommended screenshots:

* Login screen
* Chat UI
* Online users panel
* File message preview
* Audio/video call screen

---

# 🚀 Future Improvements

### 🔧 Backend

* Add rate-limiting for messages (anti-spam)
* Add user profile pages
* Add message search (MongoDB text index)
* Full Docker Compose setup (Mongo + Redis + server)

### ✨ Frontend

* Add emoji picker
* Add timestamps to bubbles
* Typing indicators
* Better file previews (image thumbnails, PDF icons)
* Add message editing & deletion
* Push notifications

### 📞 WebRTC Enhancements

* Multi-user group calls
* Screen sharing
* Voice-only channels (Discord style)

---

# 🏁 Getting Started

### 1️⃣ Install dependencies

```
npm install
```
### 3️⃣ Start Redis & MongoDB

Local:

```
redis-server
mongod
```

### 4️⃣ Start server

```
npm start
```

### 5️⃣ Open UI

Visit:

```
http://localhost:8080
```

---

👨‍💻 **Author:** Aditya Kale  
