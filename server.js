const server = require("./src/app");

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`MetaHead Arena server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to test`);
});
