import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { NewsPoller, NewsItem } from './poller';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Initialize Poller
const poller = new NewsPoller();

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Optionally send initial "welcome" or "history" here if we store it
    socket.emit('status', { message: 'Connected to Too Much News stream' });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Broadcast news when poller finds new items
poller.on('news', (item: NewsItem) => {
    // console.log(`[Broadcasting] ${item.title}`);
    io.emit('news-item', item);
});

// Start fetching
poller.start();

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
