import { createServer } from 'node:http'
import { unread } from './queue.mjs'

const articles = [{ title: 'Query plans', read: false }, { title: 'Indexes', read: true }]
createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(unread(articles)))
}).listen(8000, '0.0.0.0')
