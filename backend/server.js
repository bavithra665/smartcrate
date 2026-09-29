require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');

const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`SmartCrate backend running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
};

startServer().catch((error) => {
  console.error('SmartCrate backend startup failed:', error.message);
  process.exit(1);
});
