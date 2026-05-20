# Communication Protocol

Rpc uses **MessagePack** as its primary communication protocol for efficiency and performance. For clients that do not support MessagePack, it can fall back to **JSON**.

- **`$command`**: Sends data in the request body, encoded with MessagePack (`application/msgpack`). Plain JSON (`application/json`) is also accepted by the server.
- **`$query`**: Sends data in the URL's query string, encoded with MessagePack and Base64. This is the recommended method for cacheable queries.
- **`$get`**: Sends data as plain text in the URL's query string. Useful for clients that do not support MessagePack, or for simple non-complex queries.

The server automatically detects the client's `Accept` header and responds with either MessagePack or JSON.

## Response Headers

Every response includes the following headers:

| Header                       | Description                                 |
|------------------------------|---------------------------------------------|
| `x-atom-forge-rpc-exec-time` | Server-side execution time in milliseconds. |
