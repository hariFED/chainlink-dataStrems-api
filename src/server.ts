import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ChainlinkDatastreamsConsumer from '@hackbg/chainlink-datastreams-consumer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Chainlink DataStreams API client
const api = new ChainlinkDatastreamsConsumer({
  apiUrl: 'https://api.testnet-dataengine.chain.link',
  wsUrl: 'wss://api.testnet-dataengine.chain.link',
  clientId: process.env.STREAMS_API_KEY || '',
  clientSecret: process.env.STREAMS_API_SECRET || '',
  reconnect: true,
});

// Helper: Convert BigInt values to strings
function convertBigIntsToStrings(obj: any): any {
  if (typeof obj === 'bigint') {
    return obj.toString();
  } else if (Array.isArray(obj)) {
    return obj.map(convertBigIntsToStrings);
  } else if (obj && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = convertBigIntsToStrings(obj[key]);
    }
    return newObj;
  }
  return obj;
}

// Function to fetch Chainlink feed report
async function getReport() {
  const timestamp = Math.floor(Date.now() / 1000);
  return api.fetchFeed({
    timestamp,
    feed: '0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439',
  });
}

// Retry utility function
async function retry<T>(fn: () => Promise<T>, retries = 10, delayMs = 0): Promise<T> {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`Attempt ${attempt} failed. Retrying...`);
      if (delayMs > 0) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }
  throw lastError;
}

// API route to return the report
app.post('/api/report', async (req: Request, res: Response) => {
  const { secret } = req.body;

  if (secret !== process.env.AUTH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const report = await retry(getReport, 10, 100); // Retry 5 times with 100ms delay
    const safeReport = convertBigIntsToStrings(report);
    res.json({ report: safeReport.benchmarkPrice });
  } catch (err) {
    console.error('Error fetching report after retries:', err);
    res.status(500).json({ error: 'Failed to fetch report after retries' });
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.json({ data: 'This is custom Chainlink DataStreams API' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
